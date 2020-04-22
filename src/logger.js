/**
 * logger.js
 * 
 * @fileoverview A simple logger class to replace console.
 * The intention is ot make it easy t o search in the browser's
 * dev console for stack traces.
 * 
 * @author Roger Ngo
 * rngo2@illinois.edu
 * 
 * March, 2020
 */
class Logger {
    constructor() {
        this.label = '[rngo2-MP3]'
    }

    /**
     * We want to log as a warning to provide some contextual
     * information
     * @param {string} text 
     * @param {object} data 
     */
    log(text, data) {
        console.warn(this.label, text, data);
    }

    /**
     * Pass through error logging.
     * @param {string} text
     * @param {object} data 
     */
    error(text, data) {
        console.error(this.label, text, data);
    }
}
