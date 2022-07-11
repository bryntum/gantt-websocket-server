const WebSocket = require('ws');
const { AuthorizationHandler } = require('./AuthorizationHandler.js');
const { DataHandler } = require('../datahandler.js');

class MessageHandler extends AuthorizationHandler {
    constructor(config) {
        super(config);

        this.handlersMap = {
            'hello'         : this.handleHello.bind(this),
            'login'         : this.handleLogin.bind(this),
            'logout'        : this.handleLogout.bind(this),
            'reset'         : this.handleReset.bind(this),
            'dataset'       : this.handleDataset.bind(this),
            'projectChange' : this.handleProjectChange.bind(this)
        }

        this.dataHandler = new DataHandler();
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

    handleLogin(ws, data) {
        const { login, password } = data;

        const logged = this.login(login, password);

        if (logged) {
            ws.userName = login;
            ws.send(JSON.stringify({ command : 'login', projects : this.dataHandler.getProjectsMetadata(this.getUserProjects(login)) }));

            this.broadcastUsers();
        }
        else {
            ws.send(JSON.stringify({ command : 'login', error : 'Wrong username/password' }), null, () => ws.close());
        }
    }

    handleLogout(ws) {
        this.broadcast(ws, { command : 'logout' });
        this.broadcastUsers();
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
        const dataset = this.dataHandler.getProjectData(1);

        data.project = dataset.project;
        delete dataset.project;

        data.dataset = dataset;

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

module.exports = { MessageHandler };
