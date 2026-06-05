/**
 * SOCKET MANAGER (Server-side)
 *
 * Breaks the circular dependency:
 *   server.js → routes → controller → deepSyncService → server.js  ❌
 *
 * Instead:
 *   server.js        → setIO(io)        ← initializes the instance
 *   deepSyncService  → getIO().emit()   ← reads the instance at call-time
 *
 * Because getIO() is called INSIDE an async function (not at import time),
 * the io instance is always fully initialized by then.
 */

let _io = null;

export function setIO(ioInstance) {
    _io = ioInstance;
    console.log('📡 Socket manager: io instance registered');
}

export function getIO() {
    if (!_io) {
        console.warn('⚠️  Socket manager: getIO() called before setIO() — returning null');
    }
    return _io;
}
