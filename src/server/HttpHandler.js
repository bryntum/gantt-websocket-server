const fs   = require('fs');
const path = require('path');

const MIME_TYPES = {
    '.html' : 'text/html',
    '.js'   : 'application/javascript',
    '.css'  : 'text/css',
    '.json' : 'application/json',
    '.png'  : 'image/png',
    '.svg'  : 'image/svg+xml',
    '.ico'  : 'image/x-icon'
};

const UI_DIR = path.resolve(__dirname, '../ui');

const READY_STATES = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];

class HttpHandler {
    constructor(server) {
        this.server = server;
    }

    handleRequest(req, res) {
        const pathname = new URL(req.url, 'http://localhost').pathname;

        if (pathname.startsWith('/api/')) {
            return this.handleApi(pathname, req, res);
        }

        return this.serveStatic(pathname, res);
    }

    serveStatic(pathname, res) {
        if (pathname === '/') {
            pathname = '/index.html';
        }

        // Prevent directory traversal
        const filePath = path.join(UI_DIR, path.normalize(pathname));

        if (!filePath.startsWith(UI_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }

            res.writeHead(200, { 'Content-Type' : contentType });
            res.end(data);
        });
    }

    handleApi(pathname, req, res) {
        res.setHeader('Content-Type', 'application/json');

        try {
            let result;

            if (pathname === '/api/status') {
                result = this.getStatus();
            }
            else if (pathname === '/api/sessions') {
                result = this.getSessions();
            }
            else if (pathname === '/api/projects') {
                result = this.getProjects();
            }
            else if (pathname.match(/^\/api\/projects\/\d+$/)) {
                const id = parseInt(pathname.split('/').pop());
                result = this.getProjectDetails(id);
            }
            else if (pathname === '/api/messages') {
                result = this.getMessages();
            }
            else if (pathname === '/api/phantom-ids') {
                result = this.getPhantomIds();
            }
            else {
                res.writeHead(404);
                res.end(JSON.stringify({ error : 'Not found' }));
                return;
            }

            res.writeHead(200);
            res.end(JSON.stringify(result));
        }
        catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error : error.message }));
        }
    }

    getStatus() {
        return { port : this.server.port };
    }

    getSessions() {
        const sessions = [];

        this.server.wss.clients.forEach(client => {
            // Find which project this client is subscribed to
            let subscribedProject = null;

            for (const [project, subscribers] of Object.entries(this.server.projectSubscribersMap)) {
                if (subscribers.has(client)) {
                    subscribedProject = Number(project);
                    break;
                }
            }

            sessions.push({
                id                : client.id,
                userName          : client.userName || null,
                readyState        : READY_STATES[client.readyState] || 'UNKNOWN',
                remoteAddress     : client._socket?.remoteAddress || 'unknown',
                subscribedProject
            });
        });

        return { count : sessions.length, sessions };
    }

    getProjects() {
        const server = this.server;
        const allProjects = server.dataHandler.storage.projects;

        const projects = allProjects.map(project => {
            const id = project.id;
            const subscribers = server.projectSubscribersMap[id];
            const revisions = server.projectRevisionsMap[id];

            // Get record counts from project data
            const stats = {};

            try {
                const data = server.dataHandler.getProjectData(id);

                if (data.tasksData) stats.tasks = data.tasksData.length;
                if (data.resourcesData) stats.resources = data.resourcesData.length;
                if (data.dependenciesData) stats.dependencies = data.dependenciesData.length;
                if (data.assignmentsData) stats.assignments = data.assignmentsData.length;
            }
            catch {
                // Project data may not be loaded yet
            }

            return {
                id,
                name            : project.name,
                subscriberCount : subscribers ? subscribers.size : 0,
                revisionCount   : revisions ? revisions.revisions.length : 0,
                stats
            };
        });

        return { projects };
    }

    getProjectDetails(id) {
        const server = this.server;
        const allProjects = server.dataHandler.storage.projects;
        const project = allProjects.find(p => p.id === id);

        if (!project) {
            throw new Error(`Project ${id} not found`);
        }

        const subscribers = [];
        const subscriberSet = server.projectSubscribersMap[id];

        if (subscriberSet) {
            subscriberSet.forEach(client => {
                subscribers.push({
                    id       : client.id,
                    userName : client.userName || null
                });
            });
        }

        const revisions = server.projectRevisionsMap[id]
            ? server.projectRevisionsMap[id].revisions
            : [];

        let data = {};

        try {
            data = server.dataHandler.getProjectData(id);
        }
        catch {
            // Project data may not be loaded
        }

        return {
            id,
            name : project.name,
            subscribers,
            revisions,
            data
        };
    }

    getMessages() {
        const logger = this.server.messageLogger;

        return {
            count    : logger.getCount(),
            messages : logger.getMessages()
        };
    }

    getPhantomIds() {
        const map = this.server.dataHandler.phantomIdMap;
        const mappings = [];

        map.forEach((realId, phantomId) => {
            mappings.push({ phantomId, realId });
        });

        return { count : mappings.length, mappings };
    }
}

module.exports = { HttpHandler };
