const { Storage } = require('./data/storage.js');
const { omitLazyFields } = require('./data/project.js');

const defaultConfig = {
    projects : [
        { id : 1, name : 'SaaS', source : 'data/saas.json'},
        { id : 2, name : 'Website', source : 'data/website.json'},
        { id : 3, name : 'Backend', source : 'data/backend.json'}
    ]
};

let PHANTOMID_ID_MAP = new Map();

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
            PHANTOMID_ID_MAP = new Map();
        }
    }

    replacePhantomId(record) {
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
                this.replacePhantomId(value);
            }
        }
    }

    handleProjectChanges(projectId, changes) {
        const project = this.storage.getProject(projectId);

        PHANTOMID_ID_MAP = new Map();

        ['calendars', 'resources', 'tasks', 'dependencies', 'assignments', 'versions', 'changelogs'].forEach(key => {
            if (key in changes) {
                this.handleStoreChanges(project.data[key], changes[key]);
            }
        });

        // Changes object already contains correct ids
        return { changes, hasNewRecords : PHANTOMID_ID_MAP.size !== 0 };
    }

    // Bryntum Store has enough API to apply changeset, but we should generate IDs first. After that we can pass
    handleStoreChanges(store, changes) {
        if (changes.added) {
            for (let i = 0; i < changes.added.length; i++) {
                const record = changes.added[i];
                const phantomId = record.$PhantomId;

                // If phantom id is already processed, we should move this record to the list of updated records
                if (PHANTOMID_ID_MAP.has(phantomId)) {
                    record.id = PHANTOMID_ID_MAP.get(phantomId);
                    delete record.$PhantomId;

                    // Move record from added to updated
                    changes.updated = changes.updated || [];
                    changes.updated.push(record);
                    changes.added.splice(i, 1);

                    // Same for the $input
                    if (changes.$input?.added) {
                        const inputIndex = changes.$input.added.findIndex(inputRecord => inputRecord.$PhantomId === phantomId);
                        const inputRecord = changes.$input.added[inputIndex];

                        inputRecord.id = record.id;
                        delete inputRecord.$PhantomId;
                        this.replacePhantomId(inputRecord);

                        if (inputIndex !== -1) {
                            changes.$input.updated = changes.$input.updated || [];
                            changes.$input.updated.push(inputRecord);
                            changes.$input.added.splice(inputIndex, 1);
                        }
                    }

                    i--;
                }
                else {
                    record.id = this.storage.generateId(store.storeId);
                    PHANTOMID_ID_MAP.set(record.$PhantomId, record.id);

                    const inputRecord = changes.$input?.added?.find(r => r.$PhantomId === phantomId);

                    if (inputRecord) {
                        inputRecord.id = record.id;
                        this.replacePhantomId(inputRecord);
                    }
                }

                // Replace phantom parent id with parent id
                if ('$PhantomParentId' in record) {
                    record.parentId = PHANTOMID_ID_MAP[record.$PhantomParentId];
                    // Phantom parent id is not required, on the other hand
                    delete record.$PhantomParentId;
                }

                // Replace phantom ids with real ones
                this.replacePhantomId(record);

                // Replace with version with lazy-loaded fields omitted for rebroadcast
                changes.added[i] = omitLazyFields(record);
            }
        }

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

        store.applyChangeset({ added : changes.added, updated : changes.updated, removed : changes.removed });
    }

    getVersionContent(projectId, versionId) {
        const { versions } = this.storage.getProject(projectId).data;
        return versions.getById(versionId)?.content;
    }
}

module.exports = { DataHandler };
