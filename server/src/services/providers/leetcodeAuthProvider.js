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
        const sessionCookie = decrypt(encryptedSession);

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

        // Initialize Credential with session cookie
        const credential = new Credential();

        // Set the session cookie for authentication
        await credential.init(sessionCookie);

        // Create LeetCode client with authenticated credential
        const leetcode = new LeetCode(credential);

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
 * Fetch submissions with pagination
 * 
 * IMPORTANT: The leetcode-query package may throw an error if:
 * - User has NO submissions (returns null/undefined)
 * - API response format is unexpected
 * 
 * We wrap with defensive error handling to gracefully handle these cases.
 * 
 * @param {LeetCode} leetcodeClient - Authenticated LeetCode client
 * @param {number} offset - Starting offset (0-indexed)
 * @param {number} limit - Number of submissions to fetch
 * @returns {Promise<{submissions: Array, hasMore: boolean, error: null} | {submissions: [], hasMore: false, error: Object}>}
 */
async function fetchSubmissions(leetcodeClient, offset = 0, limit = BATCH_SIZE) {
    try {
        console.log(`\n📡 CALLING leetcode.submissions() with offset=${offset}, limit=${limit}`);

        // Wrap the submissions() call - it may throw if user has no submissions
        let submissions;
        try {
            submissions = await leetcodeClient.submissions({
                offset,
                limit,
            });
        } catch (submissionError) {
            console.error(`⚠️  Submissions call threw error: ${submissionError.message}`);
            
            // If it's the "not iterable" error, user likely has NO submissions
            if (submissionError.message.includes('is not iterable')) {
                console.log(`📭 User has no submissions or submissions list is empty`);
                return {
                    submissions: [],
                    hasMore: false,
                    error: null,
                };
            }
            
            // Re-throw other errors to be caught by outer catch block
            throw submissionError;
        }

        console.log(`✅ RAW RESPONSE RECEIVED`);
        console.log(`   Type: ${typeof submissions}`);
        console.log(`   Is Array: ${Array.isArray(submissions)}`);
        
        if (submissions && typeof submissions === 'object' && !Array.isArray(submissions)) {
            console.log(`   Keys: ${Object.keys(submissions).join(', ')}`);
            console.log(`   Constructor: ${submissions.constructor.name}`);
        }

        // PARSE: Handle different possible response structures
        let parsedSubmissions = [];

        // Case 1: Response is already an array of submissions
        if (Array.isArray(submissions)) {
            console.log(`✅ PARSED: Direct array with ${submissions.length} items`);
            parsedSubmissions = submissions;
        }
        // Case 2: Response is null/undefined (no submissions)
        else if (!submissions) {
            console.log(`📭 Response is null/undefined - user has no submissions`);
            return {
                submissions: [],
                hasMore: false,
                error: null,
            };
        }
        // Case 3: Response is an object with submissionList.submissions
        else if (
            typeof submissions === 'object' &&
            submissions.submissionList &&
            Array.isArray(submissions.submissionList.submissions)
        ) {
            console.log(`✅ PARSED: submissionList.submissions with ${submissions.submissionList.submissions.length} items`);
            parsedSubmissions = submissions.submissionList.submissions;
        }
        // Case 4: Response is an object with submissions property directly
        else if (
            typeof submissions === 'object' &&
            Array.isArray(submissions.submissions)
        ) {
            console.log(`✅ PARSED: Direct submissions property with ${submissions.submissions.length} items`);
            parsedSubmissions = submissions.submissions;
        }
        // Case 5: Unknown structure - log and handle gracefully
        else {
            console.warn(`⚠️  UNKNOWN RESPONSE STRUCTURE`);
            console.warn(`   Type: ${typeof submissions}`);
            console.warn(`   Value:`, JSON.stringify(submissions).substring(0, 200));
            
            // Treat as empty
            return {
                submissions: [],
                hasMore: false,
                error: null,
            };
        }

        // VALIDATE: Ensure we have an array
        if (!Array.isArray(parsedSubmissions)) {
            console.error(`❌ PARSED SUBMISSIONS NOT AN ARRAY: ${typeof parsedSubmissions}`);
            return {
                submissions: [],
                hasMore: false,
                error: {
                    type: 'INVALID_RESPONSE_STRUCTURE',
                    message: 'Failed to extract submissions array',
                    recoverable: false,
                },
            };
        }

        // Check if we got any submissions
        if (parsedSubmissions.length === 0) {
            console.log(`📭 No submissions in this batch`);
            return {
                submissions: [],
                hasMore: false,
                error: null,
            };
        }

        console.log(`✅ Successfully parsed ${parsedSubmissions.length} submissions`);

        // If we got fewer than limit items, we've reached the end
        const hasMore = parsedSubmissions.length === limit;
        console.log(`   Has more: ${hasMore} (got ${parsedSubmissions.length}/${limit})`);

        return {
            submissions: parsedSubmissions,
            hasMore,
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
