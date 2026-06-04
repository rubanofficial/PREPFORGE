import { LeetCode, Credential } from 'leetcode-query';
import { decrypt } from '../../utils/encryption.js';


const DEFAULT_TIMEOUT = 30000; // 30 seconds
const BATCH_SIZE = 20; // Submissions per request
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Initialize authenticated LeetCode connection
 * 
 * @param {string} encryptedSession - Encrypted LEETCODE_SESSION cookie from database
 * @returns {Promise<{leetcode: LeetCode, error: null} | {leetcode: null, error: Object}>}
 * 
 * IMPORTANT:
 * - Input is encrypted data from database
 * - Must be decrypted before use
 * - If decryption fails, return error (do not crash)
 * - If authentication fails, return error (do not crash)
 */
async function initializeAuthenticatedConnection(encryptedSession) {
    try {
        // Decrypt the session cookie
        let sessionCookie = decrypt(encryptedSession);

        if (!sessionCookie) {
            return {
                leetcode: null,
                error: {
                    type: 'DECRYPTION_FAILED',
                    message: 'Failed to decrypt LeetCode session. Session may be corrupted or key changed.',
                    recoverable: false,
                },
            };
        }

        // Strip LEETCODE_SESSION= prefix if user stored the full cookie string
        // The library adds this prefix automatically in the cookie header,
        // so having it in the value causes: LEETCODE_SESSION=LEETCODE_SESSION=eyJ...
        if (sessionCookie.startsWith('LEETCODE_SESSION=')) {
            sessionCookie = sessionCookie.substring('LEETCODE_SESSION='.length);
            console.log(`🔧 Stripped LEETCODE_SESSION= prefix from session cookie`);
        }

        // Debug: Log sanitized session info (first/last 6 chars only)
        const sanitized = sessionCookie.length > 12
            ? `${sessionCookie.substring(0, 6)}...${sessionCookie.substring(sessionCookie.length - 6)}`
            : '***';
        console.log(`🔑 Session cookie length: ${sessionCookie.length}, preview: ${sanitized}`);

        // Initialize Credential with session cookie
        const credential = new Credential();

        // Set the session cookie for authentication
        await credential.init(sessionCookie);

        // Create LeetCode client with authenticated credential
        const leetcode = new LeetCode(credential);

        // Verify authentication by calling whoami()
        // This confirms the session is actually valid before we try submissions
        try {
            const whoami = await leetcode.whoami();
            console.log(`🔐 whoami() response:`);
            console.log(`   isSignedIn: ${whoami.isSignedIn}`);
            console.log(`   username: ${whoami.username}`);
            console.log(`   userId: ${whoami.userId}`);

            if (!whoami.isSignedIn || !whoami.userId) {
                return {
                    leetcode: null,
                    error: {
                        type: 'SESSION_EXPIRED',
                        message: `LeetCode session is NOT authenticated (isSignedIn=${whoami.isSignedIn}, userId=${whoami.userId}). Please go to leetcode.com, log in, copy a fresh LEETCODE_SESSION cookie from DevTools > Application > Cookies, and re-save it via the store-session endpoint.`,
                        recoverable: false,
                    },
                };
            }

            console.log(`✅ Session verified - logged in as: ${whoami.username}`);
        } catch (whoamiError) {
            console.error(`⚠️  whoami() failed: ${whoamiError.message}`);
            // Don't block on whoami failure - try submissions anyway
            // Some network configs may block this specific query
        }

        return {
            leetcode,
            error: null,
        };
    } catch (error) {
        // Network or initialization error
        return {
            leetcode: null,
            error: {
                type: 'INITIALIZATION_FAILED',
                message: `Failed to initialize LeetCode connection: ${error.message}`,
                recoverable: true,
                originalError: error.message,
            },
        };
    }
}

/**
 * Fetch submissions with pagination
 * 
 * @param {LeetCode} leetcodeClient - Authenticated LeetCode client
 * @param {number} offset - Starting offset (0-indexed)
 * @param {number} limit - Number of submissions to fetch
 * @returns {Promise<{submissions: Array, hasMore: boolean, error: null} | {submissions: [], hasMore: false, error: Object}>}
 * 
 * PAGINATION EXPLANATION:
 * - offset: Where to start (e.g., 0 = first submission)
 * - limit: How many to fetch per request (e.g., 20)
 * - hasMore: Whether more submissions exist after this batch
 * - Empty response (length === 0) = reached end of history
 * 
 * EXAMPLE FLOW:
 * Batch 1: offset=0, limit=20 → gets items 0-19
 * Batch 2: offset=20, limit=20 → gets items 20-39
 * Batch 3: offset=40, limit=20 → gets 0 items → stop syncing
 */
