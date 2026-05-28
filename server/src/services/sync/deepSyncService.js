import { LeetCode, Credential } from 'leetcode-query';
import { decrypt } from '../../utils/encryption.js';
import Problem from '../../models/Problem.js';
import SyncJob from '../../models/SyncJob.js';
import User from '../../models/User.js';

/**
 * DEEP SYNC SERVICE v2
 * 
 * ============================================================================
 * APPROACH (6 STEPS)
 * ============================================================================
 * 
 * 1. AUTHENTICATION
 *    - Uses a stored LEETCODE_SESSION cookie (already extracted via Puppeteer)
 *    - Initializes leetcode-query's LeetCode client with a Credential object
 *    - Session is already verified before sync starts
 * 
 * 2. FETCH ALL SUBMISSIONS
 *    - Use leetcode-query's submissions({ limit: 20, offset }) in a loop
 *    - Paginate using offset until no more submissions are returned
 *    - Handle response shapes defensively:
 *        a) result is directly an array
 *        b) result.submissionList.submissions is an array
 *        c) result.submissions is an array
 *    - If shape is unexpected, log a warning and break the loop
 *    - Add 500ms delay between each batch to avoid rate limiting
 * 
 * 3. FETCH DIFFICULTY FOR EACH PROBLEM
 *    - After collecting all submissions, extract unique titleSlugs
 *    - For each unique slug, call leetcode-query's lc.problem(slug)
 *    - Extract: title, difficulty ("Easy"/"Medium"/"Hard"), topicTags[].name
 *    - Add 300ms delay between each problem detail call
 *    - Handle errors per slug gracefully (skip and log, don't crash)
 * 
 * 4. NORMALIZE AND SAVE TO MONGODB
 *    - Merge submission data + problem detail data into this shape:
 *      {
 *        userId: ObjectId,
 *        title: String,
 *        titleSlug: String,
 *        difficulty: String,      // Easy | Medium | Hard
 *        status: String,          // Accepted | Wrong Answer etc
 *        language: String,
 *        timestamp: Number,
 *        topics: [String]
 *      }
 *    - Use updateOne with upsert:true, matching on { userId, titleSlug }
 *    - Count inserted, duplicates (not modified), and failed separately
 * 
 * 5. SYNC JOB TRACKING
 *    - A SyncJob document exists in MongoDB with status: "pending"
 *    - Update it to "in_progress" when sync starts
 *    - Update it to "completed" with summary stats when done
 *    - Update it to "failed" with error message if sync crashes
 * 
 * 6. LOGGING
 *    - Log each batch: offset, count received, normalized, inserted, duplicates
 *    - Log each problem detail fetch with title and difficulty
 *    - Log final summary: total inserted, duplicates, failed, duration in ms
 * 
 * ============================================================================
 */

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 500;       // Delay between submission batches
const PROBLEM_DETAIL_DELAY_MS = 300; // Delay between problem detail calls
const MAX_BATCHES = 3000;         // Safety limit: 3000 * 20 = 60,000 max

/**
 * Helper: sleep for ms milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ============================================================================
 * STEP 1: AUTHENTICATION
 * ============================================================================
 * Initialize an authenticated LeetCode client using the stored encrypted
 * LEETCODE_SESSION cookie.
 * 
 * @param {string} encryptedSession - Encrypted session from User document
 * @returns {Promise<{lc: LeetCode|null, error: string|null}>}
 */
