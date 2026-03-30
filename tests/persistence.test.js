const WebSocket = require('ws');
const { WebSocketServer } = require('../src/server.js');
const { awaitNextCommand, awaitAuth, awaitDataset } = require('./util.js');
const { TaskStore } = require('@bryntum/gantt/gantt.node.cjs');

const server = new WebSocketServer({ port : 8087 });

beforeAll(() => server.init());

afterAll(() => server.destroy());

test('Changes should be persisted and served to new clients', async () => {
    const ws1 = new WebSocket(server.address);
    await awaitAuth(ws1);

    const got = await awaitDataset(ws1, 1);

    expect(got).not.toBeUndefined();

    const response = await awaitNextCommand(ws1, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks : {
                            added   : [{ $PhantomId : 'persist-1', name : 'Task 1.6', parentId : 'events-1' }],
                            updated : [{ id : 'events-12', parentId : 'events-11' }, { id : 'events-13', percentDone : 0 }],
                            removed : [{ id : 'events-21' }]
                        }
                    }
                }
            ]
        }
    });

    // Get the generated ID for the new task
    const newTaskId = response.data.revisions[0].changes.tasks.added[0].id;

    expect(newTaskId).toEqual(expect.any(String));

    const ws2 = new WebSocket(server.address);

    await awaitAuth(ws2);

    const { data } = await awaitDataset(ws2, 1);

    const store = new TaskStore({ data : data.dataset.tasksData });

    // child added
    expect(store.getById('events-11').children.length).toBe(1);
    // record removed
    expect(store.getById('events-21')).toBeUndefined();
    // new task is ok
    expect(store.getById(newTaskId).parent.id).toBe('events-1');
    expect(store.getById('events-13').percentDone).toBe(0);

    ws1.terminate();
    ws2.terminate();
});