/**
 * GraphQL query for fetching submissions
 * 
 * BREAKING CHANGE (LeetCode API):
 * - The "question" field was removed from SubmissionDumpNode
 * - Previously returned difficulty and topics
 * - Now: Fetch submission metadata separately using fetchProblemDetail()
 * 
 * NEW FLOW:
 * 1. Fetch submissions (basic data only)
 * 2. For each titleSlug, fetch problem details separately
 * 3. Merge submission + problem metadata before inserting to MongoDB
 * 
 * RATIONALE:
 * - Two-step approach allows for metadata caching
 * - Can batch metadata fetches (10 concurrent)
 * - Reduces API load on LeetCode
 */
const SUBMISSIONS_QUERY = `query ($offset: Int!, $limit: Int!, $slug: String) {
    submissionList(offset: $offset, limit: $limit, questionSlug: $slug) {
        hasNext
        submissions {
            id
            lang
            time
            timestamp
            statusDisplay
            runtime
            url
            isPending
            title
            memory
            titleSlug
        }
    }
}`;

/**
 * Fetch submissions with pagination
 * 
 * IMPORTANT: We call the GraphQL API directly instead of using
 * leetcodeClient.submissions() because the library crashes internally
 * with "data.submissionList.submissions is not iterable" when the API
 * returns null/undefined for the submissions list.
 * 
 * By calling graphql() directly, we get full control over response parsing.
 * 
 * @param {LeetCode} leetcodeClient - Authenticated LeetCode client
 * @param {number} offset - Starting offset (0-indexed)
 * @param {number} limit - Number of submissions to fetch
 * @returns {Promise<{submissions: Array, hasMore: boolean, error: null} | {submissions: [], hasMore: false, error: Object}>}
 */
