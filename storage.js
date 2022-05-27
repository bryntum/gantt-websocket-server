const fs = require('fs');

class Store {
    data = []
    
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
    counter = 100;
    
    constructor() {
        const data = JSON.parse(fs.readFileSync('data/launch-saas.json'));
    
        this.tasks = new TreeStore(data.tasks.rows);
        this.resources = new Store(data.resources.rows);
        this.dependencies = new Store(data.dependencies.rows);
        this.assignments = new Store(data.assignments.rows);
        this.calendars = new Store(data.calendars.rows);
        this.projectMeta = data.project;
    }
    
    generateId() {
        return ++this.counter;
    }
    
    get dataset() {
        return {
            tasksData        : this.tasks.dataset,
            resourcesData    : this.resources.dataset,
            dependenciesData : this.dependencies.dataset,
            assignmentsData  : this.assignments.dataset,
            calendarsData    : this.calendars.dataset
        };
    }
    
    get project() {
        return this.projectMeta;
    }
}

module.exports = { Storage };
