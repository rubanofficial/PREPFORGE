import dotenv from 'dotenv';

/**
 * This file MUST be the very first import in server.js.
 *
 * WHY THIS FILE EXISTS:
 * ──────────────────────────────────────────────────────────────────────────
 * ES Modules (import/export) are STATICALLY resolved and hoisted.
 * That means Node.js executes ALL imported modules before running any code
 * in the importing file.
 *
 * Problem:
 *   server.js does:
 *     import { startSyncWorker } from './workers/syncWorker.js'  ← runs redis.js
 *     dotenv.config()  ← too late! redis.js already ran without env vars
 *
 * Solution:
 *   By importing THIS file first, dotenv.config() is called at module
 *   evaluation time — before any other module (redis.js, database.js, etc.)
 *   reads process.env.
 *
 * Rule: This file must ALWAYS be the first import in server.js.
 */
dotenv.config();
