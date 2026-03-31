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

describe('segment support', () => {
    test('Should pass through segment data in task updates', () => {
        const segments = [
            { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
            { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
        ];

        const result = handler.handleProjectChanges(1, {
            tasks : {
                updated : [{
                    id       : 'events-1',
                    endDate  : '2024-01-08',
                    segments
                }],
                $input : {
                    updated : [{ id : 'events-1', segments }]
                }
            }
        });

        const updatedTask = result.changes.tasks.updated[0];

        expect(updatedTask.segments).toEqual(segments);
        expect(result.changes.tasks.$input.updated[0].segments).toEqual(segments);
    });

    test('Should preserve segments: null in task updates (merge)', () => {
        const result = handler.handleProjectChanges(1, {
            tasks : {
                updated : [{
                    id       : 'events-1',
                    segments : null,
                    duration : 4
                }],
                $input : {
                    updated : [{ id : 'events-1', segments : null, duration : 4 }]
                }
            }
        });

        const updatedTask = result.changes.tasks.updated[0];

        expect('segments' in updatedTask).toBe(true);
        expect(updatedTask.segments).toBeNull();
        expect(updatedTask.duration).toBe(4);
    });

    test('Should preserve null entries in segments array (unchanged segments)', () => {
        // First set segments on the task
        handler.handleProjectChanges(1, {
            tasks : {
                updated : [{
                    id       : 'events-1',
                    segments : [
                        { id : 'seg-1', startDate : '2024-01-05', endDate : '2024-01-06' },
                        { id : 'seg-2', startDate : '2024-01-07', endDate : '2024-01-08' }
                    ]
                }],
                $input : {}
            }
        });

        const
            project = handler.storage.projects[0],
            task    = project.data.tasks.getById('events-1'),
            segments = task.segments.slice();

        // Now send a partial update with null for unchanged segment
        const result = handler.handleProjectChanges(1, {
            tasks : {
                updated : [{
                    id       : 'events-1',
                    segments : [
                        null,
                        { id : 'seg-2', endDate : '2024-01-09' }
                    ],
                    endDate : '2024-01-09'
                }],
                $input : {}
            }
        });

        expect(task.segments[0]).toBe(segments[0]);
        // segment is re-instantiated
        expect(task.segments[1]).not.toBe(segments[1]);

        // Broadcast should keep the original format with nulls
        const updatedTask = result.changes.tasks.updated[0];

        expect(updatedTask.segments[0]).toBeNull();
        expect(updatedTask.segments[1].id).toBe('seg-2');
    });
});
