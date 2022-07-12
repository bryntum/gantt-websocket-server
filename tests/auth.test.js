const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { awaitTimeout, awaitNextMessage, awaitNextCommand, waitForConnectionOpen, awaitAuth } = require('./util.js');

const server = new WebSocketServer({ port : 8083 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should check user login/password', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command  : 'login',
        login    : 'admin',
        password : ''
    };

    const got = await awaitNextMessage(ws, request);

    expect(got).toEqual({ command : 'login', error : expect.any(String) });

    ws.terminate();
});

test('Should let in anonymous user', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command  : 'login',
        login    : 'foo',
        password : ''
    };

    const got = await awaitNextMessage(ws, request);

    expect(got).toEqual({ command : 'login' });

    ws.terminate();
});

test('On login should return list of project user is authorized to access', async () => {
    const ws = new WebSocket(server.address);

    const expected = expect.objectContaining({
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
    });

    await awaitNextMessage(ws, {
        command  : 'login',
        login    : 'admin',
        password : 'admin'
    });

    const promise = awaitNextCommand(ws, 'projects');

    await Promise.all([
        promise,
        awaitNextMessage(ws, { command : 'projects' })
    ]);

    const got = await promise;

    expect(got).toEqual(expected);

    ws.terminate();
});

test('Should broadcast logout on close', async () => {
    const client1 = new WebSocket(server.address);

    await awaitNextMessage(client1, { command : 'login', login : 'foo' });

    const client2 = new WebSocket(server.address);

    await awaitNextMessage(client2, { command : 'login', login : 'bar' });

    const logoutMessagePromise = new Promise(resolve => {
        client1.on('message', message => {
            const data = JSON.parse(message);

            if (data.command === 'logout') {
                resolve(data);
            }
        });
    });

    client2.close();

    const logout = await logoutMessagePromise;

    expect(logout).toEqual({ command : 'logout', userName : 'bar' });

    client2.terminate();
    client1.terminate();
});

test('Should broadcast logout on logout', async () => {
    const client1 = new WebSocket(server.address);

    await awaitNextMessage(client1, { command : 'login', login : 'foo' });

    const client2 = new WebSocket(server.address);

    await awaitNextMessage(client2, { command : 'login', login : 'bar' });

    const logoutMessagePromise = new Promise(resolve => {
        client1.on('message', message => {
            const data = JSON.parse(message);

            if (data.command === 'logout') {
                resolve(data);
            }
        });
    });

    await awaitNextMessage(client2, { command : 'logout' });

    const logout = await logoutMessagePromise;

    expect(logout).toEqual({ command : 'logout', userName : 'bar' });

    client2.terminate();
    client1.terminate();
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

    ws.send(JSON.stringify({ command : 'login', login : 'admin', password : 'admin' }));

    await awaitTimeout(1000);

    expect(messages).toEqual([
        { command : 'login' },
        { command : 'users', users : ['admin'] }
    ]);

    ws.terminate();
});

test('Should not send messages to connected but unauthenticated users', async () => {
    const client1 = new WebSocket(server.address);

    const client2 = new WebSocket(server.address);

    await waitForConnectionOpen(client2);

    let counter = 0;

    client2.on('message', () => counter++);

    await awaitAuth(client1);

    // Wait for some time to receive all possible messages
    await awaitTimeout(500);

    expect(counter).toBe(0);

    client2.terminate();
    client1.terminate();
});
