const WebSocket = require('ws');
const { AuthorizationHandler } = require('./AuthorizationHandler.js');
const { DataHandler } = require('../datahandler.js');

class MessageHandler extends AuthorizationHandler {
    constructor(config) {
        super(config);

        this.handlersMap = {
            'login'         : this.handleLogin.bind(this),
            'logout'        : this.requireAuth(this.handleLogout),
            'projects'      : this.requireAuth(this.handleProjects),
            'reset'         : this.requireAuth(this.handleReset),
            'dataset'       : this.requireAuth(this.handleDataset),
            'projectChange' : this.requireAuth(this.handleProjectChange)
        }

        this.dataHandler = new DataHandler();

        this.projectSubscribersMap = {};
    }

    /**
     * Reads dataset from file
     */
    readDataSet(id) {
        try {
            this.debugLog('dataset');
            this.dataHandler.reset(id);
        }
        catch (error) {
            this.logError(error);
        }
    }

    resetEntireDataset() {
        this.debugLog('Reset dataset by server');
        this.readDataSet();

        Object.entries(this.projectSubscribersMap).forEach(([project, subscribers]) => {
            const datasetMessage = JSON.stringify({ command : 'dataset', project : Number(project), dataset : this.dataHandler.getProjectData(Number(project)) });
            const resetMessage = JSON.stringify({ command : 'reset', userName : 'Server' });

            subscribers.forEach(client => {
                client.send(datasetMessage);
                client.send(resetMessage);
            });
        });
    }

    /**
     * Resets server dataset and broadcasts it to all connected clients
     */
    resetDataSet(project, userName = 'Server') {
        if (userName === 'Server') {
            this.resetEntireDataset();
        }
        else {
            this.debugLog(`Reset dataset by ${userName}`);
            this.readDataSet(project);
            this.broadcastProjectChanges(null, { command : 'dataset', project, dataset : this.dataHandler.getProjectData(project) });
            this.broadcastProjectChanges({ userName }, { command : 'reset', project });
        }
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
            // Only send broadcast messages to authorized clients
            if (client !== sender && client.readyState === WebSocket.OPEN && client.userName) {
                client.send(JSON.stringify(data));
                this.debugLog(`>>> ${JSON.stringify(data)}, to: ${client.userName}`);
            }
        });
    }

    broadcastProjectChanges(ws, data) {
        const { project } = data;
        const message = JSON.stringify(data);

        this.projectSubscribersMap[project].forEach(client => {
            if (client !== ws) {
                client.send(message);
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
            ws.send(JSON.stringify({ command : 'login' }));

            this.broadcastUsers();
        }
        else {
            ws.send(JSON.stringify({ command : 'login', error : 'Wrong username/password' }));
        }
    }

    handleLogout(ws) {
        // When client disconnects we need to unsubscribe it from project updates
        Object.values(this.projectSubscribersMap).forEach(map => map.delete(ws));

        this.broadcast(ws, { command : 'logout' });
        this.broadcastUsers();
    }

    handleProjects(ws) {
        ws.send(JSON.stringify({ command : 'projects', projects : this.dataHandler.getProjectsMetadata(this.getUserProjects(ws.userName)) }));
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

    handleReset(ws, { command, project }) {
        if (this.isClientSubscribedToProject(ws, project)) {
            this.resetDataSet(project, ws.userName);
        }
        else {
            ws.send(JSON.stringify({ command, project, error : 'Subscription to project is required. Load project first' }));
        }
    }

    handleDataset(ws, data) {
        const { project } = data;

        this.subscribeClientToProject(ws, project);

        const dataset = this.dataHandler.getProjectData(project);

        data.projectMeta = dataset.project;
        delete dataset.project;

        data.dataset = dataset;

        ws.send(JSON.stringify(data));

        this.debugLog('Sent dataset to ' + ws.userName);
    }

    handleProjectChange(ws, data) {
        const { command, project } = data;

        if (this.isClientSubscribedToProject(ws, project)) {
            const { changes, hasNewRecords } = this.dataHandler.handleProjectChanges(project, data.changes);

            if (hasNewRecords) {
                this.broadcastProjectChanges(null, { command, project, changes });
            }
            else {
                this.broadcastProjectChanges(ws, { command, project, changes });
            }
        }
        else {
            ws.send(JSON.stringify({ command, project, error : 'Subscription to project is required. Load project first' }));
        }
    }
    //#endregion

    // When client requests dataset we subscribe him to that project updates
    subscribeClientToProject(ws, project) {
        // First unsubscribe current client from all other datasets
        Object.values(this.projectSubscribersMap).forEach(map => map.delete(ws));

        // Second add current client to the the new project subscriptions
        const subscribers = this.projectSubscribersMap[project] = (this.projectSubscribersMap[project] || new Set() );

        subscribers.add(ws);
    }

    isClientSubscribedToProject(ws, project) {
        return !!this.projectSubscribersMap[project]?.has(ws);
    }
}

module.exports = { MessageHandler };
