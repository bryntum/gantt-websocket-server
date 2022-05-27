#!/usr/bin/env node

/**
 * Server accepts command line arguments
 * port - server port
 * resetDelay - data reset delay in seconds. 0 - don't use data reset. Default is 5 minutes.
 * Example: "node server.js port=8181 resetDelay=60"
 */

const
    fs         = require('fs'),
    https      = require('https'),
    WebSocket  = require('ws'),
    { Storage } = require('./storage.js'),
    { DataHandler } = require('./datahandler.js'),
    args       = process.argv.slice(2).reduce((acc, arg) => {
        const [k, v = true] = arg.split('=');
        acc[k]            = v;
        return acc;
    }, {}),
    customFields = [],
    resetDelay   = (args.resetDelay || 30 * 60) * 1000,
    debug        = args.debug,
    dataHandler  = new DataHandler();

let
    port         = args.port || 8080,
    httpsServer  = null, // Https server
    wss          = null, // WebSockets server
    storage      = new Storage(),
    lastActionTime,
    dataset;

/**
 * Logs message to console
 */
function log(txt) {
    console.log(txt);
}

/**
 * Logs message to console in debug mode
 */
function debugLog(txt) {
    if (debug) {
        log(txt);
    }
}

/**
 * Logs error message to console
 */
function logError(error) {
    log(`Error: ${error.message ? error.message : error}`);
}

/**
 * Broadcast a message to all clients except the specified sender
 * @param sender Client to not send to
 * @param {Object} data Data to transmit, will be JSON encoded
 */
function broadcast(sender, data) {
    // Attach sender's username to the data
    data.userName = sender ? sender.userName : undefined;

    wss.clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
            debugLog(`>>> ${JSON.stringify(data)}, to: ${client.userName}`);
        }
    });
}

/**
 * Show the server ip on console to make it easier for clients to connect
 */
function showWebSocketServerAddress() {
    const
        ni      = require('network-interfaces'),
        options = { internal : false, ipVersion : 4 },
        ip      = ni.toIp(ni.getInterfaces(options)[0], options);
    log(`Server started at ws${httpsServer ? 's' : ''}://${ip}:${port}`);
}

/**
 * Initializes WebSocket server starting from the specified port.
 * If port is not available then server tries to increment port number and starts again while port is lower then 65535
 */
function initWebSocketServer() {
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
                port++;
                initWebSocketServer();
            }
            else {
                httpsServer = null;
                wss = null;
                logError(error);
            }
        });
        wss.on('listening', () => startWebSocketServer());
    }
    else {
        httpsServer = null;
        wss = null;
        logError('No available ports');
    }
}

/**
 * Start the server. Starts listening for connecting clients and relays messages between them
 */
function startWebSocketServer() {
    showWebSocketServerAddress();

    debugLog('Setup listeners ...');

    // When client connects...
    wss.on('connection', ws => {
        // ...start listening for messages from it

        debugLog(`New incoming connection from: ${ws._socket.remoteAddress}`);

        ws.on('message', msg => {
            debugLog(`<<< ${msg}`);

            lastActionTime =  new Date().getTime();

            try {

                // Messages have format { command : 'cmd', xxx }. Transmitted as a string, parse it to an object
                const data = JSON.parse(msg);

                switch (data.command) {
                    // Client transmits the hello command after connecting, grab attached username
                    case 'hello':
                        // Check for user name
                        ws.userName = (data.userName || '').trim().slice(0, 15);
                        if (ws.userName === '') {
                            ws.userName = 'Client';
                        }
                        broadcastUsers();
                        break;

                    // Client requests data reset
                    case 'reset':
                        resetDataSet(ws.userName);
                        // Do not broadcast
                        return;

                    // Client checks if custom fields are defined
                    case 'fields':
                        data.customFields = customFields;
                        ws.send(JSON.stringify(data));
                        return;

                    // Client requested its initial dataset, send the up to date version
                    case 'dataset':
                        data.dataset = dataHandler.dataset;
                        data.project = dataHandler.project;
                        ws.send(JSON.stringify(data));

                        debugLog('Sent dataset to ' + ws.userName);
                        // Do not broadcast
                        return;

                    case 'projectChange': {
                        const { changes, hasNewRecords } = dataHandler.handleProjectChanges(data.changes);
                        if (hasNewRecords) {
                            broadcast(null, { command : 'projectChange', projectChanges : changes });
                        }
                        else {
                            broadcast(ws, { command : 'projectChange', projectChanges : changes });
                        }
                        return;
                    }
                }

                broadcast(ws, data);
            }
            catch (error) {
                // log error to console and reset data
                logError(error);
                resetDataSet();
            }
        });

        // Broadcast when client disconnects
        ws.on('error', error => {
            logError(error);
        });

        // Broadcast when client disconnects
        ws.on('close', () => {
            broadcast(ws, { command : 'bye' });
            broadcastUsers();
        });
    });
}

/**
 * Reads dataset from file
 */
function readDataSet() {
    try {
        debugLog('dataset');
        dataHandler.reset();
    }
    catch (error) {
        logError(error);
    }
}

/**
 * Resets server dataset and broadcasts it to all connected clients
 */
function resetDataSet(userName) {
    userName = userName || 'Server';
    debugLog('Reset dataset by ' + userName);
    readDataSet();
    broadcast(null, { command : 'dataset', dataset : dataHandler.dataset });
    broadcast({ userName }, { command : 'reset' });
}

/**
 * Sends current user names to all online clients
 */
function broadcastUsers() {
    const users = [];
    wss.clients.forEach(client => {
        users.push(client.userName);
    });
    debugLog(`Broadcast users: ${JSON.stringify(users)}`);
    broadcast(null, { command : 'users', users });
}

/**
 * Automatically resets dataset if no actions performed during resetDelay time
 */
if (resetDelay > 0) {
    setInterval(() => {
        if (lastActionTime + resetDelay < new Date().getTime()) {
            resetDataSet();
            lastActionTime = new Date().getTime();
        }
    }, 1000);
}

initWebSocketServer();
