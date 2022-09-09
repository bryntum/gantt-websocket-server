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
            { id : 3, name : 'Backend', source : 'data/backend.json'}
        ];

        this.counter = 100;

        projects.forEach(project => this.loadProjectData(project));
    }

    loadProjectData(project) {
        const data = JSON.parse(fs.readFileSync(project.source));

        project.data = {
            tasks        : new TreeStore(data.tasks.rows),
            resources    : new Store(data.resources.rows),
            dependencies : new Store(data.dependencies.rows),
            assignments  : new Store(data.assignments.rows),
            calendars    : new Store(data.calendars.rows),
            versions     : new Store(data.versions.rows),
            changelogs   : new Store([]),
            projectMeta  : data.project
        };
    }

    reset(id) {
        const project = this.getProject(id);

        this.loadProjectData(project);
    }

    generateId() {
        return ++this.counter;
    }

    getProject(id) {
        return this.projects.find(project => project.id == id);
    }

    getProjectData(id) {
        const project = this.getProject(id);

        if (!project) {
            throw new Error(`Project ${id} not found`);
        }

        const
            {
                tasks,
                resources,
                dependencies,
                assignments,
                calendars,
                versions,
                changelogs,
                projectMeta
            } = project.data;

        return {
            tasksData        : tasks.dataset,
            resourcesData    : resources.dataset,
            dependenciesData : dependencies.dataset,
            assignmentsData  : assignments.dataset,
            calendarsData    : calendars.dataset,
            versionsData     : versions.dataset,
            changelogsData   : changelogs.dataset,
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
