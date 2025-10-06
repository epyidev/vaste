// Logging utility
function log(message, level = "INFO") {
    const timestamp = new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    console.log(`[VASTE] ${timestamp} ${level}: ${message}`);
}

function warn(message) {
    log(message, "WARN");
}

function error(message) {
    log(message, "ERROR");
}

function debug(message) {
    log(message, "DEBUG");
}

module.exports = { log, warn, error, debug };