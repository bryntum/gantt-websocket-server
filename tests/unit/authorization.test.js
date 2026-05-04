const { AuthorizationHandler } = require('../../src/server/AuthorizationHandler.js');

let handler;

beforeEach(() => {
    handler = new AuthorizationHandler({});
});

describe('login', () => {
    test('Should accept valid admin credentials', () => {
        expect(handler.login('admin', 'admin')).toBe(true);
    });

    test('Should reject wrong password for known user', () => {
        expect(handler.login('admin', 'wrong')).toBe(false);
    });

    test('Should reject empty password for known user', () => {
        expect(handler.login('admin', '')).toBe(false);
    });

    test('Should allow anonymous user with any non-empty string', () => {
        expect(handler.login('unknown_user', 'anything')).toBe(true);
    });

    test('Should reject empty login', () => {
        expect(handler.login('', 'pass')).toBe(false);
    });

    test('Should reject non-string login', () => {
        expect(handler.login(123, 'pass')).toBe(false);
        expect(handler.login(null, 'pass')).toBe(false);
        expect(handler.login(undefined, 'pass')).toBe(false);
    });
});

describe('getUserGroup', () => {
    test('Should return admin group for admin user', () => {
        expect(handler.getUserGroup('admin')).toBe('admin');
    });

    test('Should return user group for known users', () => {
        expect(handler.getUserGroup('alex')).toBe('user');
        expect(handler.getUserGroup('ben')).toBe('user');
    });

    test('Should return anonymous group for unknown users', () => {
        expect(handler.getUserGroup('stranger')).toBe('anonymous');
    });
});

describe('getUserProjects', () => {
    test('Should return all projects for admin', () => {
        expect(handler.getUserProjects('admin')).toEqual([1, 2, 3]);
    });

    test('Should return limited projects for user group', () => {
        expect(handler.getUserProjects('alex')).toEqual([1, 2]);
    });

    test('Should return minimal projects for anonymous', () => {
        expect(handler.getUserProjects('stranger')).toEqual([1]);
    });
});

describe('isAuthorized', () => {
    test('Should authorize admin for all projects', () => {
        expect(handler.isAuthorized('admin', 1)).toBe(true);
        expect(handler.isAuthorized('admin', 2)).toBe(true);
        expect(handler.isAuthorized('admin', 3)).toBe(true);
    });

    test('Should authorize user group for projects 1 and 2', () => {
        expect(handler.isAuthorized('alex', 1)).toBe(true);
        expect(handler.isAuthorized('alex', 2)).toBe(true);
        expect(handler.isAuthorized('alex', 3)).toBe(false);
    });

    test('Should authorize anonymous for project 1 only', () => {
        expect(handler.isAuthorized('stranger', 1)).toBe(true);
        expect(handler.isAuthorized('stranger', 2)).toBe(false);
    });
});