async function fetchSubmissions(leetcodeClient, offset = 0, limit = BATCH_SIZE) {
    try {
        console.log(`\n📡 CALLING GraphQL submissionList with offset=${offset}, limit=${limit}`);

        // Call GraphQL directly to avoid the library's internal crash
        const response = await leetcodeClient.graphql({
            variables: {
                offset,
                limit,
            },
            query: SUBMISSIONS_QUERY,
        });

        console.log(`✅ GraphQL response received`);

        // Check for GraphQL errors
        if (response.errors && response.errors.length > 0) {
            const errorMsg = response.errors.map(e => e.message).join('; ');
            console.error(`❌ GraphQL errors: ${errorMsg}`);

            // Check if it's an auth error
            const isAuthError = response.errors.some(e =>
                e.message?.toLowerCase().includes('unauthorized') ||
                e.message?.toLowerCase().includes('not logged in') ||
                e.message?.toLowerCase().includes('authentication')
            );

            if (isAuthError) {
                return {
                    submissions: [],
                    hasMore: false,
                    error: {
                        type: 'AUTHENTICATION_FAILED',
                        message: `LeetCode session expired or invalid: ${errorMsg}`,
                        recoverable: false,
                    },
                };
            }

            return {
                submissions: [],
                hasMore: false,
                error: {
                    type: 'GRAPHQL_ERROR',
                    message: `GraphQL error: ${errorMsg}`,
                    recoverable: true,
                },
            };
        }

        const data = response.data;

        // Check if data itself is null/undefined
        if (!data) {
            console.warn(`⚠️  GraphQL response has no data field`);
            console.warn(`   Full response keys: ${Object.keys(response).join(', ')}`);
            return {
                submissions: [],
                hasMore: false,
                error: {
                    type: 'AUTHENTICATION_FAILED',
                    message: 'LeetCode returned empty data. Session may be expired.',
                    recoverable: false,
                },
            };
        }

        // Check if submissionList is null/undefined
        if (!data.submissionList) {
            console.warn(`⚠️  data.submissionList is null/undefined`);
            console.warn(`   data keys: ${Object.keys(data).join(', ')}`);
            console.warn(`   data.submissionList value: ${data.submissionList}`);
            return {
                submissions: [],
                hasMore: false,
                error: {
                    type: 'AUTHENTICATION_FAILED',
                    message: 'LeetCode returned null submissionList. Session is likely expired or invalid. Please re-authenticate.',
                    recoverable: false,
                },
            };
        }

        // Debug: Log the entire submissionList structure
        console.log(`📋 DEBUG submissionList keys: ${Object.keys(data.submissionList).join(', ')}`);
        console.log(`📋 DEBUG submissionList.hasNext: ${data.submissionList.hasNext}`);
        console.log(`📋 DEBUG submissionList.submissions type: ${typeof data.submissionList.submissions}`);
        console.log(`📋 DEBUG submissionList.submissions isArray: ${Array.isArray(data.submissionList.submissions)}`);
        console.log(`📋 DEBUG submissionList FULL VALUE: ${JSON.stringify(data.submissionList).substring(0, 500)}`);

        // Check if submissions array is null/undefined
        const rawSubmissions = data.submissionList.submissions;
        const hasNext = data.submissionList.hasNext || false;

        if (!rawSubmissions || !Array.isArray(rawSubmissions)) {
            console.warn(`⚠️  submissions is null or not an array: ${typeof rawSubmissions}`);
            console.warn(`   Value: ${JSON.stringify(rawSubmissions).substring(0, 300)}`);
            return {
                submissions: [],
                hasMore: false,
                error: null, // Could be genuinely empty
            };
        }

        if (rawSubmissions.length === 0) {
            console.log(`📭 No submissions in this batch`);
            return {
                submissions: [],
                hasMore: false,
                error: null,
            };
        }

        // Normalize the submissions (same transforms the library does)
        const parsedSubmissions = rawSubmissions.map(sub => ({
            ...sub,
            id: parseInt(sub.id, 10),
            timestamp: parseInt(sub.timestamp, 10) * 1000,
            isPending: sub.isPending !== 'Not Pending',
            runtime: parseInt(sub.runtime, 10) || 0,
            memory: parseFloat(sub.memory) || 0,
        }));

        console.log(`✅ Successfully parsed ${parsedSubmissions.length} submissions`);
        console.log(`   Has more: ${hasNext} (got ${parsedSubmissions.length}/${limit})`);

        return {
            submissions: parsedSubmissions,
            hasMore: hasNext,
            error: null,
        };
    } catch (error) {
        console.error(`\n❌ EXCEPTION IN fetchSubmissions:`);
        console.error(`   Error Type: ${error.constructor.name}`);
        console.error(`   Error Message: ${error.message}`);

        // Check for authentication errors
        if (
            error.message.includes('Unauthorized') ||
            error.message.includes('401') ||
            error.message.includes('authentication') ||
            error.message.includes('session') ||
            error.message.includes('ENOTFOUND')
        ) {
            return {
                submissions: [],
                hasMore: false,
                error: {
                    type: 'AUTHENTICATION_FAILED',
                    message: 'LeetCode session expired or invalid. Please re-authenticate.',
                    recoverable: false,
                },
            };
        }

        // Check for rate limiting
        if (error.message.includes('429') || error.message.includes('rate')) {
            return {
                submissions: [],
                hasMore: false,
                error: {
                    type: 'RATE_LIMITED',
                    message: 'LeetCode API rate limit reached. Please try again later.',
                    recoverable: true,
                },
            };
        }

        // Check for timeout
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return {
                submissions: [],
                hasMore: false,
                error: {
                    type: 'TIMEOUT',
                    message: 'Request to LeetCode API timed out.',
                    recoverable: true,
                },
            };
        }

        // Generic error
        return {
            submissions: [],
            hasMore: false,
            error: {
                type: 'NETWORK_ERROR',
                message: `Failed to fetch submissions: ${error.message}`,
                recoverable: true,
                originalError: error.message,
            },
        };
    }
}

/**
 * Fetch user profile information
 * 
 * IMPORTANT: The leetcode-query SDK requires username to be passed
 * to generate the correct GraphQL query parameter.
 * 
 * @param {LeetCode} leetcodeClient - Authenticated LeetCode client
 * @param {string} username - LeetCode username to fetch profile for
 * @returns {Promise<{profile: Object, error: null} | {profile: null, error: Object}>}
 */
