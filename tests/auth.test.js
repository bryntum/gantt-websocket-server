const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { awaitNextMessage } = require('./util.js');

const server = new WebSocketServer({ port : 8081 });

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

test('On login should return list of project user is authorized to access', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command  : 'login',
        login    : 'admin',
        password : 'admin'
    };

    const expected = expect.objectContaining({
        command  : 'login',
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

    const got = await awaitNextMessage(ws, request);

    expect(got).toEqual(expected);

    ws.terminate();
});
