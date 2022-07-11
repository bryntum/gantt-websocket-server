const
    fs                 = require('fs'),
    https              = require('https'),
    WebSocket          = require('ws'),
    ni                 = require('network-interfaces'),
    { MessageHandler } = require('./server/MessageHandler.js');


class WebSocketServer extends MessageHandler {
    constructor(config) {
        super(config);

        this.wss = null;
        this.port = 8080;
        this.httpsServer = null;
        this.lastActionTime = 0;

        Object.assign(this, config);
    }

    destroy() {
        this.wss.close();
        this.httpsServer?.close();
    }

    get address() {
        const
            options = { internal : false, ipVersion : 4 },
            ip      = ni.toIp(ni.getInterfaces(options)[0], options);

        return `ws${this.httpsServer ? 's' : ''}://${ip}:${this.port}`;
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

                // load SSL certificate
                if (fs.existsSync('cert/key.pem') && fs.existsSync('cert/cert.pem')) {
                    options.key  = fs.readFileSync('cert/key.pem', 'utf8');
                    options.cert = fs.readFileSync('cert/cert.pem', 'utf8');

                    httpsServer = https.createServer(options, (req, res) => {
                        // Simple server response
                        res.writeHead(200);
                        res.end('Https server is online\n');
                    }).listen(port);

                    wss = new WebSocket.Server({ server : httpsServer });
                }
                else {
                    wss = new WebSocket.Server({ port : port });
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
                        me.resetDataSet();
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

        // ...start listening for messages from it

        me.debugLog(`New incoming connection from: ${ws._socket.remoteAddress}`);

        ws.on('message', msg => {
            me.debugLog(`<<< ${msg}`);

            me.lastActionTime =  new Date().getTime();

            try {
                // Messages have format { command : 'cmd', xxx }. Transmitted as a string, parse it to an object
                const data = JSON.parse(msg);

                const handler = this.getHandler(data.command);

                handler.call(me, ws, data);
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

    /**
     * Show the server ip on console to make it easier for clients to connect
     */
    showWebSocketServerAddress() {
        this.log(this.address);
    }
}

module.exports = { WebSocketServer };
