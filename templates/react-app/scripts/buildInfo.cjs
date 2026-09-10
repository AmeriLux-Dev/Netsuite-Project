'use strict';

const fs = require('node:fs');

/**
 * Version and build id stamped into both bundles (webpack DefinePlugin, Vite define).
 * The Suitelet appends them to the client bundle URL, so every deploy busts the browser cache
 * without anyone editing a version string by hand.
 */
function readBuildInfo(packageJsonPath) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return { version: String(packageJson.version || '0.0.0'), buildId };
}

module.exports = { readBuildInfo };
