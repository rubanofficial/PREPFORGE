import leetcodeAuthProvider from '../providers/leetcodeAuthProvider.js';
import problemMetadataService from '../enrichment/problemMetadataService.js';
import Problem from '../../models/Problem.js';
import SyncJob from '../../models/SyncJob.js';
import { getIO } from '../../socketManager.js';

/**
 * DEEP SYNC SERVICE
 * 
 * ============================================================================
 * WHAT IS THIS?
 * ============================================================================
 * Service that orchestrates REAL pagination-based syncing of LeetCode
 * submission history into our database.
 * 
 * ============================================================================
 * WHY DEEP SYNC?
 * ============================================================================
 * SHALLOW SYNC (Old Approach - DEPRECATED):
 * ❌ Fetches only recent problems
 * ❌ No pagination support
 * ❌ Can't get historical data
 * ❌ Missing analytics foundation
 * 
 * DEEP SYNC (New Approach - CURRENT):
 * ✅ Fetches ENTIRE solving history
 * ✅ Supports true pagination (offset/limit)
 * ✅ Builds complete historical record
 * ✅ Foundation for:
 *    - Topic mastery scoring
 *    - Revision engine
 *    - Learning analytics
 *    - Recommendation system
 *    - AI preparation insights
 * 
 * ============================================================================
 * HOW DEEP SYNC WORKS
 * ============================================================================
 * 
 * FLOW:
 * 1. User initiates sync (provides encrypted session)
 * 2. Backend creates SyncJob (tracks progress)
 * 3. Background service starts pagination loop
 * 4. For each batch:
 *    a) Fetch submissions (offset, limit)
 *    b) Normalize data (extract title, slug, timestamp)
 *    c) Filter accepted-only (skip rejected/errors)
 *    d) Deduplicate (use Set to prevent duplicates)
 *    e) Insert into MongoDB (compound unique index prevents dups)
 *    f) Track metrics (inserted, duplicates, etc)
 * 5. Loop continues until no more submissions
 * 6. Mark SyncJob as completed
 * 7. Return final metrics
 * 
 * ============================================================================
 * PAGINATION EXAMPLE
 * ============================================================================
 * 
 * User has 342 solved problems:
 * 
 * Batch 1: offset=0,  limit=20 → fetch items 0-19   → 20 items
 * Batch 2: offset=20, limit=20 → fetch items 20-39  → 20 items
 * Batch 3: offset=40, limit=20 → fetch items 40-59  → 20 items
 * ...
 * Batch 17: offset=320, limit=20 → fetch items 320-341 → 22 items
 * Batch 18: offset=340, limit=20 → fetch items nothing   → 0 items (STOP)
 * 
 * Total fetched: ~342 problems across 17 batches
 * 
 * ============================================================================
 * DEDUPLICATION STRATEGY
 * ============================================================================
 * 
 * Problem:
 * - What if user has same problem in multiple batches?
 * - What if sync runs twice?
 * 
 * Solution (Multi-layer):
 * 1. Set() in memory: Filter duplicate titles within same sync
 * 2. Database unique index: (userId + titleSlug) prevents exact duplicates
 * 3. Conflict handling: updateOne with upsert = only insert if new
 * 
 * Result:
 * - No duplicate problems in database
 * - Complete history preserved
 * - Idempotent (safe to run multiple times)
 * 
 * ============================================================================
 * WHAT DATA IS STORED?
 * ============================================================================
 * 
 * REQUIRED (normalized from LeetCode):
 * - title: "Two Sum"
 * - titleSlug: "two-sum"
 * - solvedAt: 2023-01-15T14:30:00Z (from submission timestamp)
 * - platform: "leetcode"
 * - userId: ObjectId
 * 
 * OPTIONAL (can be enriched later):
 * - language: "python" (from submission language)
 * - difficulty: "Easy" (from problem metadata)
 * - topics: ["array", "hash-table"] (from problem metadata)
 * 
 * ============================================================================
 * ERROR HANDLING & RECOVERY
 * ============================================================================
 * 
 * Handles:
 * - Session expiration → Mark failed, return error
 * - Network timeout → Retry logic
 * - Rate limiting → Backoff and retry
 * - Database errors → Log and continue
 * - Corrupted data → Skip and continue
 * 
 * All errors are logged and tracked in SyncJob for debugging
 * 
 * ============================================================================
 * MONITORING & LOGGING
 * ============================================================================
 * 
 * Logs per batch:
 * - Current offset/limit
 * - Items fetched
 * - Items normalized
 * - Items filtered (rejected answers, errors)
 * - Items inserted
 * - Duplicate count
 * - Failed count
 * 
 * This allows real-time debugging of sync progress
 * 
 * ============================================================================
 */

