/**
 * File-based logger utility
 * Sends log messages to the server API endpoint which writes them to log files
 */

class FileLogger {
    constructor() {
        this.queue = [];
        this.flushInterval = null;
        this.batchSize = 10;
        this.flushDelay = 1000;
        this.currentMissionId = null;
        this._isLogging = false;
        this.logLevel = 'info';
        this.logLevels = ['debug', 'info', 'warning', 'error'];
        this.startBatchFlush();
    }
    
    /**
     * Set the log level from config
     * @param {string} level - Log level (debug, info, warning, error)
     */
    setLogLevel(level) {
        if (this.logLevels.includes(level)) {
            this.logLevel = level;
        }
    }
    
    /**
     * Check if a log level should be logged based on current log level setting
     * @param {string} level - Log level to check
     * @returns {boolean} - True if should be logged
     */
    shouldLog(level) {
        const levelIndex = this.logLevels.indexOf(level);
        const currentLevelIndex = this.logLevels.indexOf(this.logLevel);
        return levelIndex >= currentLevelIndex;
    }
    
    setMissionId(missionId) {
        this.currentMissionId = missionId;
    }
    
    /**
     * Log a message to file
     * @param {string} level - Log level (debug, info, warning, error)
     * @param {string} message - Log message
     * @param {object} context - Optional context object to include
     */
    log(level, message, context = {}) {
        if (!this.shouldLog(level)) {
            return;
        }
        
        this.queue.push({
            level,
            message,
            context,
            timestamp: new Date().toISOString()
        });
        
        if (this.queue.length >= this.batchSize) {
            this.flush().catch(err => {
            });
        }
    }
    
    /**
     * Flush queued logs to server
     */
    async flush() {
        if (this.queue.length === 0) return;
        
        const logsToSend = [...this.queue];
        this.queue = [];
        
        for (const logEntry of logsToSend) {
            try {
                await safeFetch('api/log.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        level: logEntry.level,
                        message: logEntry.message,
                        context: logEntry.context,
                        mission_id: this.currentMissionId || 'general'
                    })
                });
            } catch (error) {
            }
        }
    }
    
    /**
     * Start periodic batch flushing
     */
    startBatchFlush() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        
        this.flushInterval = setInterval(() => {
            this.flush();
        }, this.flushDelay);
    }
    
    /**
     * Stop batch flushing
     */
    stopBatchFlush() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flush();
    }
    
    debug(message, context) {
        return this.log('debug', message, context);
    }
    
    info(message, context) {
        return this.log('info', message, context);
    }
    
    warn(message, context) {
        return this.log('warning', message, context);
    }
    
    warning(message, context) {
        return this.log('warning', message, context);
    }
    
    error(message, context) {
        return this.log('error', message, context);
    }
}

window.fileLogger = new FileLogger();

window.addEventListener('beforeunload', () => {
    if (window.fileLogger) {
        window.fileLogger.stopBatchFlush();
    }
});

