const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { awaitNextCommand, awaitAuth } = require('./util.js');

const server = new WebSocketServer({ port : 8084 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Unauthorized user should not be able load project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws, 'foo');

    const got = await awaitNextCommand(ws, 'dataset', {
        command : 'dataset',
        // user foo is not authorized to do this
        project : 3
    });

    expect(got).toEqual({ command : 'dataset', error : expect.any(String) });

    ws.terminate();
});

test('Unauthorized user should not be able to make changes to project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws, 'foo');

    const got = await awaitNextCommand(ws, 'projectChange', {
        command : 'projectChange',
        // user foo is not authorized to do this
        project : 3,
        changes : {
            tasks : {
                added : [{ $PhantomId : '_generated1' }]
            }
        }
    });

    expect(got).toEqual({ command : 'projectChange', error : expect.any(String) });

    ws.terminate();
});

test('Unauthorized user should not be able to rest project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws, 'foo');

    const got = await awaitNextCommand(ws, 'reset', {
        command : 'reset',
        // user foo is not authorized to do this
        project : 3
    });

    expect(got).toEqual({ command : 'reset', error : expect.any(String) });

    ws.terminate();
});
