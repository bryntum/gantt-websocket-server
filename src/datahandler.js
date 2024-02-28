const { Storage } = require('./data/storage.js');

const defaultConfig = {
    projects : [
        { id : 1, name : 'SaaS', source : 'data/saas.json'},
        { id : 2, name : 'Website', source : 'data/website.json'},
        { id : 3, name : 'Backend', source : 'data/backend.json'}
    ]
};

class DataHandler {
    constructor() {
        this.storage = new Storage(defaultConfig);

        this.load();
    }

    load() {
        this.storage.load();
    }

    getProjectData(id) {
        return this.storage.getProjectData(id);
    }

    getProjectsMetadata(ids) {
        return this.storage.getProjectsMetadata(ids);
    }

    reset(id) {
        if (id != null) {
            this.storage.reset(id);
        }
        else {
            this.storage = new Storage(defaultConfig);
        }
    }

    replacePhantomId(record, PHANTOMID_ID_MAP) {
        // Look for values that match keys in PHANTOMID_ID_MAP. If we found such value it means it is a link, and we
        // should replace phantom id with generated one
        for (const key in record) {
            const value = record[key];

            if (typeof value === 'string') {
                if (!/\$Phantom/.test(key) && PHANTOMID_ID_MAP.has(value)) {
                    record[key] = PHANTOMID_ID_MAP.get(value);
                }
            }
            else if (typeof value === 'object' && !Array.isArray(value)) {
                this.replacePhantomId(value, PHANTOMID_ID_MAP);
            }
        }
    }

    handleproject_changes(projectId, changes) {
        const PHANTOMID_ID_MAP = new Map();

        const project = this.storage.getProject(projectId);

        for (const key in changes) {
            this.handleStoreChanges(project.data[key], changes[key], PHANTOMID_ID_MAP);
        }

        // Changes object already contains correct ids
        return { changes, hasNewRecords : PHANTOMID_ID_MAP.size !== 0 };
    }

    // Bryntum Store has enough API to apply changeset, but we should generate IDs first. After that we can pass
    handleStoreChanges(store, changes, PHANTOMID_ID_MAP) {
        changes.added?.forEach(record => {
            // For every new record we should generate an id
            record.id = this.storage.generateId(store.storeId);
            PHANTOMID_ID_MAP.set(record.$PhantomId, record.id);
            // We need to keep record phantom id to assign correct id on a client which added a record

            // Replace phantom parent id with parent id
            if ('$PhantomParentId' in record) {
                record.parentId = PHANTOMID_ID_MAP[record.$PhantomParentId];
                // Phantom parent id is not required, on the other hand
                delete record.$PhantomParentId;
            }

            // Replace phantom ids with real ones
            this.replacePhantomId(record, PHANTOMID_ID_MAP);
        });

        changes.updated?.forEach(record => {
            const localRecord = store.getById(record.id);

            if (localRecord) {
                this.replacePhantomId(record, PHANTOMID_ID_MAP);
            }
            else {
                // If we got here, it means there is an updated record on the client which doesn't exist on the server.
                // It should not be happening
                console.warn('Record not found in store ' + store.storeId);
            }
        });

        store.applyChangeset(changes);
    }
}

module.exports = { DataHandler };
