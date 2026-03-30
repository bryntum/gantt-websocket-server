const { MessageHandler } = require('../../src/server/MessageHandler.js');

function createMockWs(id = 'client-1', userName = null) {
    const messages = [];

    return {
        id,
        userName,
        readyState  : 1, // OPEN
        OPEN        : 1,
        _socket     : { remoteAddress : '127.0.0.1' },
        send        : jest.fn(msg => messages.push(JSON.parse(msg))),
        close       : jest.fn(),
        messages,
        getSentCommand(command) {
            return messages.find(m => m.command === command);
        }
    };
}

let handler;

beforeEach(() => {
    handler = new MessageHandler({ autoSaveIntervalMins : 60 });
    handler.wss = { clients : new Set() };
});

describe('getHandler', () => {
    test('Should return handler for known commands', () => {
        expect(handler.getHandler('login')).toBeInstanceOf(Function);
        expect(handler.getHandler('logout')).toBeInstanceOf(Function);
        expect(handler.getHandler('projects')).toBeInstanceOf(Function);
        expect(handler.getHandler('dataset')).toBeInstanceOf(Function);
        expect(handler.getHandler('project_change')).toBeInstanceOf(Function);
        expect(handler.getHandler('version')).toBeInstanceOf(Function);
    });

    test('Should return default handler for unknown commands', () => {
        const h = handler.getHandler('nonexistent');

        expect(h).toBeInstanceOf(Function);
    });
});

describe('handleLogin', () => {
    test('Should send login response with client ID', () => {
        const ws = createMockWs('client-1');

        handler.wss.clients.add(ws);
        handler.handleLogin(ws, { login : 'admin', password : 'admin' });

        const response = ws.getSentCommand('login');

        expect(response).toEqual({
            command : 'login',
            data    : { client : 'client-1', userName : 'admin' }
        });
        expect(ws.userName).toBe('admin');
    });

    test('Should send error for wrong credentials', () => {
        const ws = createMockWs();

        handler.handleLogin(ws, { login : 'admin', password : 'wrong' });

        const response = ws.getSentCommand('login');

        expect(response).toEqual({
            command : 'login',
            error   : 'Wrong username/password'
        });
    });
});

describe('handleProjects', () => {
    test('Should return authorized projects for admin', () => {
        const ws = createMockWs('client-1', 'admin');

        handler.handleProjects(ws);

        const response = ws.getSentCommand('projects');

        expect(response.data.projects).toEqual([
            { id : 1, name : 'SaaS' },
            { id : 2, name : 'Website' },
            { id : 3, name : 'Backend' }
        ]);
    });

    test('Should return limited projects for anonymous user', () => {
        const ws = createMockWs('client-1', 'unknown');

        handler.handleProjects(ws);

        const response = ws.getSentCommand('projects');

        expect(response.data.projects).toEqual([
            { id : 1, name : 'SaaS' }
        ]);
    });
});

describe('handleDataset', () => {
    test('Should send dataset and subscribe client to project', () => {
        const ws = createMockWs('client-1', 'admin');

        handler.handleDataset(ws, { project : 1 });

        const response = ws.getSentCommand('dataset');

        expect(response.data.project).toBe(1);
        expect(response.data.dataset).toBeDefined();
        expect(response.data.dataset.tasksData).toBeDefined();
    });

    test('Should subscribe client to project updates', () => {
        const ws = createMockWs('client-1', 'admin');

        handler.handleDataset(ws, { project : 1 });

        expect(handler.isClientSubscribedToProject(ws, 1)).toBe(true);
    });

    test('Should unsubscribe from previous project when loading new one', () => {
        const ws = createMockWs('client-1', 'admin');

        handler.handleDataset(ws, { project : 1 });

        expect(handler.isClientSubscribedToProject(ws, 1)).toBe(true);

        handler.handleDataset(ws, { project : 2 });

        expect(handler.isClientSubscribedToProject(ws, 1)).toBe(false);
        expect(handler.isClientSubscribedToProject(ws, 2)).toBe(true);
    });
});

describe('handleVersion', () => {
    test('Should return server version', () => {
        const ws = createMockWs();

        handler.handleVersion(ws);

        const response = ws.getSentCommand('version');

        expect(response.data.version).toEqual(expect.any(String));
    });
});

describe('requireAuth', () => {
    test('Should block unauthenticated access', () => {
        const ws = createMockWs('client-1', null);

        // Try to call a protected handler via the handlers map
        const projectsHandler = handler.handlersMap['projects'];

        projectsHandler.call(handler, ws, {}, 'projects');

        const response = ws.getSentCommand('projects');

        expect(response.error).toBe('Authentication required');
    });
});

describe('requireSubscription', () => {
    test('Should block access without project subscription', () => {
        const ws = createMockWs('client-1', 'admin');

        const changeHandler = handler.handlersMap['project_change'];

        changeHandler.call(handler, ws, { project : 1 }, 'project_change');

        const response = ws.getSentCommand('project_change');

        expect(response.error).toContain('Subscription to project is required');
    });
});

describe('getNextRevision', () => {
    test('Should return incrementing revision strings', () => {
        handler.projectRevisionsMap[1] = { counter : 1, revisions : [] };

        expect(handler.getNextRevision(1)).toBe('server-1');
        expect(handler.getNextRevision(1)).toBe('server-2');
        expect(handler.getNextRevision(1)).toBe('server-3');
    });
});

describe('subscribeClientToProject', () => {
    test('Should track subscriptions', () => {
        const ws1 = createMockWs('client-1');
        const ws2 = createMockWs('client-2');

        handler.subscribeClientToProject(ws1, 1);
        handler.subscribeClientToProject(ws2, 1);

        expect(handler.projectSubscribersMap[1].size).toBe(2);
    });

    test('Should unsubscribe from previous project', () => {
        const ws = createMockWs('client-1');

        handler.subscribeClientToProject(ws, 1);
        handler.subscribeClientToProject(ws, 2);

        expect(handler.projectSubscribersMap[1].has(ws)).toBe(false);
        expect(handler.projectSubscribersMap[2].has(ws)).toBe(true);
    });
});
