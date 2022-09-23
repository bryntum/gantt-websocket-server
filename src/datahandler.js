const { Storage, LazyStrategy } = require('./storage.js');

class DataHandler {
    constructor() {
        this.storage = new Storage();
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
            this.storage = new Storage();
        }
    }

    replacePhantomId(record, PHANTOMID_ID_MAP) {
        // Look for values that match keys in PHANTOMID_ID_MAP. If we found such value it means it is a link and we should
        // replace phantom id with generated one
        for (const key in record) {
            if (!/\$Phantom/.test(key) && PHANTOMID_ID_MAP.has(record[key])) {
                record[key] = PHANTOMID_ID_MAP.get(record[key]);
            }
        }
    }

    handleProjectChanges(projectId, changes) {
        const ID_PHANTOMID_MAP = new Map();
        const PHANTOMID_ID_MAP = new Map();

        const project = this.storage.getProject(projectId);

        for (const key in changes) {
            this.handleStoreChanges(project.data[key], changes[key], ID_PHANTOMID_MAP, PHANTOMID_ID_MAP);
        }

        // Changes object already contains correct ids
        return { changes, hasNewRecords : PHANTOMID_ID_MAP.size !== 0 };
    }

    handleStoreChanges(store, changes, ID_PHANTOMID_MAP, PHANTOMID_ID_MAP) {
        const { added, updated, removed } = changes;

        for (let index = 0; index < added?.length; index++) {
            const record = added[index];
            // For every new record we should generate an id
            record.id = this.storage.generateId(store.storeId);

            PHANTOMID_ID_MAP.set(record.$PhantomId, record.id);
            ID_PHANTOMID_MAP.set(record.id, record.$PhantomId);

            // Replace phantom ids with real ones
            this.replacePhantomId(record, PHANTOMID_ID_MAP);

            // Remove extra field, we don't need it anymore
            // delete record.$PhantomId;
            // delete record.$PhantomParentId;

            store.add(record);

            // Replace with version with lazy-loaded fields omitted for rebroadcast
            added[index] = store.getById(record.id, LazyStrategy.NONE);
        }

        for (const record of updated) {
            const localRecord = store.getById(record.id, LazyStrategy.ALL);

            if (localRecord) {
                this.replacePhantomId(record, PHANTOMID_ID_MAP);

                // Copy properties
                Object.assign(localRecord, record);
            }
            else {
                // If we got here, it means there is an updated record on the client which doesn't exist on the server.
                // It should not be happening
                console.warn('Record not found in store ' + store.storeId);
            }
        }

        if (removed) {
            store.remove(removed.map(r => r.id));
        }
    }

    getVersionContent(projectId, versionId) {
        const { versions } = this.storage.getProject(projectId).data;
        return versions.getById(versionId)?.content;
    }
}

module.exports = { DataHandler };
