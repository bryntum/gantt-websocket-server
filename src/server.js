#!/usr/bin/env node

/**
 * Server accepts command line arguments
 * port - server port
 * resetDelay - data reset delay in seconds. 0 - don't use data reset. Default is 5 minutes.
 * Example: "node server.js port=8181 resetDelay=60"
 */

const
    fs              = require('fs'),
    https           = require('https'),
    WebSocket       = require('ws'),
    ni              = require('network-interfaces'),
    { DataHandler } = require('./datahandler.js');

class Loggable {
    /**
     * Logs message to console
     */
    log(txt) {
        console.log(txt);
    }

    /**
     * Logs message to console in debug mode
     */
    debugLog(txt) {
        if (this.debug) {
            this.log(txt);
        }
    }

    /**
     * Logs error message to console
     */
    logError(error) {
        this.log(`Error: ${error.message ? error.message : error}`);
    }
}

class MessageHandler extends Loggable {
    constructor(config) {
        super(config);

        this.handlersMap = {
            'hello'         : this.handleHello,
            'reset'         : this.handleReset,
            'dataset'       : this.handleDataset,
            'projectChange' : this.handleProjectChange
        }
    }

    /**
     * Reads dataset from file
     */
    readDataSet() {
        try {
            this.debugLog('dataset');
            this.dataHandler.reset();
        }
        catch (error) {
            this.logError(error);
        }
    }

    /**
     * Resets server dataset and broadcasts it to all connected clients
     */
    resetDataSet(userName = 'Server') {
        this.debugLog('Reset dataset by ' + userName);
        this.readDataSet();
        this.broadcast(null, { command : 'dataset', dataset : this.dataHandler.dataset });
        this.broadcast({ userName }, { command : 'reset' });
    }

    /**
     * Broadcast a message to all clients except the specified sender
     * @param sender Client to not send to
     * @param {Object} data Data to transmit, will be JSON encoded
     */
    broadcast(sender, data) {
        // Attach sender's username to the data
        data.userName = sender ? sender.userName : undefined;

        this.wss.clients.forEach(client => {
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
                this.debugLog(`>>> ${JSON.stringify(data)}, to: ${client.userName}`);
            }
        });
    }

    /**
     * Sends current user names to all online clients
     */
    broadcastUsers() {
        const users = [];
        this.wss.clients.forEach(client => {
            users.push(client.userName);
        });
        this.debugLog(`Broadcast users: ${JSON.stringify(users)}`);
        this.broadcast(null, { command : 'users', users });
    }

    //#region Message handlers

    /**
     * Returns message handler
     * @param command
     * @returns {Function}
     */
    getHandler(command) {
        return this.handlersMap[command] || this.defaultHandler;
    }

    // This handler is returned
    defaultHandler() {

    }

    handleHello(ws, data) {
        // Check for user name
        ws.userName = (data.userName || '').trim().slice(0, 15);

        if (ws.userName === '') {
            ws.userName = 'Client';
        }

        this.broadcastUsers();

        // Send hello message to other clients to greet newcomer
        this.broadcast(ws, data);
    }

    handleReset(ws) {
        this.resetDataSet(ws.userName);
    }

    handleDataset(ws, data) {
        data.dataset = this.dataHandler.dataset;
        data.project = this.dataHandler.project;

        ws.send(JSON.stringify(data));

        this.debugLog('Sent dataset to ' + ws.userName);
    }

    handleProjectChange(ws, data) {
        const { changes, hasNewRecords } = this.dataHandler.handleProjectChanges(data.changes);

        if (hasNewRecords) {
            this.broadcast(null, { command : 'projectChange', changes });
        }
        else {
            this.broadcast(ws, { command : 'projectChange', changes });
        }
    }
    //#endregion
}

class WebSocketServer extends MessageHandler {
    constructor(config) {
        super(config);

        this.wss = null;
        this.port = 8080;
        this.httpsServer = null;
        this.dataHandler = new DataHandler();
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
                    if (/EADDRINUSE/.test(error)) {
                        me.port++;
                        me.init();
                    }
                    else {
                        httpsServer = null;
                        wss = null;
                        me.logError(error);
                    }
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
                // log error to console and reset data
                me.logError(error);
                me.resetDataSet();
            }
        });

        // Broadcast when client disconnects
        ws.on('error', error => {
            me.logError(error);
        });

        // Broadcast when client disconnects
        ws.on('close', () => {
            me.broadcast(ws, { command : 'bye' });
            me.broadcastUsers();
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
