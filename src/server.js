const
    fs                  = require('fs'),
    http                = require('http'),
    https               = require('https'),
    WebSocket           = require('ws'),
    ni                  = require('network-interfaces'),
    { MessageHandler }  = require('./server/MessageHandler.js'),
    { MessageLogger }   = require('./server/MessageLogger.js'),
    { HttpHandler }     = require('./server/HttpHandler.js');


class WebSocketServer extends MessageHandler {
    constructor(config) {
        super(config);

        this.wss = null;
        this.port = 8080;
        this.httpServer = null;
        this.httpsServer = null;
        this.lastActionTime = 0;
        this.messageLogger = new MessageLogger();
        this.httpHandler = new HttpHandler(this);

        Object.assign(this, config);
    }

    destroy() {
        this.wss.close();
        this.httpServer?.close();
        this.httpsServer?.close();
    }

    get address() {
        const
            options = { internal : false, ipVersion : 4 },
            ifs     = ni.getInterfaces(options),
            ip      = ni.toIp(ifs[ifs.length - 1], options);

        const protocol = this.httpsServer ? 'wss' : 'ws';

        return `${protocol}://${ip}:${this.port}`;
    }

    /**
     * Initializes WebSocket server starting from the specified port.
     * If port is not available then server tries to increment port number and starts again while port is lower then 65535
     */
    init(port = this.port) {
        const
            me             = this,
            { resetDelay } = me;

        let httpsServer, wss;

        return new Promise((resolve, reject) => {
            if (port < 65535) {
                const options = {};

                const requestHandler = (req, res) => me.httpHandler.handleRequest(req, res);

                // load SSL certificate
                if (fs.existsSync('cert/key.pem') && fs.existsSync('cert/cert.pem')) {
                    options.key  = fs.readFileSync('cert/key.pem', 'utf8');
                    options.cert = fs.readFileSync('cert/cert.pem', 'utf8');

                    httpsServer = https.createServer(options, requestHandler).listen(port);

                    wss = new WebSocket.Server({ server : httpsServer });
                }
                else {
                    const httpServer = http.createServer(requestHandler);

                    httpServer.listen(port);
                    me.httpServer = httpServer;

                    wss = new WebSocket.Server({ server : httpServer });
                }

                wss.on('error', error => {
                    httpsServer = null;
                    wss = null;
                    me.logError(error);
                });

                wss.on('listening', () => {
                    me.bindWebsocketServerListeners();
                    resolve(true);
                });
            }
            else {
                httpsServer = null;
                wss = null;
                me.logError('No available ports');
                reject('No available ports');
            }

            me.httpsServer = httpsServer;
            me.wss = wss;

            /**
             * Automatically resets dataset if no actions performed during resetDelay time
             */
            if (resetDelay > 0) {
                setInterval(() => {
                    if (me.lastActionTime + resetDelay < new Date().getTime()) {
                        me.resetEntireDataset();
                        me.lastActionTime = new Date().getTime();
                    }
                }, 1000);
            }
        });
    }

    /**
     * Start the server. Starts listening for connecting clients and relays messages between them
     */
    bindWebsocketServerListeners() {
        const me = this;

        me.debugLog('Setup listeners ...');

        // When client connects...
        me.wss.on('connection', ws => me.bindWebsocketClientListeners(ws));
    }

    bindWebsocketClientListeners(ws) {
        const me = this;

        ws.id = me.generateClientId();

        // Wrap ws.send to log outgoing messages
        const originalSend = ws.send.bind(ws);

        ws.send = function(msgStr, ...args) {
            try {
                const parsed = JSON.parse(msgStr);

                me.messageLogger.log({
                    direction : 'outgoing',
                    clientId  : ws.id,
                    userName  : ws.userName || null,
                    command   : parsed.command,
                    data      : parsed.data
                });
            }
            catch {
                // Ignore parse errors for non-JSON messages
            }

            return originalSend(msgStr, ...args);
        };

        // ...start listening for messages from it

        me.debugLog(`New incoming connection from: ${ws._socket.remoteAddress}`);

        ws.on('message', msg => {
            me.debugLog(`<<< ${msg}`);

            me.lastActionTime =  new Date().getTime();

            try {
                // Messages have format { command : 'cmd', xxx }. Transmitted as a string, parse it to an object
                const data = JSON.parse(msg);

                me.messageLogger.log({
                    direction : 'incoming',
                    clientId  : ws.id,
                    userName  : ws.userName || null,
                    command   : data.command,
                    data      : data.data
                });

                const handler = this.getHandler(data.command);

                handler.call(me, ws, data.data, data.command);
            }
            catch (error) {
                ws.send(JSON.stringify({ command : 'error', message : error.message + error.stack }));
            }
        });

        ws.on('error', error => {
            me.logError(error);
        });

        ws.on('close', () => {
            me.handleLogout(ws);
        });
    }

    generateClientId() {
        this.counter = (this.counter || 0) + 1;

        return `client-${this.counter}`;
    }

    /**
     * Show the server ip on console to make it easier for clients to connect
     */
    showWebSocketServerAddress() {
        this.log(this.address);
    }
}

module.exports = { WebSocketServer };
