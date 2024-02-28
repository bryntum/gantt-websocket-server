const { Storage } = require('../../src/data/storage.js');
const { Store } = require('@bryntum/gantt/gantt.node.cjs');

it('Should load tree data', () => {
    const storage = new Storage({
        projects : [
            { id : 1, name : 'SaaS', source : 'data/saas.json'}
        ]
    });

    const project = storage.getProject(1);
    project.load();

    // if store in instance of bryntum store, we know we got all the API we needed
    expect(project.data.tasks).toBeInstanceOf(Store);
});
