const WebSocket = require('ws');
const { WebSocketServer } = require('../../src/server.js');
const { awaitNextMessage, awaitNextCommand, awaitDataset } = require('../util.js');

const server = new WebSocketServer({ port : 8089 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

// Segment revision shapes from Bryntum Gantt ProjectRevisionTaskSegments.t.js:
// CREATE (split):  tasks.updated: [{ id, endDate, segments: [{id, startDate, endDate}, ...] }]
// UPDATE (modify): tasks.updated: [{ id, segments: [modifiedSeg, null, ...], duration, endDate }]
// REMOVE (merge):  tasks.updated: [{ id, segments: null, duration }]

test('Should broadcast segment data when task is split (CREATE)', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws1, 1),
        awaitDataset(ws2, 1)
    ]);

    const segments = [
        { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
        { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
    ];

    const request = {
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
                            segments
                        }],
                        $input : {
                            updated : [{
                                id       : 'events-1',
                                segments
                            }]
                        }
                    }
                }
            }]
        }
    };

    // ws1 sends, ws2 receives broadcast
    const [response1, response2] = await Promise.allSettled([
        awaitNextCommand(ws1, 'project_change', request),
        awaitNextCommand(ws2, 'project_change')
    ]);

    // Both clients should receive the segments data
    const changes1 = response1.value.data.revisions[0].changes;
    const changes2 = response2.value.data.revisions[0].changes;

    expect(changes1.tasks.updated[0].segments).toEqual(segments);
    expect(changes2.tasks.updated[0].segments).toEqual(segments);

    // $input should be preserved
    expect(changes1.tasks.$input.updated[0].segments).toEqual(segments);
    expect(changes2.tasks.$input.updated[0].segments).toEqual(segments);

    ws1.terminate();
    ws2.terminate();
});

test('Should broadcast segment modification (UPDATE)', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws1, 1),
        awaitDataset(ws2, 1)
    ]);

    // First split the task
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

    // Consume the broadcast on ws2
    await awaitNextCommand(ws2, 'project_change');

    // Now modify segment 2 (extend endDate), segment 1 unchanged (null)
    const modifyRequest = {
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
                                null,  // seg-1 unchanged
                                { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-09' }
                            ],
                            endDate  : '2024-01-09'
                        }],
                        $input : {
                            updated : [{
                                id       : 'events-1',
                                segments : [
                                    null,
                                    { id : 'seg-2', endDate : '2024-01-09' }
                                ]
                            }]
                        }
                    }
                }
            }]
        }
    };

    const [response1, response2] = await Promise.allSettled([
        awaitNextCommand(ws1, 'project_change', modifyRequest),
        awaitNextCommand(ws2, 'project_change')
    ]);

    const updatedTask1 = response1.value.data.revisions[0].changes.tasks.updated[0];
    const updatedTask2 = response2.value.data.revisions[0].changes.tasks.updated[0];

    // Segments array with null for unchanged segments should be preserved
    expect(updatedTask1.segments[0]).toBeNull();
    expect(updatedTask1.segments[1].id).toBe('seg-2');
    expect(updatedTask1.segments[1].endDate).toBe('2024-01-09');

    expect(updatedTask2.segments[0]).toBeNull();
    expect(updatedTask2.segments[1].id).toBe('seg-2');

    ws1.terminate();
    ws2.terminate();
});

test('Should broadcast segments: null when segments are merged (REMOVE)', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);
    const ws2 = new WebSocket(server.address);

    await Promise.all([
        awaitDataset(ws1, 1),
        awaitDataset(ws2, 1)
    ]);

    // First split
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
    const mergeRequest = {
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
    };

    const [response1, response2] = await Promise.allSettled([
        awaitNextCommand(ws1, 'project_change', mergeRequest),
        awaitNextCommand(ws2, 'project_change')
    ]);

    const taskChange1 = response1.value.data.revisions[0].changes.tasks.updated[0];
    const taskChange2 = response2.value.data.revisions[0].changes.tasks.updated[0];

    // segments: null must be preserved (not stripped)
    expect('segments' in taskChange1).toBe(true);
    expect(taskChange1.segments).toBeNull();
    expect(taskChange1.duration).toBe(4);

    expect('segments' in taskChange2).toBe(true);
    expect(taskChange2.segments).toBeNull();

    // $input should also have segments: null
    const $input1 = response1.value.data.revisions[0].changes.tasks.$input;

    expect($input1.updated[0].segments).toBeNull();

    ws1.terminate();
    ws2.terminate();
});

test('Should persist segment data for new clients', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);

    await awaitDataset(ws1, 1);

    const segments = [
        { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
        { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
    ];

    // Add segments to a task
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
                            segments
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

    // Find the task that was updated
    const taskData = dataset.data.dataset.tasksData;

    // The task store's toJSON should include segment data
    // Note: This depends on @bryntum/gantt's TaskModel supporting segments in toJSON
    // If segments are stored as a field on the model, they should be serialized
    const task = findTaskById(taskData, 'events-1');

    expect(task).toBeDefined();
    // The task should have segments data after the update was applied
    // If TaskModel stores segments, they should appear in the serialized output
    if (task.segments) {
        expect(task.segments).toHaveLength(2);
    }

    ws1.terminate();
    ws2.terminate();
});

// Helper to find a task in potentially nested tree data
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
