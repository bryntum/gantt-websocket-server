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
        else if (typeof username === 'string' && username) {
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

    /**
     * Returns user group name
     * @param {String} username
     * @returns {String}
     */
    getUserGroup(username) {
        return username in USERS ? USERS[username].group : 'anonymous'
    }

    /**
     * Returns list of project ids user is allowed to access
     * @param {String} username
     * @returns {Number[]}
     */
    getUserProjects(username) {
        const group = this.getUserGroup(username);

        return ACCESS_RIGHTS[group];
    }

    /**
     * Decorates message handler with auth validation
     * @param {Function} fn
     * @returns {Function}
     */
    requireAuth(fn) {
        const me = this;

        return function (ws, message) {
            const { command, data : { project } } = message;

            if (ws.userName) {
                let authorized;

                if (['reset', 'dataset', 'project_change'].includes(command)) {
                    if (project != null) {
                        // authorized = me.isAuthorized(ws.userName, project);
                        authorized = true;
                    }
                    else {
                        ws.send(JSON.stringify({ command, error : 'Project id is required' }));
                    }
                }
                else {
                    authorized = true;
                }

                if (authorized) {
                    return fn.call(me, ws, message);
                }
                else {
                    ws.send(JSON.stringify({ command, error : 'Authorization required' }))
                }
            }
            else {
                ws.send(JSON.stringify({ command, error : 'Authentication required' }))
            }
        };
    }
}

module.exports = { AuthorizationHandler };
