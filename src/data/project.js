const fs = require('fs');
const { Store, TaskModel } = require('@bryntum/gantt/gantt.node.cjs');

class Project {
    constructor(config) {
        Object.assign(this, config);
    }

    load() {
        if (this.source) {
            const data = JSON.parse(fs.readFileSync(this.source));

            this.data = {
                tasks        : new Store({ modelClass : TaskModel, tree : true, transformFlatData : true, data : data.tasks.rows }),
                resources    : new Store({ data : data.resources.rows }),
                dependencies : new Store({ data : data.dependencies.rows }),
                assignments  : new Store({ data : data.assignments.rows }),
                calendars    : new Store({ data : data.calendars.rows }),
                versions     : new Store({ data : data.versions.rows }),
                changelogs   : new Store({ data : [] }),
                project      : data.project
            };
        }
        else {
            throw new Error('Project should have source');
        }
    }
}

module.exports = { Project }
