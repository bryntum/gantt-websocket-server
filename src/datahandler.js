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

    get phantomIdMap() {
        return PHANTOMID_ID_MAP;
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

        const initialSize = PHANTOMID_ID_MAP.size;

        if ('project' in changes) {
            for (const key in changes.project) {
                if (key !== '$input') {
                    project.data.project[key] = changes.project[key];
                }
            }
        }

        ['calendars', 'resources', 'tasks', 'dependencies', 'assignments', 'versions', 'changelogs'].forEach(key => {
            if (key in changes) {
                this.handleStoreChanges(project.data[key], changes[key]);
            }
        });

        // Changes object already contains correct ids
        return { changes, hasNewRecords : PHANTOMID_ID_MAP.size !== initialSize };
    }

    // Bryntum Store has enough API to apply changeset, but we should generate IDs first. After that we can pass
    handleStoreChanges(store, changes) {
        // Keep full records for store application, strip lazy fields only for rebroadcast
        const addedForStore = [];

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

                        if (inputIndex !== -1) {
                            inputRecord.id = record.id;
                            delete inputRecord.$PhantomId;
                            this.replacePhantomId(inputRecord);

                            changes.$input.updated = changes.$input.updated || [];
                            changes.$input.updated.push(inputRecord);
                            changes.$input.added.splice(inputIndex, 1);
                        }
                    }

                    i--;
                }
                else {
                    record.id = this.storage.generateId(store.id);
                    PHANTOMID_ID_MAP.set(record.$PhantomId, record.id);

                    const inputRecord = changes.$input?.added?.find(r => r.$PhantomId === phantomId);

                    if (inputRecord) {
                        inputRecord.id = record.id;
                        this.replacePhantomId(inputRecord);
                    }
                }

                // Replace phantom parent id with parent id
                if ('$PhantomParentId' in record) {
                    record.parentId = PHANTOMID_ID_MAP.get(record.$PhantomParentId);
                    // Phantom parent id is not required, on the other hand
                    delete record.$PhantomParentId;
                }

                // Replace phantom ids with real ones
                this.replacePhantomId(record);

                // Keep full record for store, omit lazy fields for rebroadcast
                addedForStore.push(record);
                changes.added[i] = omitLazyFields(record);
            }
        }

        // Build store-safe updated records — prepare segments for store application
        const updatedForStore = [];

        changes.updated?.forEach(record => {
            const localRecord = store.getById(record.id);

            if (localRecord) {
                this.replacePhantomId(record);

                // Prepare segments for store: wrap with toJSON, merge nulls with existing
                if ('segments' in record) {
                    const storeRecord = Object.assign({}, record);

                    // segments could be `null`
                    record.segments?.forEach(segment => {
                        const phantomId = segment.id;

                        if (PHANTOMID_ID_MAP.has(phantomId)) {
                            segment.id = PHANTOMID_ID_MAP.get(phantomId);
                        }
                        else {
                            segment.id = this.storage.generateId(store.id);
                            PHANTOMID_ID_MAP.set(segment.$PhantomId, segment.id);
                        }
                    });

                    updatedForStore.push(storeRecord);
                }
                else {
                    updatedForStore.push(record);
                }
            }
            else {
                // If we got here, it means there is an updated record on the client which doesn't exist on the server.
                // It should not be happening
                console.warn('Record not found in store ' + store.id);
            }
        });

        // Apply changeset with full records (including lazy fields like content)
        store.applyChangeset({
            added   : addedForStore.length ? addedForStore : changes.added,
            updated : updatedForStore.length ? updatedForStore : changes.updated,
            removed : changes.removed
        });
    }

    getVersionContent(projectId, versionId) {
        const { versions } = this.storage.getProject(projectId).data;
        return versions.getById(versionId)?.content;
    }
}

module.exports = { DataHandler };
