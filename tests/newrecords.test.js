const WebSocket = require('ws');
const { awaitNextCommand, awaitDataset } = require('./util.js');
const { WebSocketServer } = require('../src/server.js');

const server = new WebSocketServer({ port : 8086 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

let counter = 1;

const nextPhantomId = () => `newrec${counter++}`;

test('Should respond to client if task was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    let phantomId = nextPhantomId();

    const request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks        : {
                            added : [{ $PhantomId : phantomId }]
                        },
                        resources    : {
                            updated : [{ id : 1 }]
                        },
                        dependencies : {
                            updated : [{ id : 1 }]
                        },
                        assignments  : {
                            updated : [{ id : 1 }]
                        }
                    }
                }
            ]
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        tasks        : {
                            added : [expect.objectContaining({ $PhantomId : phantomId, id : expect.any(Number) })]
                        },
                        resources    : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        dependencies : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        assignments  : {
                            updated : [expect.objectContaining({ id : 1 })]
                        }
                    }
                }
            ]
        }
    });

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if new task was updated', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    let phantomId = nextPhantomId();

    let request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks        : {
                            $input : {
                                added : [{ $PhantomId : phantomId }]
                            },
                            added : [{ $PhantomId : phantomId }]
                        }
                    }
                }
            ]
        }
    };

    let expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        tasks        : {
                            $input : {
                                added : [expect.objectContaining({ $PhantomId : phantomId, id : expect.any(Number) })]
                            },
                            added : [expect.objectContaining({ $PhantomId : phantomId, id : expect.any(Number) })]
                        }
                    }
                }
            ]
        }
    });

    let response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    phantomId = nextPhantomId();

    request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-2',
                    changes  : {
                        tasks        : {
                            $input : {
                                added : [{ $PhantomId : phantomId, name : 'a' }]
                            },
                            added : [{ $PhantomId : phantomId, name : 'a' }]
                        }
                    }
                }
            ]
        }
    };

    expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-2',
                    client        : ws.clientId,
                    changes       : {
                        tasks        : {
                            $input : {
                                added : [expect.objectContaining({ id : expect.any(Number), name : 'a' })]
                            },
                            added : [expect.objectContaining({ id : expect.any(Number), name : 'a' })]
                        }
                    }
                }
            ]
        }
    });

    response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if resource was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const phantomId = nextPhantomId();

    const request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks        : {
                            updated : [{ id : 1 }]
                        },
                        resources    : {
                            added : [{ $PhantomId : phantomId }]
                        },
                        dependencies : {
                            updated : [{ id : 1 }]
                        },
                        assignments  : {
                            updated : [{ id : 1 }]
                        }
                    }
                }
            ]
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        tasks        : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        resources    : {
                            added : [expect.objectContaining({ $PhantomId : phantomId, id : expect.any(Number) })]
                        },
                        dependencies : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        assignments  : {
                            updated : [expect.objectContaining({ id : 1 })]
                        }
                    }
                }
            ]
        }
    });

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if dependency was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const phantomId = nextPhantomId();

    const request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks        : {
                            updated : [{ id : 1 }]
                        },
                        resources    : {
                            updated : [{ id : 1 }]
                        },
                        dependencies : {
                            added : [{ $PhantomId : phantomId }]
                        },
                        assignments  : {
                            updated : [{ id : 1 }]
                        }
                    }
                }
            ]
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        tasks        : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        resources    : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        dependencies : {
                            added : [expect.objectContaining({ $PhantomId : phantomId, id : expect.any(Number) })]
                        },
                        assignments  : {
                            updated : [expect.objectContaining({ id : 1 })]
                        }
                    }
                }
            ]
        }
    });

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if assignment was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const phantomId = nextPhantomId();

    const request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks        : {
                            updated : [{ id : 1 }]
                        },
                        resources    : {
                            updated : [{ id : 1 }]
                        },
                        dependencies : {
                            updated : [{ id : 1 }]
                        },
                        assignments  : {
                            added : [{ $PhantomId : phantomId }]
                        }
                    }
                }
            ]
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        tasks        : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        resources    : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        dependencies : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        assignments  : {
                            added : [expect.objectContaining({ $PhantomId : phantomId, id : expect.any(Number) })]
                        }
                    }
                }
            ]
        }
    });

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if version was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const phantomId = nextPhantomId();

    const request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        versions : {
                            added : [{ $PhantomId : phantomId }]
                        }
                    }
                }
            ]
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        versions : {
                            added : [expect.objectContaining({ $PhantomId : phantomId, id : expect.any(Number) })]
                        }
                    }
                }
            ]
        }
    });

    const response = await awaitNextCommand(ws, 'project_change', request);

    expect(response).toEqual(expected);

    ws.terminate();
});

test('Should respond to client if changelog was added', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const phantomId = nextPhantomId();

    const request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        changelogs : {
                            added : [{ $PhantomId : phantomId }]
                        }
                    }
                }
            ]
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        changelogs : {
                            added : [expect.objectContaining({ $PhantomId : phantomId, id : expect.any(Number) })]
                        }
                    }
                }
            ]
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
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks        : {
                            updated : [{ id : 1 }]
                        },
                        resources    : {
                            updated : [{ id : 1 }]
                        },
                        dependencies : {
                            updated : [{ id : 1 }]
                        },
                        assignments  : {
                            updated : [{ id : 1 }]
                        }
                    }
                }
            ]
        }
    };

    const expected = expect.objectContaining({
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision      : expect.stringMatching(/server-\d/),
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        tasks        : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        resources    : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        dependencies : {
                            updated : [expect.objectContaining({ id : 1 })]
                        },
                        assignments  : {
                            updated : [expect.objectContaining({ id : 1 })]
                        }
                    }
                }
            ]
        }
    });

    const [response1, response2] = await Promise.allSettled([
        awaitNextCommand(ws, 'project_change', request),
        awaitNextCommand(ws1, 'project_change')
    ]);

    expect(response1.value).toEqual(expected);
    expect(response2.value).toEqual(expected);

    ws.terminate();
    ws1.terminate();
});
