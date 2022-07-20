const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { awaitTimeout, awaitNextMessage, awaitNextCommand, waitForConnectionOpen, awaitAuth } = require('./util.js');

const server = new WebSocketServer({ port : 8083 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should check user login/password', async () => {
    const ws = new WebSocket(server.address);

    const got = await awaitNextMessage(ws, { command : 'login', login : 'admin', password : '' });

    expect(got).toEqual({ command : 'login', error : expect.any(String) });

    ws.terminate();
});

test('Should not allow empty/non-string login', async () => {
    const ws = new WebSocket(server.address);

    let got = await awaitNextCommand(ws, 'login', { command : 'login', login : '', password : '' });

    expect(got).toEqual({ command : 'login', error : expect.any(String) });

    got = await awaitNextCommand(ws, 'login', { command : 'login', login : true, password : '' });

    expect(got).toEqual({ command : 'login', error : expect.any(String) });

    ws.terminate();
});

test('Should let in anonymous user', async () => {
    const ws = new WebSocket(server.address);

    const got = await awaitAuth(ws, 'foo');

    expect(got).toEqual({ command : 'login' });

    ws.terminate();
});

test('Should return list of project user is authorized to access', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const got = await awaitNextCommand(ws, 'projects', { command : 'projects' });

    expect(got).toEqual(expect.objectContaining({
        command  : 'projects',
        projects : expect.arrayContaining([
            {
                id : 1,
                name : 'SaaS'
            },
            {
                id : 2,
                name : 'Website'
            },
            {
                id : 3,
                name : 'Backend'
            }
        ])
    }));

    ws.terminate();
});

test('Should broadcast logout on close', async () => {
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await awaitAuth(ws1, 'foo');
    await awaitAuth(ws2, 'bar');

    const [logout] = await Promise.all([
        awaitNextCommand(ws1, 'logout'),
        ws2.close()
    ]);

    expect(logout).toEqual({ command : 'logout', userName : 'bar' });

    ws2.terminate();
    ws1.terminate();
});

test('Should broadcast logout on logout', async () => {
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitAuth(ws1, 'foo'),
        awaitAuth(ws2, 'bar')
    ]);

    let counter = 0;

    ws2.on('message', () => ++counter);

    const [result1, result2] = await Promise.allSettled([
        awaitNextCommand(ws1, 'logout'),
        awaitNextCommand(ws2, 'logout', { command : 'logout' })
    ]);

    expect(result1).toEqual(expect.objectContaining({ value : { command : 'logout', userName : 'bar' } }));
    expect(result2).not.toEqual(expect.objectContaining({ status : 'rejected', reason : 'timeout' }));
    expect(counter).toEqual(1);

    ws2.terminate();
    ws1.terminate();
});

test('None of the commands should work if user is not logged', async () => {
    const ws = new WebSocket(server.address);

    for (const command of [
        'logout',
        'projects',
        'reset',
        'dataset',
        'projectChange'
    ]) {
        const got = await awaitNextMessage(ws, { command });

        expect(got).toEqual({ command, error : 'Authentication required' });
    }

    ws.terminate();
});

test('Login procedure should have specific amount of messages', async () => {
    const ws = new WebSocket(server.address);

    await waitForConnectionOpen(ws);

    const messages = [];

    ws.on('message', msg => messages.push(JSON.parse(msg)));

    await awaitAuth(ws);

    await awaitTimeout();

    expect(messages).toEqual([
        { command : 'login' },
        { command : 'users', users : ['admin'] }
    ]);

    ws.terminate();
});

test('Should not send messages to connected but unauthenticated users', async () => {
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await waitForConnectionOpen(ws2);

    let counter = 0;

    ws2.on('message', () => counter++);

    await awaitAuth(ws1);

    // Wait for some time to receive all possible messages
    await awaitTimeout(500);

    expect(counter).toBe(0);

    ws2.terminate();
    ws1.terminate();
});
