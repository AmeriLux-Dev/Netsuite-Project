/**
 * Local development proxy. Vite forwards /api/* here; this server exchanges a signed JWT for an
 * OAuth 2.0 access token (client credentials) and forwards restlet calls to the sandbox, so the
 * browser never sees credentials and the bundle never carries account details.
 *
 * Reads client/.env (gitignored). See .env.example for the values.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';

const clientDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(clientDir, '.env'), quiet: true });

function readEnv(name: string): string {
    return (process.env[name] ?? '').trim().replace(/^["']|["']$/g, '');
}

const accountId = readEnv('NETSUITE_ACCOUNT_ID');
const clientId = readEnv('NETSUITE_CLIENT_ID');
const certificateId = readEnv('NETSUITE_CERTIFICATE_ID');
const privateKeyPath = readEnv('NETSUITE_PRIVATE_KEY_PATH');
const keyAlgorithm = (readEnv('NETSUITE_KEY_ALGORITHM') || 'ES256').toUpperCase();
const port = Number(readEnv('DEV_PROXY_PORT') || 4000);

const missing = [
    ['NETSUITE_ACCOUNT_ID', accountId],
    ['NETSUITE_CLIENT_ID', clientId],
    ['NETSUITE_CERTIFICATE_ID', certificateId],
    ['NETSUITE_PRIVATE_KEY_PATH', privateKeyPath],
].filter(([, value]) => !value).map(([name]) => name);
if (missing.length > 0) {
    console.warn(`[dev-proxy] Missing in client/.env: ${missing.join(', ')}. Restlet calls will fail until they are set.`);
}

/** `1234567_SB1` becomes the `1234567-sb1` host label NetSuite uses. */
const accountDomainLabel = accountId.toLowerCase().replace(/_/g, '-');
const tokenEndpoint = `https://${accountDomainLabel}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;
const restletEndpoint = `https://${accountDomainLabel}.restlets.api.netsuite.com/app/site/hosting/restlet.nl`;

function base64Url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(signingInput: string, privateKey: string): Buffer {
    switch (keyAlgorithm) {
        case 'ES256':
            return crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
        case 'PS256':
            return crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 });
        case 'RS256':
            return crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey });
        default:
            throw new Error(`Unsupported NETSUITE_KEY_ALGORITHM "${keyAlgorithm}"; use ES256, PS256 or RS256.`);
    }
}

async function buildClientAssertion(): Promise<string> {
    const privateKey = await fs.promises.readFile(privateKeyPath, 'utf8');
    const now = Math.floor(Date.now() / 1000);
    const header = { typ: 'JWT', alg: keyAlgorithm, kid: certificateId };
    const payload = {
        iss: clientId,
        scope: ['restlets'],
        aud: tokenEndpoint,
        jti: crypto.randomUUID(),
        iat: now,
        exp: now + 300,
    };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    return `${signingInput}.${base64Url(signJwt(signingInput, privateKey))}`;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function fetchAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) return cachedToken.accessToken;

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: await buildClientAssertion(),
    });
    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Token request failed (${response.status}): ${text.slice(0, 300)}`);
    }
    const json = JSON.parse(text) as { access_token: string; expires_in?: number };
    const expiresIn = Number(json.expires_in) || 1800;
    cachedToken = { accessToken: json.access_token, expiresAt: Date.now() + expiresIn * 1000 };
    console.log(`[dev-proxy] fetched access token, expires in ${expiresIn}s`);
    return json.access_token;
}

const app = express();
app.use(express.json({ limit: '5mb' }));

/** Forwards to the restlet named by the incoming `script` and `deploy` query parameters. */
app.all('/api/restlet', async (request: Request, response: Response) => {
    try {
        const target = new URL(restletEndpoint);
        for (const [key, value] of Object.entries(request.query)) {
            if (typeof value === 'string') target.searchParams.set(key, value);
        }
        if (!target.searchParams.get('script') || !target.searchParams.get('deploy')) {
            response.status(400).json({ status: 400, error: 'script and deploy query parameters are required', data: null });
            return;
        }

        const headers: Record<string, string> = {
            Authorization: `Bearer ${await fetchAccessToken()}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.body && Object.keys(request.body).length > 0;
        console.log(`[dev-proxy] ${request.method} ${target.searchParams.get('script')}/${target.searchParams.get('deploy')}`);

        const upstream = await fetch(target, { method: request.method, headers, body: hasBody ? JSON.stringify(request.body) : undefined });
        const text = await upstream.text();
        response.status(upstream.status);
        const contentType = upstream.headers.get('content-type');
        if (contentType) response.setHeader('Content-Type', contentType);
        response.send(text);
    } catch (error) {
        console.error('[dev-proxy] restlet call failed', error);
        response.status(502).json({ status: 502, error: error instanceof Error ? error.message : 'proxy failure', data: null });
    }
});

app.listen(port, () => {
    console.log(`[dev-proxy] listening on http://localhost:${port} for ${accountId || '(no account configured)'}`);
});