const BATCH_SIZE = 20;
const MAX_BATCHES = 3000; // 3000 * 20 = 60,000 max problems per sync

/**
 * Normalize a single submission into Problem document
 * 
 * @param {Object} submission - LeetCode submission object (may include enriched metadata)
 * @param {string} userId - User ID (MongoDB)
 * @returns {Object|null} Normalized problem document or null if invalid
 * 
 * NORMALIZATION:
 * - Extract only required fields (title, titleSlug, timestamp)
 * - Include optional enriched fields (difficulty, topics, language)
 * - Convert timestamps to Date objects
 * - Validate required fields
 * 
 * IMPORTANT: This function now receives enriched submissions that already include:
 * - difficulty (from ProblemMetadata cache/API)
 * - topics (from ProblemMetadata cache/API)
 * - language (from original submission)
 */
function normalizeSubmission(submission, userId) {
    try {
        // LeetCode submission structure:
        // {
        //   id: "123456",
        //   title: "Two Sum",
        //   titleSlug: "two-sum",
        //   timestamp: 1234567890,
        //   statusDisplay: "Accepted",
        //   lang: "python",
        //   difficulty: "Easy" (enriched)
        //   topics: ["array", "hash-table"] (enriched)
        //   ...
        // }

        // Only include accepted submissions
        if (submission.statusDisplay !== 'Accepted') {
            return null;
        }

        // Extract required fields
        const title = submission.title?.trim();
        const titleSlug = submission.titleSlug?.trim().toLowerCase();
        const timestamp = submission.timestamp;

        // Validate required fields
        if (!title || !titleSlug || !timestamp) {
            return null;
        }

        // Build problem document
        const problemDoc = {
            title,
            titleSlug,
            solvedAt: new Date(parseInt(timestamp) * 1000), // Convert Unix timestamp to Date
            platform: 'leetcode',
            userId,
        };

        // Optional: add difficulty (from enriched metadata)
        if (submission.difficulty) {
            problemDoc.difficulty = submission.difficulty;
        }

        // Optional: add topics (from enriched metadata)
        if (Array.isArray(submission.topics) && submission.topics.length > 0) {
            problemDoc.topics = submission.topics.map((t) =>
                typeof t === 'string' ? t.toLowerCase() : t
            );
        }

        // Optional: add language from original submission
        if (submission.lang) {
            problemDoc.language = submission.lang.toLowerCase();
        }

        return problemDoc;
    } catch (error) {
        console.error(`❌ Failed to normalize submission:`, error.message);
        return null;
    }
}

/**
 * Process a single batch of submissions
 * 
 * @param {Array} submissions - Raw submissions from LeetCode API
 * @param {string} userId - User ID (MongoDB)
 * @param {SyncJob} syncJob - SyncJob document to update
 * @returns {Promise<Object>} Batch metrics {inserted, duplicates, failed, normalized}
 * 
 * BATCH PROCESSING:
 * 1. Normalize each submission
 * 2. Filter out duplicates (using Set)
 * 3. Insert into database
 * 4. Track metrics
 */
