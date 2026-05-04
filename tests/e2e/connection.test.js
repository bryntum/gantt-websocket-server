const WebSocket = require('ws');
const { WebSocketServer } = require('../../src/server.js');
const { awaitNextMessage, awaitNextCommand, awaitAuth } = require('../util.js');

const server = new WebSocketServer({ port : 8083 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should check user login/password', async () => {
    const ws = new WebSocket(server.address);

    const response = await awaitNextMessage(ws, { command : 'login', data : { login : 'admin', password : '' } });

    expect(response).toEqual({ command : 'login', error : 'Wrong username/password' });

    ws.terminate();
});

test('Should not allow empty/non-string login', async () => {
    const ws = new WebSocket(server.address);

    let response = await awaitNextMessage(ws, { command : 'login', data : { login : '', password : '' } });

    expect(response.error).toBeDefined();

    response = await awaitNextMessage(ws, { command : 'login', data : { login : 123 } });

    expect(response.error).toBeDefined();

    ws.terminate();
});

test('Should let in anonymous user', async () => {
    const ws = new WebSocket(server.address);

    const response = await awaitNextCommand(ws, 'login', { command : 'login', data : { login : 'foo', password : '' } });

    expect(response.data.userName).toBe('foo');

    ws.terminate();
});

test('Should return list of projects user is authorized to access', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const response = await awaitNextCommand(ws, 'projects', { command : 'projects' });

    expect(response.data.projects.length).toBe(3);

    ws.terminate();
});

test('Should broadcast logout on close', async () => {
    const ws = new WebSocket(server.address);
    const ws1 = new WebSocket(server.address);

    await awaitAuth(ws);
    await awaitAuth(ws1, 'alex', 'alex');

    const promise = awaitNextCommand(ws, 'logout');

    ws1.terminate();

    const response = await promise;

    expect(response.data.userName).toBe('alex');

    ws.terminate();
});

test('Should broadcast logout on logout command', async () => {
    const ws = new WebSocket(server.address);
    const ws1 = new WebSocket(server.address);

    await awaitAuth(ws);
    await awaitAuth(ws1, 'alex', 'alex');

    const [response] = await Promise.all([
        awaitNextCommand(ws1, 'logout', { command : 'logout' }),
        awaitNextCommand(ws, 'logout')
    ]);

    expect(response.command).toBe('logout');

    ws.terminate();
});

test('None of the commands should work if user is not logged', async () => {
    const ws = new WebSocket(server.address);

    ws.expectError = true;

    for (const command of ['logout', 'projects', 'reset', 'dataset', 'project_change']) {
        const response = await awaitNextMessage(ws, { command, data : { project : 1 } });

        expect(response.error).toBeDefined();
    }

    ws.terminate();
});

test('Login procedure should have specific amount of messages', async () => {
    const ws = new WebSocket(server.address);
    const messages = [];
    let resolver;
    const done = new Promise(resolve => {
 resolver = resolve; 
});

    ws.on('open', () => {
        ws.on('message', data => {
            messages.push(JSON.parse(data));

            if (messages.length >= 2) {
                resolver();
            }
        });

        ws.send(JSON.stringify({ command : 'login', data : { login : 'admin', password : 'admin' } }));
    });

    await done;

    // login response + users broadcast
    expect(messages.length).toBe(2);
    expect(messages[0].command).toBe('login');
    expect(messages[1].command).toBe('users');

    ws.terminate();
});

test('Should not send messages to connected but unauthenticated users', async () => {
    const ws = new WebSocket(server.address);
    const unauthenticated = new WebSocket(server.address);

    unauthenticated.expectError = true;

    await awaitAuth(ws);

    const ws2 = new WebSocket(server.address);

    await awaitAuth(ws2, 'alex', 'alex');

    // Unauthenticated client should not have received any messages
    const response = await Promise.race([
        new Promise(resolve => {
            unauthenticated.on('message', data => resolve(JSON.parse(data)));
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 200))
    ]);

    expect(response).toBeNull();

    ws.terminate();
    ws2.terminate();
    unauthenticated.terminate();
});
