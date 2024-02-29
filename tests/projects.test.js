const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { awaitNextCommand, awaitAuth, awaitDataset, waitForConnectionOpen, awaitNextMessage } = require('./util.js');

const server = new WebSocketServer({ port : 8088 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should not load dataset without id', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const got = await awaitNextCommand(ws, 'dataset', { command : 'dataset' });

    expect(got).toEqual({ command : 'dataset', error : expect.stringMatching(/project/i) });

    ws.terminate();
});

test('User should not receive project change message if he has not loaded any projects', async () => {
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitAuth(ws1, 'alex', 'alex'),
        awaitAuth(ws2, 'maxim', 'maxim')
    ]);

    await awaitNextCommand(ws1, 'dataset', {
        command : 'dataset',
        data    : {
            // user foo is not authorized to do this
            project : 1
        }
    });

    const [{ value : response1 }, { reason : response2 }] = await Promise.allSettled([
        awaitNextCommand(ws1, 'project_change', {
            command : 'project_change',
            data    : {
                project   : 1,
                revisions : [
                    {
                        revision : 'local-1',
                        changes  : { tasks : { added : [{ $PhantomId : '_generated1' }] } }
                    }
                ]
            }
        }),
        awaitNextCommand(ws2, 'project_change')
    ]);

    expect(response1).toEqual(expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws1.clientId,
                    changes       : expect.any(Object)
                }
            ]
        }
    }));
    expect(response2).toMatch(/timeout/);

    ws1.terminate();
    ws2.terminate();
});

test('User should not be able to make changes to project he has not loaded', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const got = await awaitNextCommand(ws, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {}
                }
            ]
        }
    });

    expect(got).toEqual({
        command : 'project_change',
        data    : {
            project : 1
        },
        error : expect.stringMatching(/project/i) });

    ws.terminate();
});

test('User should not be able to reset project he has not loaded', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const [{ value : response1 }, { reason : response2 }] = await Promise.allSettled([
        awaitNextCommand(ws, 'reset', { command : 'reset', data : { project : 1 } }),
        awaitNextCommand(ws, 'dataset')
    ]);

    expect(response1).toEqual({ command : 'reset', data : { project : 1 }, error : expect.stringMatching(/project/i) });
    expect(response2).toMatch(/timeout/);

    ws.terminate();
});

test('User should not receive dataset if he is not subscribed to the project', async () => {
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws1, 1),
        awaitAuth(ws2)
    ]);

    const [response1, { reason : response2 }] = await Promise.allSettled([
        awaitNextCommand(ws1, 'dataset', { command : 'reset', data : { project : 1 } }),
        awaitNextCommand(ws2, 'dataset')
    ]);

    expect(response1).toEqual(expect.objectContaining({
        value : {
            command : 'dataset',
            data    : {
                project : 1,
                dataset : expect.anything()
            }
        }
    }));
    expect(response2).toMatch(/timeout/);

    ws1.terminate();
});

test('Should notify subscribers about project reset', async () => {
    const clientMap = {};

    const ws1 = clientMap.ws1 = new WebSocket(server.address);
    const ws2 = clientMap.ws2 = new WebSocket(server.address);
    const ws3 = clientMap.ws3 = new WebSocket(server.address);
    const ws4 = clientMap.ws4 = new WebSocket(server.address);
    const ws5 = clientMap.ws5 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws1, 3),
        awaitDataset(ws2, 2),
        awaitDataset(ws3, 1),
        // this one should not get any project updates
        awaitAuth(ws4),
        // this one is not even authenticated
        waitForConnectionOpen(ws5)
    ]);

    const counterMap = Object.entries(clientMap).reduce((result, [key, value]) => {
        result[key] = 0;

        value.on('message', () => result[key]++);

        return result;
    }, {});

    // Reset dataset for all projects
    server.resetEntireDataset();

    const [response1, response2, response3, response4, response5] = await Promise.allSettled([
        awaitNextMessage(ws1, null, true),
        awaitNextMessage(ws2, null, true),
        awaitNextMessage(ws3, null, true),
        awaitNextMessage(ws4, null, true),
        awaitNextMessage(ws5, null, true)
    ]);

    expect(response1).toEqual(expect.objectContaining({
        value : {
            command : 'dataset',
            data    : {
                project : 3,
                dataset : expect.anything()
            }
        }
    }));
    expect(response2).toEqual(expect.objectContaining({
        value : {
            command : 'dataset',
            data    : {
                project : 2,
                dataset : expect.anything()
            }
        }
    }));
    expect(response3).toEqual(expect.objectContaining({
        value : {
            command : 'dataset',
            data    : {
                project : 1,
                dataset : expect.anything()
            }
        }
    }));
    expect(response4).toEqual(expect.objectContaining({ reason : expect.stringMatching(/timeout/) }));
    expect(response5).toEqual(expect.objectContaining({ reason : expect.stringMatching(/timeout/) }));

    // Every authorized client should receive 2 events: dataset and reset, unauthorized clients get no data
    expect(counterMap).toEqual({ ws1 : 2, ws2 : 2, ws3 : 2, ws4 : 0, ws5 : 0 });
});