async function processBatch(submissions, userId, syncJob) {
    const metrics = {
        normalized: 0,
        inserted: 0,
        duplicates: 0,
        failed: 0,
    };

    if (!submissions || submissions.length === 0) {
        return metrics;
    }

    try {
        // Step 1: Normalize submissions
        const normalizedProblems = [];
        const seenSlugs = new Set(); // Prevent duplicates within batch

        for (const submission of submissions) {
            const normalized = normalizeSubmission(submission, userId);

            if (!normalized) {
                metrics.failed++;
                continue;
            }

            // Deduplication within batch (using Set)
            if (seenSlugs.has(normalized.titleSlug)) {
                metrics.duplicates++;
                continue;
            }

            seenSlugs.add(normalized.titleSlug);
            normalizedProblems.push(normalized);
            metrics.normalized++;
        }

        // Step 2: Insert problems into database
        // Use insertMany with ordered: false to continue on duplicate key errors
        if (normalizedProblems.length > 0) {
            try {
                const result = await Problem.insertMany(normalizedProblems, {
                    ordered: false, // Continue inserting even if some fail
                });
                metrics.inserted = result.length;
            } catch (error) {
                // insertMany throws if ALL fail, but we still get partial results
                // If it's a duplicate key error, some were inserted
                if (error.code === 11000) {
                    // Duplicate key error - some inserts succeeded
                    metrics.inserted = error.result?.insertedCount || 0;
                    const alreadyExisted = normalizedProblems.length - (error.writeErrors?.length || 0);
                    metrics.duplicates += alreadyExisted;
                } else {
                    console.error(`❌ Database insert error:`, error.message);
                    metrics.failed += normalizedProblems.length;
                }
            }
        }

        return metrics;
    } catch (error) {
        console.error(`❌ Batch processing error:`, error.message);
        metrics.failed += submissions.length;
        return metrics;
    }
}

/**
 * Main deep sync function
 * 
 * @param {string} userId - User ID (MongoDB)
 * @param {string} encryptedSession - Encrypted LeetCode session
 * @param {string} syncJobId - SyncJob ID to update
 * @returns {Promise<Object>} Final sync result
 * 
 * FLOW:
 * 1. Initialize authenticated connection
 * 2. Fetch batches with pagination
 * 3. Process each batch (normalize, deduplicate, insert)
 * 4. Update SyncJob with progress
 * 5. Stop when no more submissions
 * 6. Mark SyncJob as completed
 * 
 * THIS IS AN ASYNC OPERATION:
 * - Starts immediately
 * - Runs in background
 * - Returns result to SyncJob model
 * - Does NOT block HTTP response
 */
