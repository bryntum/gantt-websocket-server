const WebSocket = require('ws');
const { WebSocketServer } = require('../server.js');
const { waitForConnectionOpen, awaitNextMessage } = require('./util.js');

const server = new WebSocketServer({ port : 8081 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should greet new user', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command  : 'hello',
        userName : 'Foo'
    };

    const expected = expect.objectContaining({
        command : 'users',
        users   : expect.arrayContaining(['Foo'])
    });

    const got = await awaitNextMessage(ws, request);

    expect(got).toEqual(expected);

    ws.terminate();
});

test('Should generate ids for new records', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command : 'projectChange',
        changes : {
            tasks : {
                added : [{ $PhantomId : 'newrec1' }]
            },
            resources : {
                added : [{ $PhantomId : 'newrec2' }]
            },
            dependencies : {
                added : [{ $PhantomId : 'newrec3' }]
            },
            assignments : {
                added : [{ $PhantomId : 'newrec4' }]
            }
        }
    };

    const expected = expect.objectContaining({
        command  : 'projectChange',
        changes  : {
            tasks : {
                added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
            },
            resources : {
                added : [expect.objectContaining({ $PhantomId : 'newrec2', id : expect.any(Number) })]
            },
            dependencies : {
                added : [expect.objectContaining({ $PhantomId : 'newrec3', id : expect.any(Number) })]
            },
            assignments : {
                added : [expect.objectContaining({ $PhantomId : 'newrec4', id : expect.any(Number) })]
            }
        }
    });

    const got = await awaitNextMessage(ws, request);

    expect(got).toEqual(expected);

    ws.terminate();
});

test('Should broadcast ids for new records among clients', async () => {
    const ws = new WebSocket(server.address);
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    const request = {
        command : 'projectChange',
        changes : {
            tasks : {
                added : [{ $PhantomId : 'newrec1' }]
            },
            resources : {
                added : [{ $PhantomId : 'newrec2' }]
            },
            dependencies : {
                added : [{ $PhantomId : 'newrec3' }]
            },
            assignments : {
                added : [{ $PhantomId : 'newrec4' }]
            }
        }
    };

    const expected = expect.objectContaining({
        command : 'projectChange',
        changes : {
            tasks : {
                added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
            },
            resources : {
                added : [expect.objectContaining({ $PhantomId : 'newrec2', id : expect.any(Number) })]
            },
            dependencies : {
                added : [expect.objectContaining({ $PhantomId : 'newrec3', id : expect.any(Number) })]
            },
            assignments : {
                added : [expect.objectContaining({ $PhantomId : 'newrec4', id : expect.any(Number) })]
            }
        }
    });

    await Promise.allSettled([
        waitForConnectionOpen(ws),
        waitForConnectionOpen(ws1),
        waitForConnectionOpen(ws2)
    ]);

    const [response1, response2, response3] = await Promise.allSettled([
        awaitNextMessage(ws, request),
        awaitNextMessage(ws1),
        awaitNextMessage(ws2)
    ]);

    expect(response1.value).toEqual(expected);
    expect(response2.value).toEqual(expected);
    expect(response3.value).toEqual(expected);

    ws.terminate();
    ws1.terminate();
    ws2.terminate();
});

test('Should get dataset from server', async () => {
    const ws = new WebSocket(server.address);

    await waitForConnectionOpen(ws);

    const { dataset } = await awaitNextMessage(ws, { command : 'reset' });

    expect(dataset).toEqual({
        tasksData        : expect.arrayContaining([expect.objectContaining({
            id   : expect.anything(),
            name : expect.any(String)
        })]),
        resourcesData    : expect.arrayContaining([expect.objectContaining({
            id   : expect.anything(),
            name : expect.any(String)
        })]),
        dependenciesData : expect.arrayContaining([expect.objectContaining({
            id       : expect.anything(),
            fromTask : expect.anything(),
            toTask   : expect.anything()
        })]),
        assignmentsData  : expect.arrayContaining([expect.objectContaining({
            id       : expect.anything(),
            event    : expect.anything(),
            resource : expect.anything()
        })]),
        calendarsData    : expect.arrayContaining([expect.objectContaining({
            id        : expect.any(String),
            intervals : expect.anything()
        })])
    });

    ws.terminate();
});
