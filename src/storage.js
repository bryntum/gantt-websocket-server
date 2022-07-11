const fs = require('fs');

class Store {
    constructor(data = []) {
        this.data = data;
    }

    getById(id) {
        return this.data.find(r => r.id === id);
    }

    add(records) {
        if (!Array.isArray(records)) {
            records = [records];
        }

        this.data.push(...records);
    }

    remove(ids) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        ids.forEach(id => {
            const
                record = this.getById(id),
                index  = this.data.indexOf(record);

            if (index !== -1) {
                this.data.splice(index, 1);
            }
        });
    }

    get dataset() {
        return this.data.slice();
    }
}

class TreeStore extends Store {
    getTree() {
        const result = [];
        const idMap = {};

        this.data.forEach(record => {
            idMap[record.id] = record;

            if (!record.parentId) {
                result.push(record);
            }
            else {
                const parent = idMap[record.parentId];

                if (!parent.children) {
                    parent.children = [];
                }

                if (!parent.children.includes(record)) {
                    parent.children.push(record);
                }
            }
        });

        return result;
    }

    get dataset() {
        return this.getTree();
    }
}

// This class emulates backend storage, keeping data, updating ids etc. It should be replaced with a proper backend
class Storage {
    constructor() {
        const projects = this.projects = [
            { id : 1, name : 'SaaS', source : 'data/saas.json'},
            { id : 2, name : 'Website', source : 'data/website.json'},
            { id : 3, name : 'Backend', source : 'data/backend.json'},
        ];

        this.counter = 100;

        projects.forEach(project => {
            const data = JSON.parse(fs.readFileSync(project.source));

            project.data = {
                tasks        : new TreeStore(data.tasks.rows),
                resources    : new Store(data.resources.rows),
                dependencies : new Store(data.dependencies.rows),
                assignments  : new Store(data.assignments.rows),
                calendars    : new Store(data.calendars.rows),
                projectMeta  : data.project
            };
        });
    }

    generateId() {
        return ++this.counter;
    }

    getProjectData(id) {
        const
            {
                tasks,
                resources,
                dependencies,
                assignments,
                calendars,
                projectMeta
            } = this.projects.find(project => project.id === id);

        return {
            tasksData        : tasks.dataset,
            resourcesData    : resources.dataset,
            dependenciesData : dependencies.dataset,
            assignmentsData  : assignments.dataset,
            calendarsData    : calendars.dataset,
            project          : projectMeta
        };
    }

    getProjectsMetadata(ids) {
        return this.projects.reduce((result, { id, name }) => {
            if (ids.includes(id)) {
                result.push({ id, name });
            }

            return result;
        }, []);
    }
}

module.exports = { Storage };
