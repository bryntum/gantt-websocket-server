#!/usr/bin/env node

/**
 * Server accepts command line arguments
 * port - server port
 * resetDelay - data reset delay in seconds. 0 - don't use data reset. Default is 5 minutes.
 * Example: "node server.js port=8181 resetDelay=60"
 */

const
    { WebSocketServer } = require('./src/server.js'),
    args                 = process.argv.slice(2).reduce((acc, arg) => {
        const [k, v = true] = arg.split('=');
        acc[k] = v;
        return acc;
    }, {}),
    resetDelay           = (args.resetDelay || 30 * 60) * 1000,
    debug                = args.debug,
    port                 = args.port || 8080,
    autoSaveIntervalMins = args.autoSaveIntervalMins;

const server = new WebSocketServer({ debug, resetDelay, port, autoSaveIntervalMins });

server.init(port).then(() => {
    server.showWebSocketServerAddress();
});
