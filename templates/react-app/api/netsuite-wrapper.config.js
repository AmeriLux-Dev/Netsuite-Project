// @amerilux/netsuite-wrapper build configuration (read by webpack.config.js).
//
// telemetryBootstrap: where wrapped N/* calls report their spans. `false` keeps the wrappers
//   as thin pass-throughs. Leaving the key out would silently default to performance-tracker.
// instrumentation: the Babel pass that tags every function with its module and name so log
//   lines and spans say where they came from. Off unless telemetry is on.
{{#if performanceTracker}}
module.exports = {
    telemetryBootstrap: { integration: 'performance-tracker' },
    instrumentation: true,
    chunkLogging: 'group',
};
{{/if}}
{{#unless performanceTracker}}
module.exports = {
    telemetryBootstrap: false,
    instrumentation: false,
    chunkLogging: 'group',
};
{{/unless}}
