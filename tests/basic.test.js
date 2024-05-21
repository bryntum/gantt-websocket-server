// noinspection DuplicatedCode

const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { waitForConnectionOpen, awaitNextMessage, awaitAuth, awaitNextCommand, awaitDataset } = require('./util.js');

const server = new WebSocketServer({ port : 8085 });

beforeAll(() => server.init());
beforeEach(() => server.resetDataSet());

beforeEach(() => server.resetDataSet());

afterAll(() => server.destroy());

test('Should greet new user', async () => {
    const ws = new WebSocket(server.address);

    const [{ data : { users } }] = await Promise.all([
        awaitNextCommand(ws, 'users'),
        awaitAuth(ws)
    ]);

    expect(users).toEqual(expect.arrayContaining(['admin']));

    ws.terminate();
});

test('Should return error to the client', async () => {
    const ws = new WebSocket(server.address);

    ws.expectError = true;

    await waitForConnectionOpen(ws);

    // send wrong data object
    ws.send('{ command: "login"');

    const got = await awaitNextMessage(ws);

    expect(got).toEqual({ command : 'error', message : expect.any(String) });

    ws.terminate();
});

test('Should generate ids for new records', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks        : {
                            added : [{ $PhantomId : 'newrec1' }]
                        },
                        resources    : {
                            added : [{ $PhantomId : 'newrec2' }]
                        },
                        dependencies : {
                            added : [{ $PhantomId : 'newrec3' }]
                        },
                        assignments  : {
                            added : [{ $PhantomId : 'newrec4' }]
                        },
                        versions     : {
                            added : [{ $PhantomId : 'newrec5' }]
                        },
                        changelogs   : {
                            added : [{ $PhantomId : 'newrec6' }]
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
                    revision      : 'server-1',
                    localRevision : 'local-1',
                    client        : ws.clientId,
                    changes       : {
                        tasks        : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
                        },
                        resources    : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec2', id : expect.any(Number) })]
                        },
                        dependencies : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec3', id : expect.any(Number) })]
                        },
                        assignments  : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec4', id : expect.any(Number) })]
                        },
                        versions     : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec5', id : expect.any(Number) })]
                        },
                        changelogs   : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec6', id : expect.any(Number) })]
                        }
                    }
                }
            ]
        }
    });

    const got = await awaitNextCommand(ws, 'project_change', request);

    expect(got).toEqual(expected);

    ws.terminate();
});

test('Should broadcast ids for new records among clients', async () => {
    const ws = new WebSocket(server.address);
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws, 1),
        awaitDataset(ws1, 1),
        awaitDataset(ws2, 1)
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
                            added : [{ $PhantomId : 'newrec1' }]
                        },
                        resources    : {
                            added : [{ $PhantomId : 'newrec2' }]
                        },
                        dependencies : {
                            added : [{ $PhantomId : 'newrec3' }]
                        },
                        assignments  : {
                            added : [{ $PhantomId : 'newrec4' }]
                        },
                        versions     : {
                            added : [{ $PhantomId : 'newrec5' }]
                        },
                        changelogs   : {
                            added : [{ $PhantomId : 'newrec6' }]
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
                            added : [expect.objectContaining({ $PhantomId : 'newrec1', id : expect.any(Number) })]
                        },
                        resources    : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec2', id : expect.any(Number) })]
                        },
                        dependencies : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec3', id : expect.any(Number) })]
                        },
                        assignments  : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec4', id : expect.any(Number) })]
                        },
                        versions     : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec5', id : expect.any(Number) })]
                        },
                        changelogs   : {
                            added : [expect.objectContaining({ $PhantomId : 'newrec6', id : expect.any(Number) })]
                        }
                    }
                }
            ]
        }
    });

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

    const { data : { dataset } } = await awaitDataset(ws, 1);

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
        })]),
        versionsData     : expect.arrayContaining([expect.objectContaining({
            id   : expect.any(String),
            name : expect.any(String)
        })]),
        changelogsData   : expect.any(Array),
        project          : expect.objectContaining({
            startDate : expect.any(String),
            calendar  : expect.any(String)
        })
    });

    ws.terminate();
});

// test('New clients should receive recorded changes', async () => {
//
// });

