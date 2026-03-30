class MessageLogger {
    constructor(maxSize = 200) {
        this.maxSize = maxSize;
        this.messages = [];
        this.totalCount = 0;
    }

    log({ direction, clientId, userName, command, data }) {
        const dataStr = data !== undefined ? JSON.stringify(data) : '';

        const entry = {
            timestamp : Date.now(),
            direction,
            clientId,
            userName  : userName || '(unauthenticated)',
            command,
            data,
            dataPreview : dataStr.length > 200 ? dataStr.slice(0, 200) + '...' : dataStr
        };

        this.messages.push(entry);
        this.totalCount++;

        if (this.messages.length > this.maxSize) {
            this.messages.shift();
        }
    }

    getMessages() {
        return this.messages;
    }

    getCount() {
        return this.totalCount;
    }

    clear() {
        this.messages = [];
        this.totalCount = 0;
    }
}

module.exports = { MessageLogger };
