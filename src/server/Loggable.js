class Loggable {
    /**
     * Logs message to console
     */
    log(txt) {
        console.log(txt);
    }

    /**
     * Logs message to console in debug mode
     */
    debugLog(txt) {
        if (this.debug) {
            this.log(txt);
        }
    }

    /**
     * Logs error message to console
     */
    logError(error) {
        this.log(`Error: ${error.message ? error.message : error}`);
    }
}

module.exports = { Loggable };
