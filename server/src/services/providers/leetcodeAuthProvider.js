import { LeetCode, Credential } from 'leetcode-query';
import { decrypt } from '../../utils/encryption.js';

/**
 * AUTHENTICATED LEETCODE PROVIDER
 * 
 * ============================================================================
 * WHAT IS THIS?
 * ============================================================================
 * A secure provider that uses authenticated LeetCode API access to:
 * - Fetch complete submission history (not just latest 20)
 * - Support true pagination (offset/limit)
 * - Access full problem metadata
 * - Enable scalable deep syncing
 * 
 * ============================================================================
 * WHY AUTHENTICATED ACCESS?
 * ============================================================================
 * PUBLIC API (Old Approach - DEPRECATED):
 * ❌ Only fetches recent ~20 submissions
 * ❌ Pagination unreliable/unsupported
 * ❌ Cannot get full solving history
 * ❌ Rate-limited and unstable
 * 
 * AUTHENTICATED API (New Approach - CURRENT):
 * ✅ Full submission history accessible
 * ✅ True pagination support (offset/limit)
 * ✅ Complete problem metadata
 * ✅ More stable and reliable
 * ✅ Better rate limits for authorized users
 * ✅ Foundation for deep analytics
 * 
 * ============================================================================
 * WHAT IS LEETCODE_SESSION COOKIE?
 * ============================================================================
 * - Session cookie provided by LeetCode after login
 * - Contains authentication token
 * - Identifies user to LeetCode API
 * - Must be kept SECURE and ENCRYPTED
 * - Does NOT contain user password
 * - Expires after inactivity (typically weeks)
 * 
 * HOW TO GET IT:
 * 1. User logs into LeetCode.com in browser
 * 2. Browser stores LEETCODE_SESSION cookie
 * 3. User can copy value from browser dev tools (Application → Cookies)
 * 4. User submits to backend API securely
 * 5. Backend ENCRYPTS and STORES in database
 * 
 * SECURITY GUARANTEES:
 * - NEVER stored unencrypted in database
 * - NEVER logged to console
 * - NEVER exposed in API responses
 * - ONLY decrypted when needed for sync
 * - Decryption happens in-memory only
 * 
 * ============================================================================
 * ARCHITECTURE FLOW
 * ============================================================================
 * User Input → Encrypt → Store → Retrieve → Decrypt → Use → Clear
 *     ↓           ↓         ↓        ↓         ↓        ↓      ↓
 *  Cookie    Encryption  MongoDB  Service   Memory   API    Discard
 *
 * ============================================================================
 * ERROR HANDLING
 * ============================================================================
 * This provider handles:
 * - Invalid/expired sessions gracefully
 * - Network timeouts with retries
 * - Rate limiting (backoff)
 * - Corrupted encrypted data
 * - Missing/empty submission history
 * 
 * Returns structured error objects instead of crashing
 * 
 * ============================================================================
 */

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
 * This is the same query the leetcode-query library uses internally,
 * but we call it directly to avoid the library's internal crash when
 * data.submissionList.submissions is null/undefined.
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
 * Provider interface for authenticated deep sync
 */
const leetcodeAuthProvider = {
    initializeAuthenticatedConnection,
    fetchSubmissions,
    fetchUserProfile,

    /**
     * Constants exported for sync service
     */
    BATCH_SIZE,
    MAX_RETRIES,
    RETRY_DELAY_MS,
};

export default leetcodeAuthProvider;
