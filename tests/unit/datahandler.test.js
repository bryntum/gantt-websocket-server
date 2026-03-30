const { DataHandler } = require('../../src/datahandler.js');

let handler;

beforeEach(() => {
    handler = new DataHandler();
});

describe('getProjectData', () => {
    test('Should return data for valid project', () => {
        const data = handler.getProjectData(1);

        expect(data).toHaveProperty('tasksData');
        expect(data).toHaveProperty('resourcesData');
        expect(data).toHaveProperty('dependenciesData');
        expect(data).toHaveProperty('assignmentsData');
        expect(data).toHaveProperty('calendarsData');
        expect(data).toHaveProperty('versionsData');
        expect(data).toHaveProperty('changelogsData');
        expect(data).toHaveProperty('project');
    });

    test('Should throw for invalid project', () => {
        expect(() => handler.getProjectData(999)).toThrow();
    });
});

describe('getProjectsMetadata', () => {
    test('Should return metadata for specified project ids', () => {
        const metadata = handler.getProjectsMetadata([1, 2]);

        expect(metadata).toEqual([
            { id : 1, name : 'SaaS' },
            { id : 2, name : 'Website' }
        ]);
    });

    test('Should return empty for non-existent ids', () => {
        expect(handler.getProjectsMetadata([999])).toEqual([]);
    });
});

describe('handleProjectChanges', () => {
    test('Should generate string IDs for new records', () => {
        const result = handler.handleProjectChanges(1, {
            tasks : {
                added : [{ $PhantomId : 'phantom-1', name : 'New Task' }]
            }
        });

        const addedTask = result.changes.tasks.added[0];

        expect(addedTask.id).toEqual(expect.any(String));
        expect(addedTask.$PhantomId).toBe('phantom-1');
        expect(result.hasNewRecords).toBe(true);
    });

    test('Should map phantom IDs to generated IDs', () => {
        handler.handleProjectChanges(1, {
            tasks : {
                added : [{ $PhantomId : 'phantom-1' }]
            }
        });

        const map = handler.phantomIdMap;

        expect(map.has('phantom-1')).toBe(true);
        expect(map.get('phantom-1')).toEqual(expect.any(String));
    });

    test('Should move duplicate phantom ID from added to updated', () => {
        // First add
        handler.handleProjectChanges(1, {
            tasks : {
                added : [{ $PhantomId : 'dup-1', name : 'Task' }]
            }
        });

        const generatedId = handler.phantomIdMap.get('dup-1');

        // Second add with same phantom ID
        const result = handler.handleProjectChanges(1, {
            tasks : {
                added : [{ $PhantomId : 'dup-1', name : 'Updated Task' }]
            }
        });

        // Should be moved from added to updated
        expect(result.changes.tasks.added).toHaveLength(0);
        expect(result.changes.tasks.updated.length).toBeGreaterThanOrEqual(1);
        expect(result.changes.tasks.updated.find(r => r.id === generatedId)).toBeDefined();
    });

    test('Should replace phantom IDs in related records', () => {
        const result = handler.handleProjectChanges(1, {
            tasks : {
                added : [{ $PhantomId : 'task-1', name : 'Task' }]
            },
            assignments : {
                added : [{ $PhantomId : 'assign-1', event : 'task-1' }]
            }
        });

        const taskId = result.changes.tasks.added[0].id;
        const assignment = result.changes.assignments.added[0];

        // The event field should reference the generated task ID
        expect(assignment.event).toBe(taskId);
    });

    test('Should handle project metadata updates', () => {
        const result = handler.handleProjectChanges(1, {
            project : { startDate : '2024-01-01' }
        });

        expect(result.changes.project.startDate).toBe('2024-01-01');
    });

    test('Should report no new records for update-only changes', () => {
        const result = handler.handleProjectChanges(1, {
            tasks : {
                updated : [{ id : 'events-1', name : 'Renamed' }]
            }
        });

        expect(result.hasNewRecords).toBe(false);
    });
});

describe('phantomIdMap', () => {
    test('Should expose phantom ID mappings', () => {
        expect(handler.phantomIdMap).toBeInstanceOf(Map);
    });

    test('Should be cleared on full reset', () => {
        handler.handleProjectChanges(1, {
            tasks : { added : [{ $PhantomId : 'test-1' }] }
        });

        expect(handler.phantomIdMap.size).toBeGreaterThan(0);

        handler.reset();

        expect(handler.phantomIdMap.size).toBe(0);
    });
});

describe('reset', () => {
    test('Should reset single project', () => {
        handler.handleProjectChanges(1, {
            tasks : { added : [{ $PhantomId : 'reset-test', name : 'Temp' }] }
        });

        handler.reset(1);

        // Data should be reloaded from source
        const data = handler.getProjectData(1);

        expect(data.tasksData).toBeDefined();
    });

    test('Should reset all projects when no id given', () => {
        handler.reset();

        const data = handler.getProjectData(1);

        expect(data.tasksData).toBeDefined();
    });
});

describe('getVersionContent', () => {
    test('Should return content for existing version', () => {
        // Add a version with content
        handler.handleProjectChanges(1, {
            versions : {
                added : [{
                    $PhantomId : 'ver-1',
                    name       : 'Test Version',
                    content    : { tasks : [{ id : 1 }] }
                }]
            }
        });

        const versionId = handler.phantomIdMap.get('ver-1');
        const content = handler.getVersionContent(1, versionId);

        expect(content).toEqual({ tasks : [{ id : 1 }] });
    });

    test('Should return undefined for non-existent version', () => {
        const content = handler.getVersionContent(1, 'nonexistent');

        expect(content).toBeUndefined();
    });
});