async function initializeClient(encryptedSession) {
    try {
        // Decrypt the stored session cookie
        let sessionCookie = decrypt(encryptedSession);

        if (!sessionCookie) {
            return { lc: null, error: 'Failed to decrypt LeetCode session. Session may be corrupted or key changed.' };
        }

        // Strip LEETCODE_SESSION= prefix if user stored the full cookie string
        if (sessionCookie.startsWith('LEETCODE_SESSION=')) {
            sessionCookie = sessionCookie.substring('LEETCODE_SESSION='.length);
            console.log(`🔧 Stripped LEETCODE_SESSION= prefix from session cookie`);
        }

        const sanitized = sessionCookie.length > 12
            ? `${sessionCookie.substring(0, 6)}...${sessionCookie.substring(sessionCookie.length - 6)}`
            : '***';
        console.log(`🔑 Session cookie length: ${sessionCookie.length}, preview: ${sanitized}`);

        // Initialize Credential and LeetCode client
        const credential = new Credential();
        await credential.init(sessionCookie);
        const lc = new LeetCode(credential);

        // Verify authentication with whoami()
        try {
            const whoami = await lc.whoami();
            console.log(`🔐 whoami() → isSignedIn: ${whoami.isSignedIn}, username: ${whoami.username}`);

            if (!whoami.isSignedIn || !whoami.userId) {
                return {
                    lc: null,
                    error: `LeetCode session is NOT authenticated (isSignedIn=${whoami.isSignedIn}). Please re-authenticate with a fresh LEETCODE_SESSION cookie.`,
                };
            }

            console.log(`✅ Session verified — logged in as: ${whoami.username}`);
        } catch (whoamiErr) {
            console.warn(`⚠️  whoami() failed: ${whoamiErr.message} — continuing anyway`);
        }

        return { lc, error: null };
    } catch (err) {
        return { lc: null, error: `Failed to initialize LeetCode connection: ${err.message}` };
    }
}

/**
 * ============================================================================
 * STEP 2: FETCH ALL SUBMISSIONS (paginated)
 * ============================================================================
 * Loops through submissions({ limit: 20, offset }) until no more are returned.
 * 
 * Handles these response shapes defensively:
 *   a) result is directly an array
 *   b) result.submissionList.submissions is an array
 *   c) result.submissions is an array
 * 
 * Adds 500ms delay between each batch to avoid rate limiting.
 * 
 * @param {LeetCode} lc - Authenticated LeetCode client
 * @returns {Promise<Array>} All collected raw submissions
 */
async function fetchAllSubmissions(lc) {
    const allSubmissions = [];
    let offset = 0;
    let batchNum = 0;

    while (batchNum < MAX_BATCHES) {
        batchNum++;
        console.log(`\n📦 BATCH ${batchNum}: offset=${offset}, limit=${BATCH_SIZE}`);

        let raw;
        try {
            raw = await lc.submissions({ limit: BATCH_SIZE, offset });
        } catch (err) {
            console.error(`❌ submissions() threw at offset=${offset}: ${err.message}`);
            break;
        }

        // --- Defensive response parsing ---
        let items = null;

        // Shape (a): result is directly an array
        if (Array.isArray(raw)) {
            items = raw;
            console.log(`   Shape detected: direct array (${items.length} items)`);
        }
        // Shape (b): result.submissionList.submissions
        else if (raw?.submissionList?.submissions && Array.isArray(raw.submissionList.submissions)) {
            items = raw.submissionList.submissions;
            console.log(`   Shape detected: result.submissionList.submissions (${items.length} items)`);
        }
        // Shape (c): result.submissions
        else if (raw?.submissions && Array.isArray(raw.submissions)) {
            items = raw.submissions;
            console.log(`   Shape detected: result.submissions (${items.length} items)`);
        }

        // If shape is unexpected, log a warning and break the loop
        if (!items) {
            console.warn(`⚠️  Unexpected response shape at offset=${offset}. Keys: ${raw ? Object.keys(raw).join(', ') : 'null/undefined'}`);
            console.warn(`   Breaking pagination loop.`);
            break;
        }

        if (items.length === 0) {
            console.log(`   📭 No more submissions returned — end of history.`);
            break;
        }

        console.log(`   ✅ Received ${items.length} submissions`);
        allSubmissions.push(...items);

        // If we got fewer than BATCH_SIZE, we've reached the end
        if (items.length < BATCH_SIZE) {
            console.log(`   📭 Received ${items.length} < ${BATCH_SIZE} — end of history.`);
            break;
        }

        // Move to next page
        offset += BATCH_SIZE;

        // 500ms delay between each batch to avoid rate limiting
        await sleep(BATCH_DELAY_MS);
    }

    console.log(`\n📊 Total submissions collected: ${allSubmissions.length}`);
    return allSubmissions;
}

