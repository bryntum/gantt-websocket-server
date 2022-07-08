const
    { WebSocketServer } = require('./server.js'),
    args                = process.argv.slice(2).reduce((acc, arg) => {
        const [k, v = true] = arg.split('=');
        acc[k] = v;
        return acc;
    }, {}),
    resetDelay          = (args.resetDelay || 30 * 60) * 1000,
    debug               = args.debug,
    port                = args.port || 8080;

const server = new WebSocketServer({ debug, resetDelay });

server.init(port).then(() => {
    server.showWebSocketServerAddress();
});
