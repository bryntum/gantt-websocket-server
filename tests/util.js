const ws = require('ws');

async function awaitTimeout(timeout = 100) {
    await new Promise(resolve => setTimeout(resolve, timeout));
}

async function failAfter(timeout = 1000) {
    await awaitTimeout(timeout);

    return Promise.reject();
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

async function waitForResponse(client, request, ignoreError) {
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
    ]).catch(() => {
        // catch exception, do nothing
        if (!ignoreError) {
            console.log('Request timeout for client', client);
        }
    });
}

/**
 * This function sends request data over the client ws connection and returns next message from the server. If request
 * is null, client will wait for message.
 * @param client Web socket client instance.
 * @param {Object|null} request Data to send to the server. If null, function will only assert next message from the
 * server.
 * @param {Boolean} ignoreError Pass true to not log error messages for expected timeouts
 * @returns {Promise<void>}
 */
async function awaitNextMessage(client, request, ignoreError = false) {
    await waitForConnectionOpen(client);

    return waitForResponse(client, request, ignoreError);
}

module.exports = {
    waitForConnectionOpen,
    awaitNextMessage
};
