const { Loggable } = require('./Loggable.js');

const USERS = {
    'admin' : { group : 'admin', password : 'admin' },
    'alex'  : { group : 'user', password : 'alex' },
    'ben'   : { group : 'user', password : 'ben' }
};

// Maps user group to list of available projects
const ACCESS_RIGHTS = {
    'admin'     : [1, 2, 3],
    'user'      : [1, 2],
    'anonymous' : [1]
};

class AuthorizationHandler extends Loggable {
    constructor(config) {
        super(config);
    }

    /**
     *
     * @param {String} username
     * @param {String} password
     */
    login(username, password) {
        let result = false;

        // If user is registered check the password
        if (username in USERS) {
            if (password === USERS[username].password) {
                result = true;
            }
        }
        else {
            // Let in anonymous user
            result = true;
        }

        return result;
    }

    /**
     * This method checks if specific websocket client connection has authorization to access to the certain project.
     * @param {*} username
     * @param {Number} projectId
     * @returns {Boolean}
     */
    isAuthorized(username, projectId) {
        return this.getUserProjects(username).includes(projectId);
    }

    getUserGroup(username) {
        return username in USERS ? USERS[username].group : 'anonymous'
    }

    getUserProjects(username) {
        const group = this.getUserGroup(username);

        return ACCESS_RIGHTS[group];
    }
}

module.exports = { AuthorizationHandler };