async function performDeepSync(userId, encryptedSession, syncJobId) {
    const startTime = Date.now();
    let syncJob = await SyncJob.findById(syncJobId);

    if (!syncJob) {
        console.error(`❌ SyncJob not found: ${syncJobId}`);
        return null;
    }

    try {
        // Step 1: Initialize authenticated connection
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🚀 DEEP SYNC STARTED`);
        console.log(`   SyncJob: ${syncJobId}`);
        console.log(`   User: ${userId}`);
        console.log(`${'='.repeat(70)}\n`);

        syncJob.status = 'active';
        syncJob.metadata = { ...syncJob.metadata, startedAt: new Date() };
        await syncJob.save();

        const { leetcode, error: initError } = await leetcodeAuthProvider.initializeAuthenticatedConnection(
            encryptedSession
        );

        if (initError) {
            console.error(`❌ Failed to initialize connection:`, initError);
            syncJob.status = 'failed';
            syncJob.error = {
                message: initError.message,
                code: initError.type,
                timestamp: new Date(),
            };
            await syncJob.save();
            return null;
        }

        // Step 2: Verify user profile (validate session + check if user exists)
        console.log(`\n✅ Authenticated connection initialized`);
        console.log(`📋 Fetching user profile to validate session...`);
        console.log(`   Username: ${syncJob.username}`);

        const { profile, error: profileError } = await leetcodeAuthProvider.fetchUserProfile(
            leetcode,
            syncJob.username
        );

        if (profileError) {
            console.error(`❌ Profile fetch error:`, profileError);
            syncJob.status = 'failed';
            syncJob.error = {
                message: profileError.message,
                code: profileError.type,
                timestamp: new Date(),
            };
            await syncJob.save();
            return null;
        }

        if (!profile) {
            console.error(`❌ No profile data returned`);
            syncJob.status = 'failed';
            syncJob.error = {
                message: 'Could not fetch user profile from LeetCode',
                code: 'PROFILE_NOT_FOUND',
                timestamp: new Date(),
            };
            await syncJob.save();
            return null;
        }

        console.log(`✅ User profile verified`);
        console.log(`   Username: ${profile.username || 'N/A'}`);
        console.log(`   Real Name: ${profile.realName || 'N/A'}`);

        // Try to extract total expected submissions to show accurate progress percentage
        let totalExpected = 0;
        try {
            if (profile.matchedUser?.submitStatsGlobal?.acSubmissionNum) {
                const allStats = profile.matchedUser.submitStatsGlobal.acSubmissionNum.find(s => s.difficulty === 'All');
                if (allStats && allStats.count) {
                    totalExpected = allStats.count;
                }
            }
        } catch (e) {
            console.log(`⚠️  Could not extract total expected count from profile`);
        }

        if (totalExpected > 0) {
            syncJob.progress.totalExpected = totalExpected;
            await syncJob.save();
            console.log(`   Total expected solved problems: ${totalExpected}`);
        }

        // Step 3: Start pagination loop
        let offset = 0;
        let batchCount = 0;
        let totalInserted = 0;
        let totalDuplicates = 0;
        let totalFailed = 0;
        let totalSubmissionsProcessed = 0; // Track total submissions for failure detection
        let consecutiveFailures = 0; // Track consecutive failures
        let allSubmissions = []; // Collect ALL submissions for batch metadata enrichment

        while (batchCount < MAX_BATCHES) {
            batchCount++;

            console.log(`\n📦 BATCH ${batchCount}`);
            console.log(`   offset=${offset}, limit=${BATCH_SIZE}`);

            // Fetch submissions with pagination
            const { submissions, hasMore, error: fetchError } = await leetcodeAuthProvider.fetchSubmissions(
                leetcode,
                offset,
                BATCH_SIZE
            );

            if (fetchError) {
                console.error(`❌ Fetch error [${fetchError.type}]:`, fetchError.message);

                // Increment consecutive failure counter
                consecutiveFailures++;
                console.warn(`⚠️  Consecutive failures: ${consecutiveFailures}/3`);

                // Non-recoverable errors (auth failures) - stop immediately
                if (!fetchError.recoverable) {
                    syncJob.status = 'failed';
                    syncJob.error = {
                        message: fetchError.message,
                        code: fetchError.type,
                        timestamp: new Date(),
                    };
                    await syncJob.save();
                    getIO()?.to(userId.toString()).emit('sync-failed', {
                        status: 'failed',
                        error: fetchError.message,
                        progressPercent: 0,
                    });
                    console.error(`❌ Non-recoverable error. Stopping sync.`);
                    break;
                }

                // Stop after 3 consecutive failures
                if (consecutiveFailures >= 3) {
                    syncJob.status = 'failed';
                    syncJob.error = {
                        message: `Too many consecutive fetch failures (${consecutiveFailures}): ${fetchError.message}`,
                        code: 'CONSECUTIVE_FAILURES',
                        timestamp: new Date(),
                    };
                    await syncJob.save();
                    getIO()?.to(userId.toString()).emit('sync-failed', {
                        status: 'failed',
                        error: `Too many consecutive fetch failures: ${fetchError.message}`,
                        progressPercent: 0,
                    });
                    console.error(`❌ 3 consecutive failures. Stopping sync.`);
                    break;
                }

                // Skip this batch but continue
                offset += BATCH_SIZE;
                continue;
            }

            // Reset consecutive failure counter on successful fetch
            consecutiveFailures = 0;

            // Collect submissions for metadata enrichment
            if (submissions && submissions.length > 0) {
                allSubmissions.push(...submissions);
                totalSubmissionsProcessed += submissions.length;

                // Progressively update fetched progress
                syncJob.progress.processed = totalSubmissionsProcessed;
                await syncJob.save();

                // Emit real-time fetch progress via Socket.io
                const fetchPercent = syncJob.progress.totalExpected > 0
                    ? Math.min(Math.round((totalSubmissionsProcessed / syncJob.progress.totalExpected) * 50), 50)
                    : 0; // first 50% = fetching phase
                getIO()?.to(userId.toString()).emit('sync-progress', {
                    status: 'active',
                    phase: 'fetching',
                    progress: {
                        expectedProblems: syncJob.progress.totalExpected,
                        fetchedFromProvider: totalSubmissionsProcessed,
                        insertedToDatabase: syncJob.progress.inserted,
                        duplicatesSkipped: syncJob.progress.duplicates,
                        failedToProcess: syncJob.progress.failed,
                    },
                    progressPercent: fetchPercent,
                });
            }

            console.log(`   ✅ Fetched ${submissions.length} submissions (hasMore: ${hasMore})`);

            // Step 3b: Check if more submissions exist
            if (!hasMore || submissions.length === 0) {
                console.log(`\n✅ No more submissions from API. Processing metadata enrichment...`);
                break;
            }

            // Move to next batch
            offset += BATCH_SIZE;
        }

        // CRITICAL FIX: Check if we fetched ANY submissions
        if (totalSubmissionsProcessed === 0) {
            console.warn(`\n⚠️  WARNING: Zero submissions processed from LeetCode API`);
            syncJob.status = 'failed';
            syncJob.error = {
                message: 'No submissions returned from LeetCode API. Session may be invalid or user has no solved problems.',
                code: 'ZERO_SUBMISSIONS',
                timestamp: new Date(),
            };
            await syncJob.save();
            console.error(`❌ SYNC FAILED: Zero submissions processed`);
            return null;
        }

        // Step 4: Batch fetch metadata for all unique titleSlugs
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🔍 METADATA ENRICHMENT PHASE`);
        console.log(`   Total submissions to enrich: ${totalSubmissionsProcessed}`);
        console.log(`${'='.repeat(70)}`);

        // Extract unique titleSlugs
        const uniqueSlugs = [...new Set(allSubmissions.map(s => s.titleSlug))];
        console.log(`   Unique problems: ${uniqueSlugs.length}`);

        // Batch fetch metadata with controlled concurrency
        const { success: metadataSuccess, metadata: metadataMap, stats: metadataStats, authFailed } =
            await problemMetadataService.batchFetchMetadata(leetcode, uniqueSlugs);

        // Check for auth failures during metadata fetch
        if (authFailed) {
            syncJob.status = 'failed';
            syncJob.error = {
                message: 'Authentication failed during metadata enrichment phase',
                code: 'AUTH_FAILED_METADATA',
                timestamp: new Date(),
            };
            await syncJob.save();
            console.error(`❌ Auth failed during metadata fetch. Stopping sync.`);
            return null;
        }

        // Enrich submissions with metadata
        const enrichedSubmissions = problemMetadataService.enrichSubmissionsWithMetadata(
            allSubmissions,
            metadataMap
        );

        console.log(`\n✅ Enrichment complete - Starting database insertion...`);

        // Step 5: Process enriched submissions in batches
        const INSERTION_BATCH_SIZE = 50; // Insert 50 at a time
        for (let i = 0; i < enrichedSubmissions.length; i += INSERTION_BATCH_SIZE) {
            const insertBatch = enrichedSubmissions.slice(i, i + INSERTION_BATCH_SIZE);
            const insertBatchNum = Math.floor(i / INSERTION_BATCH_SIZE) + 1;
            const insertTotalBatches = Math.ceil(enrichedSubmissions.length / INSERTION_BATCH_SIZE);

            const batchMetrics = await processBatch(insertBatch, userId, syncJob);

            syncJob.progress.batchesProcessed = insertBatchNum;
            syncJob.progress.inserted += batchMetrics.inserted;
            syncJob.progress.duplicates += batchMetrics.duplicates;
            syncJob.progress.failed += batchMetrics.failed;

            totalInserted += batchMetrics.inserted;
            totalDuplicates += batchMetrics.duplicates;
            totalFailed += batchMetrics.failed;

            console.log(`   Insertion batch ${insertBatchNum}/${insertTotalBatches} - Inserted: ${batchMetrics.inserted}, Duplicates: ${batchMetrics.duplicates}, Failed: ${batchMetrics.failed}`);

            await syncJob.save();

            // Emit real-time insertion progress (second 50% of progress bar)
            const insertPercent = 50 + Math.round((insertBatchNum / insertTotalBatches) * 50);
            getIO()?.to(userId.toString()).emit('sync-progress', {
                status: 'active',
                phase: 'inserting',
                progress: {
                    expectedProblems: syncJob.progress.totalExpected,
                    fetchedFromProvider: syncJob.progress.processed,
                    insertedToDatabase: syncJob.progress.inserted,
                    duplicatesSkipped: syncJob.progress.duplicates,
                    failedToProcess: syncJob.progress.failed,
                },
                progressPercent: Math.min(insertPercent, 99),
            });
        }

        // CRITICAL FIX: Verify we actually inserted something
        if (totalInserted === 0 && totalDuplicates === 0) {
            console.error(`\n❌ SYNC FAILED: No problems were inserted or found as duplicates`);
            syncJob.status = 'failed';
            syncJob.error = {
                message: 'No problems were successfully inserted. All submissions may have failed processing.',
                code: 'ZERO_INSERTIONS',
                timestamp: new Date(),
            };
            await syncJob.save();
            return null;
        }

        // Step 6: Mark as completed
        syncJob.status = 'completed';
        syncJob.completedAt = new Date();
        syncJob.metadata.totalDuration = Date.now() - startTime;
        syncJob.metadata.metadataStats = metadataStats;

        await syncJob.save();

        // Emit completion event
        getIO()?.to(userId.toString()).emit('sync-complete', {
            status: 'completed',
            progress: {
                expectedProblems: syncJob.progress.totalExpected,
                fetchedFromProvider: syncJob.progress.processed,
                insertedToDatabase: totalInserted,
                duplicatesSkipped: totalDuplicates,
                failedToProcess: totalFailed,
            },
            progressPercent: 100,
        });

        console.log(`\n${'='.repeat(70)}`);
        console.log(`✅ DEEP SYNC COMPLETED`);
        console.log(`   Total Inserted: ${totalInserted}`);
        console.log(`   Total Duplicates: ${totalDuplicates}`);
        console.log(`   Total Failed: ${totalFailed}`);
        console.log(`   Metadata Cached: ${metadataStats.cached}`);
        console.log(`   Metadata Fetched: ${metadataStats.fetched}`);
        console.log(`   Metadata Failed: ${metadataStats.failed}`);
        console.log(`   Duration: ${Date.now() - startTime}ms`);
        console.log(`${'='.repeat(70)}\n`);

        return {
            success: true,
            syncJobId,
            metrics: {
                inserted: totalInserted,
                duplicates: totalDuplicates,
                failed: totalFailed,
                processed: syncJob.progress.processed,
                metadataStats,
            },
        };
    } catch (error) {
        console.error(`❌ FATAL SYNC ERROR:`, error);

        syncJob.status = 'failed';
        syncJob.error = {
            message: error.message,
            code: 'UNKNOWN_ERROR',
            timestamp: new Date(),
        };
        await syncJob.save();

        // Emit failure event
        getIO()?.to(userId.toString()).emit('sync-failed', {
            status: 'failed',
            error: error.message,
            progressPercent: 0,
        });

        return null;
    }
}

/**
 * Retry a failed sync
 * 
 * @param {string} syncJobId - SyncJob ID to retry
 * @returns {Promise<boolean>} Success status
 */
async function retrySyncJob(syncJobId) {
    const syncJob = await SyncJob.findById(syncJobId);

    if (!syncJob) {
        return false;
    }

    // Only retry failed jobs
    if (syncJob.status !== 'failed') {
        return false;
    }

    // Reset progress
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
    performDeepSync,
    retrySyncJob,
    normalizeSubmission,
    processBatch,
};

export default deepSyncService;
