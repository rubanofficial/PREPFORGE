/**
 * NORMALIZATION LAYER - Transforms external LeetCode API response to internal format
 * 
 * WHY NORMALIZATION LAYERS MATTER:
 * 
 * 1. DECOUPLING: Database schema independent from external API structure
 *    - If LeetCode adds new fields, we just ignore them
 *    - If LeetCode removes fields, we handle gracefully
 *    - We only store what WE need
 * 
 * 2. SINGLE RESPONSIBILITY: Each layer has ONE job
 *    - Provider: Fetch from API
 *    - Normalization: Transform to internal format
 *    - Controller: Business logic (dedup, insert, etc)
 *    - MongoDB: Store data
 * 
 * 3. TESTING: Easy to test each layer independently
 *    - Mock provider response → test normalization → test controller
 *    - Each layer testable without external dependencies
 * 
 * 4. FUTURE FLEXIBILITY: Easy to add new providers
 *    - GFG provider → use GFG normalization → same controller
 *    - Codeforces provider → use CF normalization → same controller
 *    - Only normalization layer changes, not controller
 * 
 * 5. DATA OWNERSHIP: Backend owns internal data structure
 *    - LeetCode response ≠ our database schema
 *    - We control what fields matter to us
 *    - We can add derived fields (topic, difficulty, etc) later
 * 
 * 6. LIGHTWEIGHT INGESTION: Only store what we need
 *    - Why? Avoid bloat, reduce storage, faster queries
 *    - We get: problem name, when solved
 *    - We skip: code, editorials, discussions, huge objects
 */

/**
 * Normalize a single accepted submission from Alfa LeetCode API
 * 
 * Alfa API returns: { title, titleSlug, timestamp, ... }
 * We extract ONLY what we need for our database
 * 
 * @param {Object} submission - Raw submission from Alfa LeetCode API
 * @returns {Object|null} Normalized problem object or null if invalid
 */
function normalizeSubmission(submission) {
    if (!submission) {
        return null;
    }

    // Extract only the fields we need
    const { title, titleSlug, timestamp } = submission;

    // Validate required fields
    if (!title || !titleSlug || timestamp === undefined) {
        console.warn(`⚠️  Normalization: Skipping invalid submission (missing required fields)`, {
            title: title ? '✓' : '✗',
            titleSlug: titleSlug ? '✓' : '✗',
            timestamp: timestamp !== undefined ? '✓' : '✗'
        });
        return null;
    }

    // Convert timestamp to Date object
    // Alfa API returns timestamp in seconds (Unix epoch)
    let solvedAt;
    if (typeof timestamp === 'string') {
        solvedAt = new Date(parseInt(timestamp) * 1000);
    } else {
        solvedAt = new Date(timestamp * 1000);
    }

    // Validate date
    if (isNaN(solvedAt.getTime())) {
        console.warn(`⚠️  Normalization: Invalid timestamp:`, timestamp);
        return null;
    }

    return {
        title: title.trim(),
        titleSlug: titleSlug.toLowerCase().trim(),
        solvedAt,
        platform: 'leetcode'
    };
}

/**
 * Normalize accepted problems response from Alfa LeetCode API provider
 * 
 * INPUT EXAMPLE (raw Alfa API response):
 * {
 *   username: 's_ruban',
 *   submissions: [
 *     { title: 'Two Sum', titleSlug: 'two-sum', timestamp: 1234567890 },
 *     { title: 'Add Two Numbers', titleSlug: 'add-two-numbers', timestamp: 1234567891 },
 *     ...
 *   ],
 *   fetchedAt: '2026-05-20T10:30:00.000Z'
 * }
 * 
 * OUTPUT EXAMPLE (normalized for our database):
 * {
 *   username: 's_ruban',
 *   problems: [
 *     { title: 'Two Sum', titleSlug: 'two-sum', solvedAt: Date, platform: 'leetcode' },
 *     { title: 'Add Two Numbers', titleSlug: 'add-two-numbers', solvedAt: Date, platform: 'leetcode' },
 *     ...
 *   ],
 *   stats: {
 *     total: 2,
 *     valid: 2,
 *     invalid: 0,
 *     duplicates: 0
 *   },
 *   normalizedAt: Date
 * }
 * 
 * @param {Object} rawResponse - Raw response from provider
 * @param {string} userId - MongoDB user ID
 * @returns {Object} Normalized problems with metadata
 */
export function normalizeAcceptedProblems(rawResponse, userId) {
    console.log(`📝 Normalization: Processing accepted problems for user ${userId}`);

    // Validate input
    if (!rawResponse) {
        throw new Error('Normalization: Invalid raw response (null/undefined)');
    }

    if (!rawResponse.data) {
        throw new Error('Normalization: Response missing data field');
    }

    const {
        username = 'unknown',
        submissions = []
    } = rawResponse.data;

    // Track stats
    let validCount = 0;
    let invalidCount = 0;
    const seenProblems = new Set(); // Track duplicates
    let duplicateCount = 0;

    console.log(`📊 Normalization: Processing ${submissions.length} submissions...`);

    // Normalize each submission
    const problems = submissions
        .map((submission, index) => {
            const normalized = normalizeSubmission(submission);

            if (!normalized) {
                invalidCount++;
                return null;
            }

            // Check for duplicates (by titleSlug)
            if (seenProblems.has(normalized.titleSlug)) {
                console.warn(`⚠️  Normalization: Duplicate problem "${normalized.titleSlug}" (index: ${index})`);
                duplicateCount++;
                return null;
            }

            seenProblems.add(normalized.titleSlug);
            validCount++;
            return normalized;
        })
        .filter(problem => problem !== null);

    console.log(`✅ Normalization: Complete`, {
        valid: validCount,
        invalid: invalidCount,
        duplicates: duplicateCount,
        total: submissions.length
    });

    return {
        userId,
        username,
        problems, // Clean normalized problems: only title, titleSlug, solvedAt, platform
        stats: {
            total: submissions.length,
            valid: validCount,
            invalid: invalidCount,
            duplicates: duplicateCount
        },
        normalizedAt: new Date()
    };
}

/**
 * Build MongoDB document from normalized problem
 * 
 * Adds required fields for MongoDB insertion:
 * - userId reference
 * - Indexed timestamp for sorting
 * - Ready for schema validation
 * 
 * @param {Object} normalizedProblem - Normalized problem from normalization layer
 * @param {string} userId - MongoDB user ID
 * @returns {Object} Ready for MongoDB insertion
 */
export function buildProblemDocument(normalizedProblem, userId) {
    if (!normalizedProblem || !userId) {
        throw new Error('Missing required fields for document building');
    }

    return {
        title: normalizedProblem.title,
        titleSlug: normalizedProblem.titleSlug,
        platform: normalizedProblem.platform || 'leetcode',
        solvedAt: normalizedProblem.solvedAt,
        userId, // MongoDB reference
        difficulty: null, // Can be enriched later
        topics: [], // Can be enriched later
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

export default {
    normalizeAcceptedProblems,
    normalizeSubmission,
    buildProblemDocument
};