async function fetchUserProfile(leetcodeClient, username) {
    try {
        // Validate username
        if (!username || typeof username !== 'string') {
            console.error(`❌ USERNAME MISSING OR INVALID: ${typeof username}`);
            return {
                profile: null,
                error: {
                    type: 'USERNAME_MISSING',
                    message: 'Username is required to fetch profile',
                    recoverable: false,
                },
            };
        }

        console.log(`📝 DEBUG USERNAME: "${username}"`);
        console.log(`📡 Calling leetcode.user("${username}")`);

        // Pass username to the SDK method - it's required for the GraphQL query
        const user = await leetcodeClient.user(username);

        console.log(`✅ User profile fetched successfully`);

        if (!user) {
            console.warn(`⚠️  User profile is null/empty`);
            return {
                profile: null,
                error: {
                    type: 'PROFILE_NOT_FOUND',
                    message: 'Could not fetch LeetCode profile',
                    recoverable: true,
                },
            };
        }

        console.log(`📋 Profile response received`);
        console.log(`   Keys: ${Object.keys(user).join(', ')}`);

        // Validate that matchedUser exists - if null, session may be invalid
        if (user.matchedUser === null || user.matchedUser === undefined) {
            console.warn(`⚠️  matchedUser is null - session may be expired or username incorrect`);
            console.warn(`   Username queried: "${username}"`);
            console.warn(`   recentSubmissionList: ${user.recentSubmissionList ? user.recentSubmissionList.length + ' items' : 'null'}`);

            // If recentSubmissionList is also empty/null, likely an auth issue
            if (!user.recentSubmissionList || user.recentSubmissionList.length === 0) {
                return {
                    profile: null,
                    error: {
                        type: 'AUTHENTICATION_FAILED',
                        message: `LeetCode returned null profile for "${username}". Your session cookie may be expired. Please go to LeetCode.com, log in again, copy a fresh LEETCODE_SESSION cookie, and re-save it.`,
                        recoverable: false,
                    },
                };
            }
        }

        return {
            profile: user,
            error: null,
        };
    } catch (error) {
        console.error(`❌ Profile fetch exception:`, error.message);

        // Check for authentication errors
        if (
            error.message.includes('Unauthorized') ||
            error.message.includes('401')
        ) {
            return {
                profile: null,
                error: {
                    type: 'AUTHENTICATION_FAILED',
                    message: 'Session expired or invalid.',
                    recoverable: false,
                },
            };
        }

        // Check for not found errors
        if (
            error.message.includes('404') ||
            error.message.includes('not found')
        ) {
            return {
                profile: null,
                error: {
                    type: 'USER_NOT_FOUND',
                    message: `LeetCode user "${username}" not found`,
                    recoverable: false,
                },
            };
        }

        return {
            profile: null,
            error: {
                type: 'FETCH_FAILED',
                message: `Failed to fetch user profile: ${error.message}`,
                recoverable: true,
            },
        };
    }
}

/**
 * Fetch problem details including difficulty
 * 
 * IMPORTANT: Uses leetcodeClient.graphql() method (NOT query()).
 * The leetcode-query library provides the graphql() method for all GraphQL queries.
 * 
 * Response structure (from LeetCode GraphQL):
 * {
 *     data: {
 *         question: {
 *             difficulty: "Easy",
 *             title: "Two Sum",
 *             titleSlug: "two-sum",
 *             topicTags: [{slug: "array", name: "Array"}, ...]
 *         }
 *     },
 *     errors: [] (if any)
 * }
 * 
 * NOTE: The returned object maps `topicTags` → `topics` to maintain
 * backward compatibility with all downstream consumers.
 * 
 * @param {LeetCode} leetcodeClient - Authenticated LeetCode client
 * @param {string} titleSlug - Problem slug (e.g., "two-sum")
 * @returns {Promise<{problem: Object, error: null} | {problem: null, error: Object}>}
 */
