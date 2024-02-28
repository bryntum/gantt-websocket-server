const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { awaitNextCommand, awaitAuth } = require('./util.js');

// address 8084 is in use in GitHub actions?
const server = new WebSocketServer({ port : 8087 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Unauthorized user should not be able load project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws, 'foo');

    const got = await awaitNextCommand(ws, 'dataset', {
        command : 'dataset',
        data    : {
            // user foo is not authorized to do this
            project : 3
        }
    });

    expect(got).toEqual({ command : 'dataset', error : expect.any(String) });

    ws.terminate();
});

test('Unauthorized user should not be able to make changes to project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws, 'foo');

    const got = await awaitNextCommand(ws, 'project_change', {
        command : 'project_change',
        data    : {
            // user foo is not authorized to do this
            project   : 3,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks : {
                            added : [{ $PhantomId : '_generated1' }]
                        }
                    }
                }
            ]
        }
    });

    expect(got).toEqual({ command : 'project_change', error : expect.any(String) });

    ws.terminate();
});

test('Unauthorized user should not be able to reset project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws, 'foo');

    const got = await awaitNextCommand(ws, 'reset', {
        command : 'reset',
        data    : {
            // user foo is not authorized to do this
            project : 3
        }
    });

    expect(got).toEqual({ command : 'reset', error : expect.any(String) });

    ws.terminate();
});
