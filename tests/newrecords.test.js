const WebSocket = require('ws');
const { waitForConnectionOpen, awaitNextMessage } = require('./util.js');
const { WebSocketServer } = require('../src/server.js');

const server = new WebSocketServer({ port : 8082 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should respond to client if task was added', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command : 'projectChange',
        changes : {
            tasks : {
                added : [{ $PhantomId : 'newrec1' }]
            },
            resources : {
                updated : [{ id : 1 }]
            },
            dependencies : {
                updated : [{ id : 1 }]
            },
            assignments : {
                updated : [{ id : 1 }]
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
                updated : [expect.objectContaining({ id : 1 })]
            },
            dependencies : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            assignments : {
                updated : [expect.objectContaining({ id : 1 })]
            }
        }
    });

    await waitForConnectionOpen(ws);

    const response = await awaitNextMessage(ws, request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if resource was added', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command : 'projectChange',
        changes : {
            tasks : {
                updated : [{ id : 1 }]
            },
            resources : {
                added : [{ $PhantomId : 'newrec1' }]
            },
            dependencies : {
                updated : [{ id : 1 }]
            },
            assignments : {
                updated : [{ id : 1 }]
            }
        }
    };

    const expected = expect.objectContaining({
        command : 'projectChange',
        changes : {
            tasks : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            resources : {
                added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
            },
            dependencies : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            assignments : {
                updated : [expect.objectContaining({ id : 1 })]
            }
        }
    });

    await waitForConnectionOpen(ws);

    const response = await awaitNextMessage(ws, request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if dependency was added', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command : 'projectChange',
        changes : {
            tasks : {
                updated : [{ id : 1 }]
            },
            resources : {
                updated : [{ id : 1 }]
            },
            dependencies : {
                added : [{ $PhantomId : 'newrec1' }]
            },
            assignments : {
                updated : [{ id : 1 }]
            }
        }
    };

    const expected = expect.objectContaining({
        command : 'projectChange',
        changes : {
            tasks : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            resources : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            dependencies : {
                added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
            },
            assignments : {
                updated : [expect.objectContaining({ id : 1 })]
            }
        }
    });

    await waitForConnectionOpen(ws);

    const response = await awaitNextMessage(ws, request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if assignment was added', async () => {
    const ws = new WebSocket(server.address);

    const request = {
        command : 'projectChange',
        changes : {
            tasks : {
                updated : [{ id : 1 }]
            },
            resources : {
                updated : [{ id : 1 }]
            },
            dependencies : {
                updated : [{ id : 1 }]
            },
            assignments : {
                added : [{ $PhantomId : 'newrec1' }]
            }
        }
    };

    const expected = expect.objectContaining({
        command : 'projectChange',
        changes : {
            tasks : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            resources : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            dependencies : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            assignments : {
                added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
            }
        }
    });

    await waitForConnectionOpen(ws);

    const response = await awaitNextMessage(ws, request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should not send response to the sender if no records were added', async () => {
    const ws = new WebSocket(server.address);
    const ws1 = new WebSocket(server.address);

    const request = {
        command : 'projectChange',
        changes : {
            tasks : {
                updated : [{ id : 1 }]
            },
            resources : {
                updated : [{ id : 1 }]
            },
            dependencies : {
                updated : [{ id : 1 }]
            },
            assignments : {
                updated : [{ id : 1 }]
            }
        }
    };

    const expected = expect.objectContaining({
        command : 'projectChange',
        changes : {
            tasks : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            resources : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            dependencies : {
                updated : [expect.objectContaining({ id : 1 })]
            },
            assignments : {
                updated : [expect.objectContaining({ id : 1 })]
            }
        }
    });

    await Promise.allSettled([
        waitForConnectionOpen(ws),
        waitForConnectionOpen(ws1)
    ]);

    const [response1, response2] = await Promise.allSettled([
        awaitNextMessage(ws, request, true),
        awaitNextMessage(ws1)
    ]);

    expect(response1.value).toBe(undefined);
    expect(response2.value).toEqual(expected);

    ws.terminate();
});
