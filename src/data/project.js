const fs = require('fs');
const { Store, TaskModel, Model } = require('@bryntum/gantt/gantt.node.cjs');

const lazyFields = ['content'];

function omitLazyFields(record) {
    if (!record || lazyFields.length === 0) {
        return record;
    }
    const clonedRecord = Object.assign({}, record);
    for (const lazyField of lazyFields) {
        delete clonedRecord[lazyField];
    }
    return clonedRecord;
}

class ModelWithLazyFields extends Model {
    toJSON() {
        return omitLazyFields(super.toJSON());
    }
}

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
                dependencies : new Store({
                    fields : ['id', 'fromEvent', 'toEvent', 'active', 'type', 'lag', 'lagUnit'],
                    data : data.dependencies.rows
                }),
                assignments  : new Store({ data : data.assignments.rows }),
                calendars    : new Store({ data : data.calendars.rows }),
                versions     : new Store({ data : data.versions.rows, modelClass : ModelWithLazyFields }),
                changelogs   : new Store({ data : [] }),
                project      : data.project
            };
        }
        else {
            throw new Error('Project should have source');
        }
    }
}

module.exports = { Project, omitLazyFields }