async function fetchProblemDetail(leetcodeClient, titleSlug) {
    const QUESTION_QUERY = `query ($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
            difficulty
            title
            titleSlug
            topicTags {
                slug
                name
            }
        }
    }`;

    try {
        if (!titleSlug || typeof titleSlug !== 'string') {
            return {
                problem: null,
                error: {
                    type: 'INVALID_SLUG',
                    message: 'Problem slug is required',
                    recoverable: false,
                },
            };
        }

        console.log(`🔍 Fetching problem details for slug: "${titleSlug}"`);

        // DEBUG: Log available methods on leetcodeClient (first call only)
        if (global._debugLeetcodeClientMethods === undefined) {
            global._debugLeetcodeClientMethods = true;
            console.log(`📊 DEBUG: Available methods on leetcodeClient:`,
                Object.getOwnPropertyNames(Object.getPrototypeOf(leetcodeClient))
                    .filter(m => typeof leetcodeClient[m] === 'function')
                    .join(', ')
            );
        }

        // Use graphql() method (same as fetchSubmissions)
        const response = await leetcodeClient.graphql({
            variables: { titleSlug },
            query: QUESTION_QUERY,
        });

        console.log(`✅ GraphQL response received for problem: ${titleSlug}`);

        // Check for GraphQL errors
        if (response.errors && response.errors.length > 0) {
            const errorMsg = response.errors.map(e => e.message).join('; ');
            console.error(`❌ GraphQL errors for ${titleSlug}: ${errorMsg}`);

            // Check if it's an auth error
            const isAuthError = response.errors.some(e =>
                e.message?.toLowerCase().includes('unauthorized') ||
                e.message?.toLowerCase().includes('not logged in') ||
                e.message?.toLowerCase().includes('authentication')
            );

            if (isAuthError) {
                return {
                    problem: null,
                    error: {
                        type: 'AUTHENTICATION_FAILED',
                        message: `LeetCode session expired: ${errorMsg}`,
                        recoverable: false,
                    },
                };
            }

            return {
                problem: null,
                error: {
                    type: 'GRAPHQL_ERROR',
                    message: `GraphQL error: ${errorMsg}`,
                    recoverable: true,
                },
            };
        }

        // Extract data from response
        const data = response.data;

        if (!data) {
            console.warn(`⚠️  No data in GraphQL response for ${titleSlug}`);
            return {
                problem: null,
                error: {
                    type: 'NO_DATA',
                    message: 'GraphQL response has no data field',
                    recoverable: true,
                },
            };
        }

        const question = data.question;

        if (!question) {
            console.warn(`⚠️  Problem not found: "${titleSlug}"`);
            return {
                problem: null,
                error: {
                    type: 'PROBLEM_NOT_FOUND',
                    message: `Problem not found: ${titleSlug}`,
                    recoverable: false,
                },
            };
        }

        // DEBUG: Log raw GraphQL response to inspect actual schema
        console.log(`🔍 Question Metadata:`, JSON.stringify(question, null, 2));

        console.log(`✅ Problem details fetched: ${question.title} (difficulty: ${question.difficulty})`);

        // Map topicTags → topics for backward compatibility with downstream consumers
        // (problemMetadataService, problemEnrichmentService, deepSyncService all expect .topics)
        return {
            problem: {
                ...question,
                topics: question.topicTags || [],
            },
            error: null,
        };
    } catch (error) {
        console.error(`❌ EXCEPTION in fetchProblemDetail for "${titleSlug}":`);
        console.error(`   Error Type: ${error.constructor.name}`);
        console.error(`   Error Message: ${error.message}`);
        console.error(`   Stack: ${error.stack?.substring(0, 200)}`);

        // Check for authentication errors
        if (
            error.message.includes('Unauthorized') ||
            error.message.includes('401') ||
            error.message.includes('authentication') ||
            error.message.includes('session')
        ) {
            return {
                problem: null,
                error: {
                    type: 'AUTHENTICATION_FAILED',
                    message: 'LeetCode session expired or invalid.',
                    recoverable: false,
                },
            };
        }

        return {
            problem: null,
            error: {
                type: 'FETCH_FAILED',
                message: `Failed to fetch problem details: ${error.message}`,
                recoverable: true,
            },
        };
    }
}

/**
 * Provider interface for authenticated deep sync
 */
const leetcodeAuthProvider = {
    initializeAuthenticatedConnection,
    fetchSubmissions,
    fetchUserProfile,
    fetchProblemDetail,

    /**
     * Constants exported for sync service
     */
    BATCH_SIZE,
    MAX_RETRIES,
    RETRY_DELAY_MS,
};

export default leetcodeAuthProvider;
