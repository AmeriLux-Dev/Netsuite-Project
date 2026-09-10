'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { globSync } = require('glob');
const webpack = require('webpack');
const { applyNetSuiteWrapperWebpack } = require('@amerilux/netsuite-wrapper/webpack');
const { netsuiteRepositoryPlugin } = require('@amerilux/netsuite-repository/plugin');
const { readBuildInfo } = require('../scripts/buildInfo.cjs');

const apiDir = __dirname;
const sourceDir = path.join(apiDir, 'src');
const outputDir = path.resolve(apiDir, '../netsuite/FileCabinet/SuiteScripts/{{appName}}/api');
const wrapperConfigPath = path.join(apiDir, 'netsuite-wrapper.config.js');
const wrapperConfig = require(wrapperConfigPath);

/** The leading JSDoc block, which NetSuite reads for @NApiVersion and @NScriptType. */
function readScriptHeader(filePath) {
    const source = fs.readFileSync(filePath, 'utf8');
    const match = source.match(/^\s*(\/\*[\s\S]*?\*\/)/);
    return match ? match[1] : '';
}

/**
 * One entry per SuiteScript entry point: a file under src/ whose leading JSDoc carries
 * @NScriptType. Helpers, domain code, models, stubs and tests never become File Cabinet files.
 * The entry name keeps the folder, so src/controllers/x.ts lands at api/controllers/x.js.
 */
function collectScriptEntries() {
    const entries = {};
    const files = globSync('**/*.ts', {
        cwd: sourceDir,
        nodir: true,
        ignore: ['**/__tests__/**', '**/*.d.ts', 'models/generated/**'],
    });
    for (const relativePath of files) {
        const filePath = path.join(sourceDir, relativePath);
        if (!/@NScriptType\b/.test(readScriptHeader(filePath))) continue;
        const entryName = relativePath.replace(/\\/g, '/').replace(/\.ts$/, '');
        entries[entryName] = filePath;
    }
    if (Object.keys(entries).length === 0) {
        throw new Error('No SuiteScript entry points found: add a file under api/src with an @NScriptType header.');
    }
    return entries;
}

/** Regenerates the repository context before every compilation (build and watch). */
class NetSuiteRepositoryGeneratePlugin {
    constructor() {
        this.plugin = netsuiteRepositoryPlugin({ cwd: apiDir, log: (message) => console.log(`[netsuite-repository] ${message}`) });
    }

    apply(compiler) {
        const generate = (_compiler, callback) => {
            try {
                this.plugin.buildStart();
                callback();
            } catch (error) {
                callback(error);
            }
        };
        compiler.hooks.beforeRun.tapAsync('NetSuiteRepositoryGeneratePlugin', generate);
        compiler.hooks.watchRun.tapAsync('NetSuiteRepositoryGeneratePlugin', generate);
    }
}

module.exports = (_env, argv) => {
    const mode = (argv && argv.mode) || 'production';
    const entries = collectScriptEntries();
    const buildInfo = readBuildInfo(path.resolve(apiDir, '../package.json'));

    const config = {
        mode,
        context: apiDir,
        entry: entries,
        target: 'web',
        devtool: false,
        output: {
            path: outputDir,
            filename: '[name].js',
            libraryTarget: 'amd',
            // Only this folder is cleaned; the client bundle lives in a sibling folder.
            clean: true,
            environment: { arrowFunction: true, const: true, destructuring: true, forOf: true, optionalChaining: false, templateLiteral: true },
        },
        resolve: {
            extensions: ['.ts', '.js', '.json'],
            alias: {
                common: path.resolve(apiDir, '../common'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.ts$/i,
                    exclude: [/node_modules/, /\.d\.ts$/i],
                    use: [{ loader: 'ts-loader', options: { transpileOnly: false, configFile: path.join(apiDir, 'tsconfig.json') } }],
                },
            ],
        },
        plugins: [
            new NetSuiteRepositoryGeneratePlugin(),
            // Re-attach the entry file's leading JSDoc so NetSuite sees @NApiVersion / @NScriptType on line 1.
            new webpack.BannerPlugin({
                banner: (data) => {
                    const entryName = data.chunk && data.chunk.name;
                    const entryPath = entryName && entries[entryName];
                    if (!entryPath) return '';
                    const header = readScriptHeader(entryPath);
                    return header ? `${header}\n` : '';
                },
                raw: true,
                entryOnly: true,
            }),
            new webpack.DefinePlugin({
                __APP_VERSION__: JSON.stringify(buildInfo.version),
                __BUILD_ID__: JSON.stringify(buildInfo.buildId),
            }),
        ],
        // Readable output: NetSuite's script log points at line numbers in this file.
        optimization: { minimize: false },
    };

    // The wrapper adds the N/* externals function, the N/* -> wrapper module rewrite, the optional
    // Babel instrumentation pass and the telemetry bootstrap entry. Do not add another N/* externals
    // function here; it would short-circuit the rewrite. Instrumentation is only read from options.
    return applyNetSuiteWrapperWebpack(config, {
        configPath: wrapperConfigPath,
        instrumentation: wrapperConfig.instrumentation === true,
    });
};
