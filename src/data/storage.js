const { Project } = require('./../data/project.js');

// This class emulates backend storage, keeping data, updating ids etc. It should be replaced with a proper backend
class Storage {
    constructor(config = {}) {
        if (config.projects) {
            (this.projects = config.projects.map(cfg => new Project(cfg))).forEach(p => p.load());
        }

        this.counter = 100;
    }

    load(projectId) {
        if (projectId) {
            this.reset(projectId);
        }
        else {
            this.projects.forEach(p => p.load());
        }
    }

    reset(id) {
        this.getProject(id)?.load();
    }

    generateId() {
        return String(++this.counter);
    }

    getProject(id) {
        return this.projects.find(project => project.id === id);
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
                project : projectMeta
            } = project.data;

        return {
            tasksData        : tasks.toJSON(),
            resourcesData    : resources.toJSON(),
            dependenciesData : dependencies.toJSON(),
            assignmentsData  : assignments.toJSON(),
            calendarsData    : calendars.toJSON(),
            versionsData     : versions.toJSON(),
            changelogsData   : changelogs.toJSON(),
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
