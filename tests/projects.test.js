const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { awaitNextCommand, awaitAuth } = require('./util.js');

const server = new WebSocketServer({ port : 8085 });

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
        awaitAuth(ws2, 'maxim', 'maxim'),
    ]);

    // ws2.on('message', msg => console.log(msg));

    await awaitNextCommand(ws1, 'dataset', {
        command : 'dataset',
        // user foo is not authorized to do this
        project : 1
    });

    const [{ value : response1 }, { reason: response2 }] = await Promise.allSettled([
        awaitNextCommand(ws1, 'projectChange', { command : 'projectChange', project : 1, changes : { tasks : { added : [{ $PhantomId : '_generated1' }]} } }),
        awaitNextCommand(ws2, 'projectChange')
    ]);

    expect(response1).toEqual(expect.objectContaining({ command : 'projectChange', changes : expect.any(Object) }));
    expect(response2).toEqual('timeout');

    ws1.terminate();
    ws2.terminate();
});

test('User should not be able to make changes to project he has not loaded', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const got = await awaitNextCommand(ws, 'projectChange', { command : 'projectChange', project : 1, changes : {}});

    expect(got).toEqual({ command : 'projectChange', project : 1, error : expect.stringMatching(/project/i) });

    ws.terminate();
});

test('User should not be able to reset project he has not loaded', async () => {
    const ws = new WebSocket(server.address);

    await awaitAuth(ws);

    const [{ value : response1 }, { reason : response2 }] = await Promise.allSettled([
        awaitNextCommand(ws, 'reset', { command : 'reset', project : 1 }),
        awaitNextCommand(ws, 'dataset')
    ]);

    expect(response1).toEqual({ command : 'reset', project : 1, error : expect.stringMatching(/project/i) });
    expect(response2).toEqual('timeout');

    ws.terminate();
});

test('User should not receive dataset if he is not subscribed to the project', async () => {
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitAuth(ws1),
        awaitAuth(ws2)
    ]);

    await awaitNextCommand(ws1, 'dataset', { command : 'dataset', project : 1 });

    const [response1, { reason : response2 }] = await Promise.allSettled([
        awaitNextCommand(ws1, 'dataset', { command : 'reset', project : 1 }),
        awaitNextCommand(ws2, 'dataset')
    ]);

    expect(response1).toEqual(expect.objectContaining({ value : { command : 'dataset', project : 1, dataset : expect.anything() } }));
    expect(response2).toEqual('timeout');

    ws1.terminate();
});

// test('Unauthorized user should not receive project updates', async () => {
//     const ws1 = new WebSocket(server.address);
//     const ws2 = new WebSocket(server.address);
//     const ws3 = new WebSocket(server.address);
//
//     await Promise.all([
//         awaitAuth(ws1),
//         awaitAuth(ws2, 'alex', 'alex'),
//         awaitAuth(ws3, 'foo')
//     ]);
//
//     await Promise.all([
//         awaitNextCommand(ws1, 'dataset', { command : 'dataset', project : 2 }),
//         awaitNextCommand(ws2, 'dataset', { command : 'dataset', project : 2 })
//     ]);
//
//     const messages = [];
//
//     ws3.on('message', msg => messages.push(msg));
//
//     const [response1, response2] = await Promise.all([
//         awaitNextCommand(ws1, 'projectChange', {
//             command : 'projectChange',
//             // user foo is not authorized to do this
//             project : 2,
//             changes : {
//                 tasks : {
//                     added : [{ $PhantomId : '_generated1' }]
//                 }
//             }
//         }),
//         awaitNextCommand(ws2, 'projectChange')
//     ]);
//
//     await awaitTimeout();
//
//     expect(response1).toEqual({ command : 'projectChange', project : 2, changes : { tasks : expect.any(Object)} });
//     expect(response2).toEqual({ command : 'projectChange', project : 2, changes : { tasks : expect.any(Object)} });
//
//     expect(messages).toEqual([]);
//
//     ws1.terminate();
//     ws2.terminate();
//     ws3.terminate();
// });
