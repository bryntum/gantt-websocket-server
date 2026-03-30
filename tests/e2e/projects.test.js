const WebSocket = require('ws');
const { WebSocketServer } = require('../../src/server.js');
const { awaitNextMessage, awaitNextCommand, awaitAuth, awaitDataset } = require('../util.js');

const server = new WebSocketServer({ port : 8088 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should not load dataset without id', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const response = await awaitNextCommand(ws, 'dataset', { command : 'dataset', data : {} });

    expect(response.error).toBeDefined();

    ws.terminate();
});

test('Unauthorized user should not be able to load project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws, 'foo', '');

    const response = await awaitNextCommand(ws, 'dataset', { command : 'dataset', data : { project : 3 } });

    expect(response.error).toBeDefined();

    ws.terminate();
});

test('User should not receive project change if not subscribed', async () => {
    const ws = new WebSocket(server.address);
    const ws1 = new WebSocket(server.address);

    await awaitDataset(ws, 1);
    await awaitAuth(ws1, 'alex', 'alex');

    const [, response] = await Promise.allSettled([
        awaitNextCommand(ws, 'project_change', {
            command : 'project_change',
            data    : {
                project   : 1,
                revisions : [{
                    revision : 'local-1',
                    changes  : { tasks : { updated : [{ id : 'events-1' }] } }
                }]
            }
        }),
        awaitNextMessage(ws1)
    ]);

    // ws1 should not receive the message (timeout)
    expect(response.status).toBe('rejected');

    ws.terminate();
    ws1.terminate();
});

test('User should not be able to make changes to unsubscribed project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const response = await awaitNextCommand(ws, 'project_change', {
        command : 'project_change',
        data    : { project : 1, revisions : [{ revision : 'local-1', changes : {} }] }
    });

    expect(response.error).toContain('Subscription to project is required');

    ws.terminate();
});

test('User should not be able to reset unsubscribed project', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const response = await awaitNextCommand(ws, 'reset', { command : 'reset', data : { project : 1 } });

    expect(response.error).toContain('Subscription to project is required');

    ws.terminate();
});

test('Should not receive dataset if not subscribed to the project', async () => {
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await awaitDataset(ws1, 1);
    await awaitDataset(ws2, 2);

    const [, response] = await Promise.allSettled([
        awaitNextCommand(ws1, 'dataset', { command : 'reset', data : { project : 1 } }),
        awaitNextMessage(ws2)
    ]);

    // ws2 (subscribed to project 2) should not get project 1 reset
    expect(response.status).toBe('rejected');

    ws1.terminate();
    ws2.terminate();
});
