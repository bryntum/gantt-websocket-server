const WebSocket = require('ws');
const { AuthorizationHandler } = require('./AuthorizationHandler.js');
const { DataHandler } = require('../datahandler.js');

class MessageHandler extends AuthorizationHandler {
    constructor(config) {
        super(config);

        this.handlersMap = {
            'login'                    : this.handleLogin.bind(this),
            'logout'                   : this.requireAuth(this.handleLogout),
            'projects'                 : this.requireAuth(this.handleProjects),
            'reset'                    : this.requireAuth(this.requireSubscription(this.handleReset)),
            'dataset'                  : this.requireAuth(this.handleDataset),
            'project_change'           : this.requireAuth(this.requireSubscription(this.handleProjectChange)),
            'request_version_autosave' : this.requireAuth(this.requireSubscription(this.handleRequestVersionAutoSave))
        };

        this.dataHandler = new DataHandler();

        this.projectSubscribersMap = {};
        this.projectRevisionsMap = {};
        this.lastAutoSaveOK = new Map();
        this.minAutoSaveInterval = Math.max(1, (config.autoSaveIntervalMins ?? 60) - 1) * 60 * 1000;
    }

    getNextRevision(project) {
        return `server-${this.projectRevisionsMap[project].counter++}`;
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
            const datasetMessage = JSON.stringify({
                command : 'dataset',
                data    : {
                    project : Number(project),
                    dataset : this.dataHandler.getProjectData(Number(project))
                }
            });
            const resetMessage = JSON.stringify({ command : 'reset', data : { userName : 'Server' } });

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
            this.broadcastProjectChanges(null, {
                command : 'dataset',
                data    : {
                    project,
                    dataset : this.dataHandler.getProjectData(project)
                }
            });
            this.broadcastProjectChanges(null, { command : 'reset', data : { userName, project } });
        }
    }

    /**
     * Broadcast a message to all clients except the specified sender
     * @param sender Client to not send to
     * @param {Object} data Data to transmit, will be JSON encoded
     */
    broadcast(sender, data) {
        // Attach sender's username to the data
        data.data = Object.assign((data.data ?? {}), { userName : sender ? sender.userName : undefined });

        this.wss.clients.forEach(client => {
            // Only send broadcast messages to authorized clients
            if (client !== sender && client.readyState === WebSocket.OPEN && client.userName) {
                client.send(JSON.stringify(data));
                this.debugLog(`>>> ${JSON.stringify(data)}, to: ${client.userName}`);
            }
        });
    }

    broadcastProjectChanges(ws, message) {
        const { data : { project } } = message;
        const response = JSON.stringify(message);

        this.projectSubscribersMap[project].forEach(client => {
            client.send(response);
        });
    }

    /**
     * Sends current usernames to all online clients
     */
    broadcastUsers() {
        const users = [];
        this.wss.clients.forEach(client => {
            users.push(client.userName);
        });
        this.debugLog(`Broadcast users: ${JSON.stringify(users)}`);
        this.broadcast(null, { command : 'users', data : { users } });
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
            ws.send(JSON.stringify({ command : 'login', data : { client : ws.id } }));
            this.broadcast(ws, { command : 'login' });

            this.broadcastUsers();
        }
        else {
            ws.send(JSON.stringify({ command : 'login', error : 'Wrong username/password' }));
        }
    }

    handleLogout(ws) {
        // When client disconnects we need to unsubscribe it from project updates
        Object.values(this.projectSubscribersMap).forEach(map => map.delete(ws));

        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ command : 'logout', data : {} }));
            ws.close();
        }
        else {
            this.broadcast(ws, { command : 'logout', data : {} });
            this.broadcastUsers();
        }
    }

    handleProjects(ws) {
        ws.send(JSON.stringify({
            command : 'projects',
            data    :  {
                projects : this.dataHandler.getProjectsMetadata(this.getUserProjects(ws.userName))
            }
        }));
    }

    requireSubscription(fn) {
        return (ws, message, command) => {
            const { project } = message;
            if (this.isClientSubscribedToProject(ws, project)) {
                return fn.call(this, ws, message, command);
            }
            else {
                ws.send(JSON.stringify({
                    command,
                    data  : {
                        project
                    },
                    error : 'Subscription to project is required. Load project first'
                }));
            }
        };
    }

    handleReset(ws, { project }) {
        this.resetDataSet(project, ws.userName);
    }

    handleDataset(ws, message) {
        const { project } = message;

        this.subscribeClientToProject(ws, project);

        message.dataset = this.dataHandler.getProjectData(project);

        ws.send(JSON.stringify({ command : 'dataset', data : message }));

        this.debugLog('Sent dataset to ' + ws.userName);
    }

    handleProjectChange(ws, data) {
        const { project } = data;

        const revisions = data.revisions.map(revision => {
            return {
                revision      : this.getNextRevision(project),
                localRevision : revision.revision,
                client        : ws.id,
                changes       : this.dataHandler.handleProjectChanges(project, revision.changes).changes
            };
        });

        this.projectRevisionsMap[project].revisions.push(...revisions);

        this.broadcastProjectChanges(ws, { command : 'project_change', data : { revisions, project } });
    }

    handleRequestVersionAutoSave(ws, data) {
        const
            me             = this,
            { project }    = data,
            now            = new Date(),
            lastAutoSaveOK = me.lastAutoSaveOK.get(project);

        if (!lastAutoSaveOK || (now - lastAutoSaveOK > me.minAutoSaveInterval)) {
            ws.send(JSON.stringify({
                command : 'versionAutoSaveOK',
                data    : { project }
            }));
            me.lastAutoSaveOK.set(project, now);
        }
    }

    //#endregion

    // When client requests dataset we subscribe him to that project updates
    subscribeClientToProject(ws, project) {
        // First unsubscribe current client from all other datasets
        Object.values(this.projectSubscribersMap).forEach(map => map.delete(ws));

        // Second add current client to the new project subscriptions
        const subscribers = this.projectSubscribersMap[project] = (this.projectSubscribersMap[project] || new Set());

        if (!(project in this.projectRevisionsMap)) {
            this.projectRevisionsMap[project] = { counter : 1, revisions : [] };
        }

        subscribers.add(ws);
    }

    isClientSubscribedToProject(ws, project) {
        return !!this.projectSubscribersMap[project]?.has(ws);
    }
}

module.exports = { MessageHandler };
