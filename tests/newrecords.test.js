const WebSocket = require('ws');
const { awaitNextCommand, awaitDataset } = require('./util.js');
const { WebSocketServer } = require('../src/server.js');

const server = new WebSocketServer({ port : 8082 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should respond to client if task was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const request = {
        command : 'project_change',
        project : 1,
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
        command : 'project_change',
        project : 1,
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

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if resource was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const request = {
        command : 'project_change',
        project : 1,
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
        command : 'project_change',
        project : 1,
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

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if dependency was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const request = {
        command : 'project_change',
        project : 1,
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
        command : 'project_change',
        project : 1,
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

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if assignment was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const request = {
        command : 'project_change',
        project : 1,
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
        command : 'project_change',
        project : 1,
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

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if version was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const request = {
        command : 'project_change',
        project : 1,
        changes : {
            versions : {
                added : [{ $PhantomId : 'newrec1' }]
            }
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        project : 1,
        changes : {
            versions : {
                added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
            }
        }
    });

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if changelog was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const request = {
        command : 'project_change',
        project : 1,
        changes : {
            changelogs : {
                added : [{ $PhantomId : 'newrec1' }]
            }
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        project : 1,
        changes : {
            changelogs : {
                added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
            }
        }
    });

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should not send response to the sender if no records were added', async () => {
    const ws = new WebSocket(server.address);
    const ws1 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws, 1),
        awaitDataset(ws1, 1)
    ]);

    const request = {
        command : 'project_change',
        project : 1,
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
        command : 'project_change',
        project : 1,
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

    const [response1, response2] = await Promise.allSettled([
        awaitNextCommand(ws, 'project_change', request),
        awaitNextCommand(ws1, 'project_change')
    ]);

    expect(response1.reason).toBe('timeout');
    expect(response2.value).toEqual(expected);

    ws.terminate();
    ws1.terminate();
});
