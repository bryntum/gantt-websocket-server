const WebSocket = require('ws');
const { WebSocketServer } = require('../../src/server.js');
const { awaitNextMessage, awaitNextCommand, awaitDataset } = require('../util.js');
const { TaskStore } = require('@bryntum/gantt/gantt.node.cjs');

const server = new WebSocketServer({ port : 8085 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Should generate ids for new records', async () => {
    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const request = {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [{
                revision : 'local-1',
                changes  : {
                    tasks        : { added : [{ $PhantomId : 'newrec1' }] },
                    resources    : { added : [{ $PhantomId : 'newrec2' }] },
                    dependencies : { added : [{ $PhantomId : 'newrec3' }] },
                    assignments  : { added : [{ $PhantomId : 'newrec4' }] },
                    versions     : { added : [{ $PhantomId : 'newrec5' }] },
                    changelogs   : { added : [{ $PhantomId : 'newrec6' }] }
                }
            }]
        }
    };

    const got = await awaitNextCommand(ws, 'project_change', request);

    const changes = got.data.revisions[0].changes;

    expect(changes.tasks.added[0].id).toEqual(expect.any(String));
    expect(changes.resources.added[0].id).toEqual(expect.any(String));
    expect(changes.dependencies.added[0].id).toEqual(expect.any(String));
    expect(changes.assignments.added[0].id).toEqual(expect.any(String));
    expect(changes.versions.added[0].id).toEqual(expect.any(String));
    expect(changes.changelogs.added[0].id).toEqual(expect.any(String));

    ws.terminate();
});

test('Should broadcast changes to all subscribed clients', async () => {
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
            revisions : [{
                revision : 'local-1',
                changes  : {
                    tasks : { added : [{ $PhantomId : 'bcast-1' }] }
                }
            }]
        }
    };

    const [response1, response2, response3] = await Promise.allSettled([
        awaitNextMessage(ws, request),
        awaitNextMessage(ws1),
        awaitNextMessage(ws2)
    ]);

    expect(response1.value.data.revisions[0].changes.tasks.added[0].id).toEqual(expect.any(String));
    expect(response2.value.data.revisions[0].changes.tasks.added[0].id).toEqual(expect.any(String));
    expect(response3.value.data.revisions[0].changes.tasks.added[0].id).toEqual(expect.any(String));

    ws.terminate();
    ws1.terminate();
    ws2.terminate();
});

test('Should get dataset from server', async () => {
    const ws = new WebSocket(server.address);

    const { data : { dataset } } = await awaitDataset(ws, 1);

    expect(dataset.tasksData).toEqual(expect.any(Array));
    expect(dataset.resourcesData).toEqual(expect.any(Array));
    expect(dataset.dependenciesData).toEqual(expect.any(Array));
    expect(dataset.assignmentsData).toEqual(expect.any(Array));
    expect(dataset.calendarsData).toEqual(expect.any(Array));
    expect(dataset.versionsData).toEqual(expect.any(Array));
    expect(dataset.changelogsData).toEqual(expect.any(Array));
    expect(dataset.project).toBeDefined();

    ws.terminate();
});

test('Changes should be persisted for new clients', async () => {
    await server.resetDataSet();

    const ws1 = new WebSocket(server.address);

    await awaitDataset(ws1, 1);

    const response = await awaitNextCommand(ws1, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [{
                revision : 'local-1',
                changes  : {
                    tasks : {
                        added   : [{ $PhantomId : 'persist-1', name : 'New Task', parentId : 'events-1' }],
                        updated : [{ id : 'events-13', percentDone : 0 }],
                        removed : [{ id : 'events-21' }]
                    }
                }
            }]
        }
    });

    const newTaskId = response.data.revisions[0].changes.tasks.added[0].id;

    const ws2 = new WebSocket(server.address);
    const { data } = await awaitDataset(ws2, 1);
    const store = new TaskStore({ data : data.dataset.tasksData });

    expect(store.getById('events-21')).toBeUndefined();
    expect(store.getById(newTaskId)).toBeDefined();
    expect(store.getById('events-13').percentDone).toBe(0);

    ws1.terminate();
    ws2.terminate();
});

test('Should save and retrieve version content', async () => {
    await server.resetDataSet();

    const versionContent = { tasks : [{ id : 37 }], resources : [{ id : 44 }] };

    const ws = new WebSocket(server.address);

    await awaitDataset(ws, 1);

    const putResponse = await awaitNextCommand(ws, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [{
                revision : 'local-1',
                changes  : {
                    versions : {
                        added : [{
                            $PhantomId : 'ver-1',
                            name       : 'Version 1',
                            savedAt    : '2022-09-08T14:09:29.180Z',
                            content    : versionContent
                        }]
                    }
                }
            }]
        }
    });

    const versionId = putResponse.data.revisions[0].changes.versions.added[0].id;

    // Content should not be in the broadcast response (lazy field)
    expect(putResponse.data.revisions[0].changes.versions.added[0].content).toBeUndefined();

    // But should be loadable separately
    const loadResponse = await awaitNextCommand(ws, 'load_version_content', {
        command : 'load_version_content',
        data    : { project : 1, versionId }
    });

    expect(loadResponse.data.content).toEqual(versionContent);

    // New client shouldn't get content in dataset
    const ws2 = new WebSocket(server.address);
    const dataset = await awaitDataset(ws2, 1);

    dataset.data.dataset.versionsData.forEach(version => {
        expect(version.content).toBeUndefined();
    });

    ws.terminate();
    ws2.terminate();
});