/**
 * ============================================================================
 * STEP 3: FETCH DIFFICULTY FOR EACH PROBLEM
 * ============================================================================
 * After collecting all submissions, extract unique titleSlugs.
 * For each unique slug, call lc.problem(slug) to get:
 *   - title, difficulty ("Easy"/"Medium"/"Hard"), topicTags[].name
 * 
 * Adds 300ms delay between each problem detail call.
 * Handles errors per slug gracefully (skip and log, don't crash).
 * 
 * @param {LeetCode} lc - Authenticated LeetCode client
 * @param {string[]} uniqueSlugs - Array of unique titleSlugs
 * @returns {Promise<Map<string, {title: string, difficulty: string, topics: string[]}>>}
 */
async function fetchProblemDetails(lc, uniqueSlugs) {
    /** @type {Map<string, {title: string, difficulty: string, topics: string[]}>} */
    const detailsMap = new Map();

    console.log(`\n🔍 Fetching problem details for ${uniqueSlugs.length} unique slugs...`);

    for (let i = 0; i < uniqueSlugs.length; i++) {
        const slug = uniqueSlugs[i];

        try {
            const problemData = await lc.problem(slug);

            if (!problemData) {
                console.warn(`   ⚠️  [${i + 1}/${uniqueSlugs.length}] No data for "${slug}" — skipped`);
                continue;
            }

            const title = problemData.title || slug;
            const difficulty = problemData.difficulty || null;
            const topics = Array.isArray(problemData.topicTags)
                ? problemData.topicTags.map(t => t.name).filter(Boolean)
                : [];

            detailsMap.set(slug, { title, difficulty, topics });

            console.log(`   ✅ [${i + 1}/${uniqueSlugs.length}] "${title}" — ${difficulty || 'N/A'}`);
        } catch (err) {
            console.warn(`   ❌ [${i + 1}/${uniqueSlugs.length}] Error fetching "${slug}": ${err.message} — skipped`);
        }

        // 300ms delay between each problem detail call
        if (i < uniqueSlugs.length - 1) {
            await sleep(PROBLEM_DETAIL_DELAY_MS);
        }
    }

    console.log(`📊 Problem details fetched: ${detailsMap.size}/${uniqueSlugs.length}`);
    return detailsMap;
}

/**
 * ============================================================================
 * STEP 4: NORMALIZE AND SAVE TO MONGODB
 * ============================================================================
 * Only saves ACCEPTED submissions into the Problem collection.
 * Non-accepted submissions (Wrong Answer, TLE, etc.) are skipped.
 * Each accepted problem is stored ONCE (upsert on userId + titleSlug).
 * 
 * Final document shape:
 * {
 *   userId, title, titleSlug, difficulty, language, solvedAt, platform, topics
 * }
 * 
 * Uses updateOne with upsert:true, matching on { userId, titleSlug }.
 * Counts inserted, duplicates (not modified), skipped, and failed separately.
 * 
 * @param {string} userId - MongoDB user ID
 * @param {Array} submissions - All raw submissions
 * @param {Map} detailsMap - Problem detail map (slug → {title, difficulty, topics})
 * @returns {Promise<{inserted: number, duplicates: number, skipped: number, failed: number}>}
 */