test('Should receive OK to autosave once', async () => {
    const ws = new WebSocket(server.address);
    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws, 1),
        awaitDataset(ws1, 1),
        awaitDataset(ws2, 1)
    ]);

    const [response1, response2, response3] = await Promise.allSettled([
        awaitNextMessage(ws, { command : 'request_version_autosave', data : { project : 1 } }),
        awaitNextMessage(ws1, { command : 'request_version_autosave', data : { project : 1 } }),
        awaitNextMessage(ws2, { command : 'request_version_autosave', data : { project : 1 } })
    ]);

    expect(response1.value).toEqual({ command : 'versionAutoSaveOK', data : { project : 1 } });
    expect(response2.value).toEqual(undefined);
    expect(response3.value).toEqual(undefined);

    [ws, ws1, ws2].forEach(ws => ws.terminate());
});

test('New clients should receive existing versions', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);
    await awaitNextCommand(ws, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        versions : {
                            added : [{
                                $PhantomId : '_generated1',
                                savedAt    : '2022-09-08T14:09:29.180Z',
                                name       : 'My version'
                            }]
                        }
                    }
                }
            ]
        }
    });

    const ws1 = new WebSocket(server.address);

    const { data : { dataset } } = await awaitDataset(ws1, 1);

    expect(dataset).toEqual(expect.objectContaining({
        versionsData : expect.arrayContaining([expect.objectContaining({
            id      : expect.any(Number),
            savedAt : expect.any(String),
            name    : expect.any(String)
        })])
    }));

    [ws, ws1].forEach(ws => ws.terminate());
});

test('New clients should receive existing changelogs', async () => {
    const ws = new WebSocket(server.address);
    await server.resetDataSet();

    await awaitDataset(ws, 1);
    await awaitNextCommand(ws, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        changelogs : {
                            added : [{
                                $PhantomId  : '_generated1',
                                occurredAt  : '2022-09-08T14:09:29.180Z',
                                description : 'My change'
                            }]
                        }
                    }
                }
            ]
        }
    });

    const ws1 = new WebSocket(server.address);

    const { data : { dataset } } = await awaitDataset(ws1, 1);

    expect(dataset).toEqual(expect.objectContaining({
        changelogsData : expect.arrayContaining([expect.objectContaining({
            id          : expect.anything(),
            occurredAt  : expect.any(String),
            description : expect.any(String)
        })])
    }));

    [ws, ws1].forEach(ws => ws.terminate());
});

test('Should save and retrieve version content', async () => {
    const versionContent = {
        tasks: [{ id: 37 }],
        resources: [{ id: 44 }]
    };

    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const putResponse = await awaitNextCommand(ws, 'projectChange', {
        command : 'projectChange',
        project : 1,
        changes : {
            versions     : {
                added : [{
                    $PhantomId : 'newrec1',
                    name       : 'Version 1',
                    savedAt    : '2022-09-08T14:09:29.180Z',
                    content    : versionContent
                }]
            }
        }
    });

    // Lazy-loaded content field not returned in response
    expect(putResponse.changes.versions.added[0].content).toBeUndefined();
    const versionId = putResponse.changes.versions.added[0].id;

    const loadResponse = await awaitNextCommand(ws, 'loadVersionContent', {
        command: 'loadVersionContent',
        project: 1,
        versionId
    });

    expect(loadResponse).toEqual({
        command: 'loadVersionContent',
        project: 1,
        versionId,
        content: versionContent
    });

    ws.terminate();
});


test('Should not send version content by default on dataset command', async () => {
    const versionContent = {
        tasks: [{ id: 37 }],
        resources: [{ id: 44 }]
    };

    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    await awaitNextCommand(ws, 'projectChange', {
        command : 'projectChange',
        project : 1,
        changes : {
            versions     : {
                added : [{
                    $PhantomId : 'newrec1',
                    name       : 'Version 1',
                    savedAt    : '2022-09-08T14:09:29.180Z',
                    content    : versionContent
                }]
            }
        }
    });

    const ws2 = new WebSocket(server.address);

    const client2Dataset = await awaitDataset(ws2, 1);

    // New client shouldn't get version content
    client2Dataset.dataset.versionsData.forEach(version => {
        expect(version.content).toBeUndefined();
    });

    ws.terminate();
    ws2.terminate();
});
