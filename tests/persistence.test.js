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

    await awaitNextCommand(ws1, 'project_change', {
        command : 'project_change',
        data    : {
            project   : 1,
            revisions : [
                {
                    revision : 'local-1',
                    changes  : {
                        tasks : {
                            added   : [{ id : 101, name : 'Task 1.6', parentId : 1 }],
                            updated : [{ id : 12, parentId : 11 }, { id : 13, percentDone : 0 }],
                            removed : [{ id : 21 }]
                        }
                    }
                }
            ]
        }
    });

    const ws2 = new WebSocket(server.address);

    await awaitAuth(ws2);

    const { data } = await awaitDataset(ws2, 1);

    const store = new TaskStore({ data : data.dataset.tasksData });

    // child added
    expect(store.getById(11).children.length).toBe(1);
    // record removed
    expect(store.getById(21)).toBeUndefined();
    // new task is ok
    expect(store.getById(101).parent.id).toBe(1);
    expect(store.getById(13).percentDone).toBe(0);

    ws1.terminate();
    ws2.terminate();
});
