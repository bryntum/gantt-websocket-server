const { Project } = require('../../src/data/project.js');

describe('Project basic API', () => {
    it('Should handle empty project', () => {
        const project = new Project();

        expect(() => project.load()).toThrow();
    });

    it('Should load project', () => {
        const project = new Project({ id : 1, name : 'Test', source : 'data/website.json' });

        expect(() => project.load()).not.toThrow();

        expect(project.data.tasks.count).toBe(8);
    });
});
