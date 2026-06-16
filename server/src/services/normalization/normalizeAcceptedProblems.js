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
 * @param {Object} submission - Raw submission from Alfa LeetCode API
 * @param {number} index - Submission index
 * @returns {Object|null}
 */
export function normalizeSubmission(submission, index = 0) {
    if (!submission || typeof submission !== 'object') {
        console.warn(
            `⚠️  Normalization: Skipping submission ${index} (not an object)`,
            submission
        );
        return null;
    }

    // Inspect fields
    const fields = Object.keys(submission);
    console.log(`📋 Normalization: Submission ${index} fields:`, fields);

    // Extract title
    const title =
        submission.title ||
        submission.name ||
        submission.problemName;

    // Validate title exists
    if (!title || typeof title !== 'string') {
        console.warn(
            `⚠️  Normalization: Submission ${index} missing title field`,
            { fields: Object.keys(submission) }
        );
        return null;
    }

    // Extract slug
    const titleSlug =
        submission.titleSlug ||
        submission.slug ||
        submission.title_slug ||
        submission.problem_slug;

    // Validate slug exists
    if (!titleSlug || typeof titleSlug !== 'string') {
        console.warn(
            `⚠️  Normalization: Submission ${index} missing titleSlug field`,
            { title }
        );
        return null;
    }

    // Extract timestamp
    const timestamp =
        submission.timestamp ||
        submission.submittedAt ||
        submission.submission_date ||
        submission.submissionDate;

    // Validate required fields
    if (!title || !titleSlug || timestamp === undefined) {
        console.warn(
            `⚠️  Normalization: Skipping submission ${index} (missing required fields)`,
            {
                title: title ? '✓' : '✗',
                titleSlug: titleSlug ? '✓' : '✗',
                timestamp: timestamp !== undefined ? '✓' : '✗',
                availableFields: fields
            }
        );

        return null;
    }

    // Parse timestamp
    let solvedAt;

    if (typeof timestamp === 'string') {
        if (timestamp.includes('-') || timestamp.includes('T')) {
            // ISO format
            solvedAt = new Date(timestamp);
        } else {
            // Numeric string
            const num = parseInt(timestamp);

            solvedAt =
                num < 4102444800000
                    ? new Date(num * 1000)
                    : new Date(num);
        }
    } else if (typeof timestamp === 'number') {
        solvedAt =
            timestamp < 4102444800000
                ? new Date(timestamp * 1000)
                : new Date(timestamp);
    } else {
        console.warn(
            `⚠️  Normalization: Invalid timestamp type:`,
            typeof timestamp,
            timestamp
        );

        return null;
    }

    // Validate date
    if (isNaN(solvedAt.getTime())) {
        console.warn(
            `⚠️  Normalization: Invalid/unparseable timestamp:`,
            timestamp
        );

        return null;
    }

    console.log(
        `✅ Normalization: Successfully normalized submission ${index}`,
        {
            title,
            titleSlug,
            solvedAt: solvedAt.toISOString()
        }
    );

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
 * @param {Object} rawResponse
 * @param {string} userId
 * @returns {Object}
 */
export function normalizeAcceptedProblems(rawResponse, userId) {
    console.log(
        `📝 Normalization: Processing accepted problems for user ${userId}`
    );

    // Validate input
    if (!rawResponse) {
        throw new Error(
            'Normalization: Invalid raw response (null/undefined)'
        );
    }

    if (!rawResponse.data) {
        throw new Error(
            'Normalization: Response missing data field'
        );
    }

    const {
        username = 'unknown',
        submissions = []
    } = rawResponse.data;

    // Validate submissions
    if (!Array.isArray(submissions)) {
        console.error(
            `❌ Normalization: submissions is not an array:`,
            typeof submissions
        );

        throw new Error(
            'Normalization: submissions field is not an array'
        );
    }

    // Stats
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    const seenProblems = new Set();

    console.log(
        `📊 Normalization: Processing ${submissions.length} submissions...`
    );

    // Normalize submissions
    const problems = submissions
        .map((submission, index) => {
            const normalized = normalizeSubmission(
                submission,
                index
            );

            // Invalid submission
            if (!normalized) {
                invalidCount++;
                return null;
            }

            // Duplicate check
            if (seenProblems.has(normalized.titleSlug)) {
                duplicateCount++;

                console.log(
                    `🔁 Duplicate skipped: ${normalized.titleSlug}`
                );

                return null;
            }

            // Add to set
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

        // Clean normalized problems
        problems,

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
 * @param {Object} normalizedProblem
 * @param {string} userId
 * @returns {Object}
 */
export function buildProblemDocument(
    normalizedProblem,
    userId
) {
    // Detailed validation
    if (!normalizedProblem) {
        throw new Error(
            `Missing required fields for document building: normalizedProblem is ${typeof normalizedProblem}`
        );
    }

    if (!userId) {
        throw new Error(
            `Missing required fields for document building: userId is ${typeof userId}`
        );
    }

    // Validate required fields in normalized problem
    if (!normalizedProblem.title || typeof normalizedProblem.title !== 'string') {
        throw new Error(
            `Missing required fields for document building: title is missing or invalid (${typeof normalizedProblem.title})`
        );
    }

    if (!normalizedProblem.titleSlug || typeof normalizedProblem.titleSlug !== 'string') {
        throw new Error(
            `Missing required fields for document building: titleSlug is missing or invalid (${typeof normalizedProblem.titleSlug})`
        );
    }

    if (!normalizedProblem.solvedAt) {
        throw new Error(
            `Missing required fields for document building: solvedAt is missing (${typeof normalizedProblem.solvedAt})`
        );
    }

    return {
        title: normalizedProblem.title,
        titleSlug: normalizedProblem.titleSlug,
        platform: normalizedProblem.platform || 'leetcode',
        solvedAt: normalizedProblem.solvedAt,

        // MongoDB reference
        userId,

        // Future enrichment fields
        difficulty: null,
        topics: [],

        createdAt: new Date(),
        updatedAt: new Date()
    };
}

export default {
    normalizeAcceptedProblems,
    normalizeSubmission,
    buildProblemDocument
};