async function normalizeAndSave(userId, submissions, detailsMap) {
    let inserted = 0;
    let duplicates = 0;
    let skipped = 0;
    let failed = 0;

    console.log(`\n💾 Normalizing and saving ${submissions.length} submissions...`);
    console.log(`   ℹ️  Only ACCEPTED submissions will be saved to the database.\n`);

    for (const sub of submissions) {
        try {
            // Extract status — only save Accepted submissions
            const status = sub.statusDisplay || 'Unknown';
            if (status !== 'Accepted') {
                skipped++;
                continue;
            }

            // Extract fields from submission
            const titleSlug = (sub.titleSlug || '').trim().toLowerCase();
            if (!titleSlug) {
                failed++;
                continue;
            }

            const title = sub.title?.trim() || detailsMap.get(titleSlug)?.title || titleSlug;
            const language = (sub.lang || '').toLowerCase();
            const timestamp = parseInt(sub.timestamp, 10) || 0;

            // Merge with problem details
            const details = detailsMap.get(titleSlug);
            const difficulty = details?.difficulty || sub.question?.difficulty || null;
            const topics = details?.topics?.length > 0
                ? details.topics.map(t => t.toLowerCase())
                : (Array.isArray(sub.question?.topics)
                    ? sub.question.topics.map(t => (t.slug || t.name || '').toLowerCase()).filter(Boolean)
                    : []);

            // Build the document (only accepted problems — no status field needed)
            const doc = {
                userId,
                title,
                titleSlug,
                difficulty,       // "Easy" | "Medium" | "Hard" | null
                language,
                solvedAt: timestamp > 0 ? new Date(timestamp * 1000) : new Date(),
                platform: 'leetcode',
                topics,
                updatedAt: new Date(),
            };

            // Upsert: updateOne with upsert:true, matching on { userId, titleSlug }
            // Each accepted problem is stored ONCE. Duplicate accepted submissions are ignored.
            const result = await Problem.updateOne(
                { userId, titleSlug },
                { $set: doc },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                inserted++;
            } else if (result.modifiedCount === 0 && result.matchedCount > 0) {
                duplicates++;
            } else {
                // Was matched and modified — count as an update
                inserted++;
            }
        } catch (err) {
            console.error(`   ❌ Failed to save submission: ${err.message}`);
            failed++;
        }
    }

    console.log(`   📊 Save results: inserted=${inserted}, duplicates=${duplicates}, skipped=${skipped} (non-accepted), failed=${failed}`);

    return { inserted, duplicates, skipped, failed };
}

/**
 * ============================================================================
 * MAIN: deepSync(userId, syncJobId)
 * ============================================================================
 * The full deep sync orchestrator.
 * 
 * STEP 1: Authentication (initialize LeetCode client from stored session)
 * STEP 2: Fetch all submissions (paginated with 500ms delay)
 * STEP 3: Fetch difficulty for each unique problem (300ms delay)
 * STEP 4: Normalize and save to MongoDB (upsert)
 * STEP 5: Sync job tracking (pending → in_progress → completed/failed)
 * STEP 6: Logging (per-batch, per-problem, final summary)
 * 
 * @param {string} userId - MongoDB user ID (ObjectId string)
 * @param {string} syncJobId - SyncJob document ID
 * @returns {Promise<Object|null>} Final sync result or null on failure
 */
