const WebSocket = require('ws');
const { WebSocketServer } = require('../../src/server.js');
const { awaitNextCommand, awaitDataset } = require('../util.js');

const server = new WebSocketServer({ port : 8089 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

// E2e tests verify that segment changes are broadcast correctly between clients.
// Datahandler logic (ID generation, $input processing) is covered in unit/datahandler.test.js.

test('Should broadcast segment split to second client', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws1, 1),
        awaitDataset(ws2, 1)
    ]);

    const [response1, response2] = await Promise.allSettled([
        awaitNextCommand(ws1, 'project_change', {
            command : 'project_change',
            data    : {
                project   : 1,
                revisions : [{
                    revision : 'local-1',
                    changes  : {
                        tasks : {
                            updated : [{
                                id       : 'events-1',
                                endDate  : '2024-01-08',
                                segments : [
                                    { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
                                    { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
                                ]
                            }],
                            $input : {
                                updated : [{
                                    id       : 'events-1',
                                    segments : [
                                        { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
                                        { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
                                    ]
                                }]
                            }
                        }
                    }
                }]
            }
        }),
        awaitNextCommand(ws2, 'project_change')
    ]);

    const senderSegments = response1.value.data.revisions[0].changes.tasks.updated[0].segments;
    const receiverSegments = response2.value.data.revisions[0].changes.tasks.updated[0].segments;

    // Both clients receive same segment data
    expect(receiverSegments).toEqual(senderSegments);
    expect(senderSegments).toHaveLength(2);

    ws1.terminate();
    ws2.terminate();
});

test('Should broadcast segment modification to second client', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws1, 1),
        awaitDataset(ws2, 1)
    ]);

    // Split first
    await awaitNextCommand(ws1, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [{
                revision : 'local-1',
                changes  : {
                    tasks : {
                        updated : [{
                            id       : 'events-1',
                            endDate  : '2024-01-08',
                            segments : [
                                { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
                                { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
                            ]
                        }],
                        $input : {}
                    }
                }
            }]
        }
    });

    await awaitNextCommand(ws2, 'project_change');

    // Modify segment 2
    const [response1, response2] = await Promise.allSettled([
        awaitNextCommand(ws1, 'project_change', {
            command : 'project_change',
            data    : {
                project   : 1,
                revisions : [{
                    revision : 'local-2',
                    changes  : {
                        tasks : {
                            updated : [{
                                id       : 'events-1',
                                segments : [
                                    { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
                                    { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-09' }
                                ],
                                endDate  : '2024-01-09'
                            }],
                            $input : {
                                updated : [{
                                    id       : 'events-1',
                                    segments : [
                                        { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
                                        { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-09' }
                                    ]
                                }]
                            }
                        }
                    }
                }]
            }
        }),
        awaitNextCommand(ws2, 'project_change')
    ]);

    const senderTask = response1.value.data.revisions[0].changes.tasks.updated[0];
    const receiverTask = response2.value.data.revisions[0].changes.tasks.updated[0];

    // Both clients receive same modification
    expect(receiverTask.segments).toEqual(senderTask.segments);
    expect(senderTask.segments).toHaveLength(2);

    ws1.terminate();
    ws2.terminate();
});

test('Should broadcast segment merge to second client', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws1, 1),
        awaitDataset(ws2, 1)
    ]);

    // Split first
    await awaitNextCommand(ws1, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [{
                revision : 'local-1',
                changes  : {
                    tasks : {
                        updated : [{
                            id       : 'events-1',
                            segments : [
                                { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
                                { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
                            ]
                        }],
                        $input : {}
                    }
                }
            }]
        }
    });

    await awaitNextCommand(ws2, 'project_change');

    // Merge — segments: null
    const [response1, response2] = await Promise.allSettled([
        awaitNextCommand(ws1, 'project_change', {
            command : 'project_change',
            data    : {
                project   : 1,
                revisions : [{
                    revision : 'local-2',
                    changes  : {
                        tasks : {
                            updated : [{
                                id       : 'events-1',
                                segments : null,
                                duration : 4
                            }],
                            $input : {
                                updated : [{
                                    id       : 'events-1',
                                    segments : null,
                                    duration : 4
                                }]
                            }
                        }
                    }
                }]
            }
        }),
        awaitNextCommand(ws2, 'project_change')
    ]);

    const senderTask = response1.value.data.revisions[0].changes.tasks.updated[0];
    const receiverTask = response2.value.data.revisions[0].changes.tasks.updated[0];

    // Both clients receive segments: null
    expect(senderTask.segments).toBeNull();
    expect(receiverTask.segments).toBeNull();
    expect(receiverTask.duration).toBe(4);

    ws1.terminate();
    ws2.terminate();
});

test('Should persist segment data for new clients', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);

    await awaitDataset(ws1, 1);

    await awaitNextCommand(ws1, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [{
                revision : 'local-1',
                changes  : {
                    tasks : {
                        updated : [{
                            id       : 'events-1',
                            endDate  : '2024-01-08',
                            segments : [
                                { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
                                { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
                            ]
                        }],
                        $input : {}
                    }
                }
            }]
        }
    });

    // New client connects and loads the same project
    const ws2 = new WebSocket(server.address);
    const dataset = await awaitDataset(ws2, 1);

    const taskData = dataset.data.dataset.tasksData;
    const task = findTaskById(taskData, 'events-1');

    expect(task).toBeDefined();

    if (task.segments) {
        expect(task.segments).toHaveLength(2);
    }

    ws1.terminate();
    ws2.terminate();
});

function findTaskById(tasks, id) {
    for (const task of tasks) {
        if (task.id === id) return task;

        if (task.children) {
            const found = findTaskById(task.children, id);

            if (found) return found;
        }
    }

    return null;
}
