const ws = require('ws');

async function awaitTimeout(timeout = 100) {
    await new Promise(resolve => setTimeout(resolve, timeout));
}

async function failAfter(timeout = 1000) {
    await awaitTimeout(timeout);

    return Promise.reject('timeout');
}

/**
 * Returns promise which resolves when client is open and ready.
 * @param client Web socket client.
 * @returns {Promise<void>}
 */
async function waitForConnectionOpen(client) {
    await new Promise((resolve, reject) => {
        if (client.readyState === ws.CONNECTING) {
            client.once('open', resolve);
        }
        else if (client.readyState === ws.CLOSING || client.readyState === ws.CLOSED) {
            reject('Websocket is closed');
        }
        else {
            resolve();
        }
    });
}

async function waitForResponse(client, request) {
    return Promise.race([
        failAfter(),
        new Promise(resolve => {
            client.once('message', data => {
                resolve(JSON.parse(data));
            });

            if (request) {
                client.send(JSON.stringify(request));
            }
        })
    ]);
}

/**
 * This function sends request data over the client ws connection and returns next message from the server. If request
 * is null, client will wait for message.
 * @param client Web socket client instance.
 * @param {Object} [request] Data to send to the server. If null, function will only assert next message from the
 * server.
 * @param {Boolean} ignoreError Pass true to not log error messages for expected timeouts
 * @returns {Promise<Object>}
 */
async function awaitNextMessage(client, request, ignoreError = false) {
    await waitForConnectionOpen(client);

    return waitForResponse(client, request, ignoreError);
}

/**
 * This function sends request data over the client ws connection and returns next matching command from the server.
 * If request is null, client will wait for message.
 * @param client Web socket client instance.
 * @param {String} command Web socket client instance.
 * @param {Object} [request] Data to send to the server. If null, function will only assert next message from the
 * server.
 * @returns {Promise<Object>}
 */
async function awaitNextCommand(client, command, request) {
    await waitForConnectionOpen(client);

    return Promise.race([
        failAfter(),
        new Promise(resolve => {
            function handler(message) {
                const data = JSON.parse(message);

                if (data.command === command) {
                    client.off('message', handler);
                    resolve(data);
                }
            }

            client.on('message', handler);

            if (request) {
                client.send(JSON.stringify(request));
            }
        })
    ]);
}

/**
 * Logs client on the websocket server
 * @param client
 * @param {String} login=admin
 * @param {String} password=admin
 * @returns {Promise<String[]>}
 */
async function awaitAuth(client, login = 'admin', password = 'admin') {
    await waitForConnectionOpen(client);

    const [{ error }, { users }] = await Promise.all([
        awaitNextCommand(client, 'login', { command : 'login', login, password }),
        awaitNextCommand(client, 'users')
    ]);

    if (!error) {
        return users;
    }
    else {
        return [];
    }
}

/**
 * Logs user in and requests dataset
 * @param client
 * @param {Number} project
 * @param {String} login
 * @param {String} password
 * @returns {Promise<void>}
 */
async function awaitDataset(client, project, login = 'admin', password = 'admin') {
    await awaitAuth(client, login, password);

    return awaitNextCommand(client, 'dataset', { command : 'dataset', project });
}

module.exports = {
    awaitTimeout,
    waitForConnectionOpen,
    awaitNextMessage,
    awaitNextCommand,
    awaitAuth,
    awaitDataset
};