async function deepSync(userId, syncJobId) {
    const startTime = Date.now();

    // ─── STEP 5a: Load the SyncJob ───
    let syncJob = await SyncJob.findById(syncJobId);
    if (!syncJob) {
        console.error(`❌ SyncJob not found: ${syncJobId}`);
        return null;
    }

    try {
        // ─── STEP 5b: Mark as in_progress ───
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🚀 DEEP SYNC STARTED`);
        console.log(`   SyncJob: ${syncJobId}`);
        console.log(`   User:    ${userId}`);
        console.log(`${'='.repeat(70)}\n`);

        syncJob.status = 'active';
        syncJob.metadata = { ...syncJob.metadata, startedAt: new Date() };
        await syncJob.save();

        // ─── STEP 1: AUTHENTICATION ───
        console.log(`[STEP 1/4] 🔐 Authenticating with LeetCode...`);

        const user = await User.findById(userId).select('encryptedLeetCodeSession');
        if (!user || !user.encryptedLeetCodeSession) {
            throw new Error('No encrypted LeetCode session found for this user. Please store your session first.');
        }

        const { lc, error: authError } = await initializeClient(user.encryptedLeetCodeSession);
        if (authError || !lc) {
            throw new Error(authError || 'Failed to initialize LeetCode client');
        }

        console.log(`✅ Authentication successful\n`);

        // ─── STEP 2: FETCH ALL SUBMISSIONS ───
        console.log(`[STEP 2/4] 📡 Fetching all submissions (paginated)...`);

        const allSubmissions = await fetchAllSubmissions(lc);

        if (allSubmissions.length === 0) {
            console.log(`⚠️  No submissions found. Marking sync as completed.`);
            syncJob.status = 'completed';
            syncJob.completedAt = new Date();
            syncJob.metadata.totalDuration = Date.now() - startTime;
            await syncJob.save();

            return {
                success: true,
                syncJobId,
                metrics: { inserted: 0, duplicates: 0, failed: 0, total: 0 },
            };
        }

        // ─── STEP 3: FETCH DIFFICULTY FOR EACH UNIQUE PROBLEM ───
        console.log(`\n[STEP 3/4] 🔍 Fetching difficulty for each unique problem...`);

        // Extract unique titleSlugs from ACCEPTED submissions only
        // (no point fetching difficulty for problems we won't save)
        const acceptedSubmissions = allSubmissions.filter(s => s.statusDisplay === 'Accepted');
        const uniqueSlugs = [...new Set(
            acceptedSubmissions
                .map(s => (s.titleSlug || '').trim().toLowerCase())
                .filter(Boolean)
        )];

        console.log(`   Total submissions: ${allSubmissions.length}`);
        console.log(`   Accepted submissions: ${acceptedSubmissions.length}`);
        console.log(`   Unique accepted problems to look up: ${uniqueSlugs.length}`);

        const detailsMap = await fetchProblemDetails(lc, uniqueSlugs);

        // ─── STEP 4: NORMALIZE AND SAVE TO MONGODB ───
        console.log(`\n[STEP 4/4] 💾 Normalizing and saving to MongoDB...`);

        const { inserted, duplicates, failed } = await normalizeAndSave(userId, allSubmissions, detailsMap);

        // Update SyncJob progress
        syncJob.progress.processed = allSubmissions.length;
        syncJob.progress.inserted = inserted;
        syncJob.progress.duplicates = duplicates;
        syncJob.progress.failed = failed;

        // ─── STEP 5c: Mark as completed ───
        syncJob.status = 'completed';
        syncJob.completedAt = new Date();
        syncJob.metadata.totalDuration = Date.now() - startTime;
        await syncJob.save();

        // ─── STEP 6: Final logging ───
        const duration = Date.now() - startTime;
        console.log(`\n${'='.repeat(70)}`);
        console.log(`✅ DEEP SYNC COMPLETED`);
        console.log(`   Total submissions fetched: ${allSubmissions.length}`);
        console.log(`   Unique problems:           ${uniqueSlugs.length}`);
        console.log(`   Details fetched:            ${detailsMap.size}`);
        console.log(`   Inserted:                   ${inserted}`);
        console.log(`   Duplicates (unchanged):     ${duplicates}`);
        console.log(`   Failed:                     ${failed}`);
        console.log(`   Duration:                   ${duration}ms`);
        console.log(`${'='.repeat(70)}\n`);

        return {
            success: true,
            syncJobId,
            metrics: {
                total: allSubmissions.length,
                uniqueProblems: uniqueSlugs.length,
                detailsFetched: detailsMap.size,
                inserted,
                duplicates,
                failed,
                durationMs: duration,
            },
        };

    } catch (error) {
        // ─── STEP 5d: Mark as failed ───
        console.error(`\n❌ FATAL SYNC ERROR:`, error.message);

        syncJob.status = 'failed';
        syncJob.error = {
            message: error.message,
            code: 'SYNC_FAILED',
            timestamp: new Date(),
        };
        syncJob.metadata.totalDuration = Date.now() - startTime;
        await syncJob.save();

        console.log(`   SyncJob marked as failed. Duration: ${Date.now() - startTime}ms`);

        return null;
    }
}

/**
 * Legacy wrapper — the controller currently calls performDeepSync(userId, encryptedSession, syncJobId).
 * This bridges the old signature to the new deepSync(userId, syncJobId) function.
 * The encryptedSession param is ignored because deepSync reads it from the User doc directly.
 */
async function performDeepSync(userId, _encryptedSession, syncJobId) {
    return deepSync(userId, syncJobId);
}

/**
 * Retry a failed sync
 */
async function retrySyncJob(syncJobId) {
    const syncJob = await SyncJob.findById(syncJobId);
    if (!syncJob) return false;
    if (syncJob.status !== 'failed') return false;

    syncJob.status = 'pending';
    syncJob.progress = {
        totalExpected: syncJob.progress.totalExpected,
        batchesProcessed: 0,
        processed: 0,
        inserted: 0,
        duplicates: 0,
        failed: 0,
    };
    syncJob.error = null;
    syncJob.completedAt = null;
    await syncJob.save();

    return true;
}

const deepSyncService = {
    deepSync,
    performDeepSync,
    retrySyncJob,
};

export default deepSyncService;
