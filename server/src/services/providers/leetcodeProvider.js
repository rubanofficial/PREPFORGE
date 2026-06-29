import axios from 'axios';

/**
 * PROVIDER LAYER - Alfa LeetCode API Data Fetching
 * 
 * What is a Provider?
 * A provider is a service that handles external API communication.
 * It acts as a gateway between your application and third-party services.
 * 
 * Why Provider Abstraction?
 * 1. ISOLATION: If API changes, only this file needs updates
 * 2. TESTABILITY: Easy to mock for unit tests
 * 3. CONSISTENCY: Single point of error handling and logging
 * 4. FLEXIBILITY: Can swap to different provider/endpoint later without changing app
 * 5. SEPARATION OF CONCERNS: API communication separate from business logic
 * 
 * WHY ALFA-LEETCODE-API?
 * ✅ REST API (no GraphQL schema hell)
 * ✅ Abstracts LeetCode GraphQL internally
 * ✅ Simple endpoint for accepted problems
 * ✅ No schema drift problems
 * ✅ Lightweight responses
 * ✅ Reliable and maintained
 */

const ALFA_LEETCODE_API = 'https://alfa-leetcode-api.onrender.com';

// Configuration
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 1;

/**
 * Axios instance for Alfa LeetCode API
 */
function createAxiosInstance() {
  return axios.create({
    baseURL: ALFA_LEETCODE_API,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Handles common API errors and logs them appropriately
 * @param {Error} error - Error object from API call
 * @param {string} operation - What operation failed (for logging)
 * @returns {Object} Structured error response
 */
function handleApiError(error, operation) {
  console.error(`❌ Alfa API Error [${operation}]:`, {
    message: error.message,
    code: error.code,
    statusCode: error.response?.status,
    timestamp: new Date().toISOString()
  });

  // Network/Timeout errors
  if (error.code === 'ECONNABORTED') {
    return {
      error: 'TIMEOUT',
      message: 'API request timeout (>30s)',
      statusCode: 504
    };
  }

  // Host not found
  if (error.code === 'ENOTFOUND') {
    return {
      error: 'NETWORK_ERROR',
      message: 'Cannot reach API - network unreachable',
      statusCode: 503
    };
  }

  // User not found
  if (error.response?.status === 404) {
    return {
      error: 'USER_NOT_FOUND',
      message: 'LeetCode user not found',
      statusCode: 404
    };
  }

  // Rate limited
  if (error.response?.status === 429) {
    return {
      error: 'RATE_LIMITED',
      message: 'API rate limit exceeded - try again later',
      statusCode: 429
    };
  }

  // Bad request
  if (error.response?.status === 400) {
    return {
      error: 'BAD_REQUEST',
      message: error.response.data?.message || 'Bad request to API',
      statusCode: 400
    };
  }

  // Generic HTTP error
  if (error.response?.status) {
    return {
      error: 'HTTP_ERROR',
      message: `API returned status ${error.response.status}`,
      statusCode: error.response.status
    };
  }

  // Unknown error
  return {
    error: 'API_ERROR',
    message: error.message || 'Unknown API error',
    statusCode: 502
  };
}

/**
 * Validates LeetCode username format
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }

  const trimmed = username.trim();

  // LeetCode usernames: 1-50 chars, alphanumeric + dash/underscore
  if (trimmed.length < 1 || trimmed.length > 50) {
    return false;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Fetch accepted (solved) problems for a user
 * 
 * Uses Alfa LeetCode API REST endpoint: /:username/acSubmission
 * 
 * Returns lightweight problem metadata:
 * - title: Problem name
 * - titleSlug: URL slug
 * - timestamp: When solved (Unix timestamp)
 * 
 * WHY LIGHTWEIGHT?
 * ✅ Avoids timeouts (small payload)
 * ✅ Prevents performance issues
 * ✅ Scalable for many users
 * ✅ No timeout-inducing nested queries
 * ✅ Only metadata we need (not code, editorials, etc)
 * 
 * @param {string} username - LeetCode username
 * @param {number|null} limit  - Max submissions to return (null = all)
 * @returns {Object} Raw provider response with accepted problems
 */
async function fetchAcceptedProblems(username, limit = null) {
  const limitLabel = limit !== null ? `limit=${limit}` : 'all';
  console.log(`🔍 Provider: Fetching accepted problems for "${username}" (${limitLabel})`);

  // Validate input
  if (!validateUsername(username)) {
    console.warn(`⚠️  Provider: Invalid username format: "${username}"`);
    return {
      error: 'INVALID_USERNAME',
      message: 'Username must be 1-50 characters (alphanumeric, dash, underscore)',
      statusCode: 400
    };
  }

  try {
    const client = createAxiosInstance();
    // Alfa API supports ?limit=N query param to cap how many submissions are returned
    const params = limit !== null ? { limit } : {};
    const endpoint = `/${username.trim()}/acSubmission`;

    console.log(`📤 Provider: Sending REST request to ${ALFA_LEETCODE_API}${endpoint}`, params);
    const response = await client.get(endpoint, { params });

    console.log(`📥 Provider: Response status: ${response.status}`);

    // **CRITICAL DEBUG LOGGING** - Inspect REAL response structure
    console.log(`🔎 DEBUG: Full response.data type:`, typeof response.data);
    console.log(`🔎 DEBUG: Full response.data:`, JSON.stringify(response.data, null, 2));
    console.log(`🔎 DEBUG: response.data keys:`, Object.keys(response.data || {}));

    // Check if response has data
    if (!response.data) {
      console.warn(`⚠️  Provider: Empty response data for user "${username}"`);
      return {
        error: 'EMPTY_RESPONSE',
        message: 'API returned empty response',
        statusCode: 502
      };
    }

    // Try multiple possible response structures
    let submissionList = null;

    // Structure 1: { submissionList: [...] }
    if (Array.isArray(response.data.submissionList)) {
      console.log(`✅ Provider: Detected structure: { submissionList: [...] }`);
      submissionList = response.data.submissionList;
    }
    // Structure 2: { submissions: [...] }
    else if (Array.isArray(response.data.submissions)) {
      console.log(`✅ Provider: Detected structure: { submissions: [...] }`);
      submissionList = response.data.submissions;
    }
    // Structure 3: Response IS the array itself
    else if (Array.isArray(response.data)) {
      console.log(`✅ Provider: Detected structure: response.data is direct array`);
      submissionList = response.data;
    }
    // Structure 4: { data: [...] }
    else if (Array.isArray(response.data.data)) {
      console.log(`✅ Provider: Detected structure: { data: [...] }`);
      submissionList = response.data.data;
    }
    // Structure 5: Check for nested structures under different keys
    else {
      // Try to find any array in the response
      for (const [key, value] of Object.entries(response.data)) {
        if (Array.isArray(value)) {
          console.log(`✅ Provider: Found array at key "${key}"`);
          submissionList = value;
          break;
        }
      }
    }

    // Validate we got an array
    if (!Array.isArray(submissionList)) {
      console.error(`❌ Provider: Could not find array in response`);
      console.error(`   Response structure:`, {
        type: typeof response.data,
        isArray: Array.isArray(response.data),
        keys: Object.keys(response.data || {}),
        sample: JSON.stringify(response.data).substring(0, 200)
      });
      return {
        error: 'INVALID_FORMAT',
        message: 'API returned unexpected response format (not an array)',
        statusCode: 502
      };
    }

    if (submissionList.length === 0) {
      console.warn(`⚠️  Provider: No accepted submissions found for user "${username}"`);
      return {
        error: 'NO_SUBMISSIONS',
        message: `User "${username}" has no accepted submissions`,
        statusCode: 404
      };
    }

    // Log sample of first item to understand structure
    console.log(`📋 Provider: First submission sample:`, JSON.stringify(submissionList[0], null, 2));

    console.log(`✅ Provider: Successfully fetched ${submissionList.length} accepted problems`);

    return {
      success: true,
      data: {
        username: username.trim(),
        submissions: submissionList,
        fetchedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    const apiError = handleApiError(error, 'fetchAcceptedProblems');
    console.error(`❌ Provider: Request failed for "${username}":`, apiError);
    return apiError;
  }
}

/**
 * Fetch total solved problem count for a user.
 *
 * Uses Alfa LeetCode API: GET /:username/solved
 * Returns totalSolved from the user's problem-solving stats.
 *
 * WHY A SEPARATE FUNCTION?
 * Delta sync needs ONLY the count, not the full submission list.
 * One cheap count call → compute delta → fetch only delta items.
 * Avoids fetching all 317 problems when only 3 are new.
 *
 * @param {string} username - LeetCode username
 * @returns {{ data: { totalSolved: number } } | { error: string, message: string, statusCode: number }}
 */
async function fetchSolvedCount(username) {
  console.log(`📊 Provider: Fetching solved count for "${username}"`);

  if (!validateUsername(username)) {
    return { error: 'INVALID_USERNAME', message: 'Invalid username', statusCode: 400 };
  }

  try {
    const client = createAxiosInstance();
    // Alfa API /solved endpoint returns total solved count by difficulty
    const response = await client.get(`/${username.trim()}/solved`);

    if (!response.data) {
      return { error: 'EMPTY_RESPONSE', message: 'Empty profile response', statusCode: 502 };
    }

    const data = response.data;

    // Try multiple possible field names across API versions
    const totalSolved =
      data.totalSolved ??
      data.total_solved ??
      data.solvedProblem ??
      data.solved ??
      // Some versions nest under matchedUser
      data.matchedUser?.submitStats?.acSubmissionNum?.find(s => s.difficulty === 'All')?.count ??
      data.matchedUser?.submitStatsGlobal?.acSubmissionNum?.find(s => s.difficulty === 'All')?.count ??
      null;

    if (totalSolved === null || totalSolved === undefined) {
      console.error(`❌ Provider: Could not extract totalSolved from profile response`);
      console.error(`   Response keys:`, Object.keys(data));
      return { error: 'PARSE_ERROR', message: 'Could not extract solved count from profile', statusCode: 502 };
    }

    console.log(`✅ Provider: totalSolved = ${totalSolved}`);
    return { success: true, data: { totalSolved: Number(totalSolved) } };

  } catch (error) {
    const apiError = handleApiError(error, 'fetchSolvedCount');
    console.error(`❌ Provider: fetchSolvedCount failed for "${username}":`, apiError);
    return apiError;
  }
}

/**
 * Export provider functions
 *
 * PROVIDER RESPONSIBILITIES:
 * ✅ Fetch data from Alfa LeetCode API
 * ✅ Handle errors and timeouts
 * ✅ Log API issues (detailed logs)
 * ✅ Return raw provider data only
 * ✅ Handle invalid usernames
 * ✅ Validate API responses
 *
 * NOT PROVIDER RESPONSIBILITIES:
 * ❌ Normalize data
 * ❌ Insert into MongoDB
 * ❌ Calculate analytics
 * ❌ Validate business logic
 * ❌ Transform data structure
 * ❌ Handle duplicates
 */
export const LeetcodeProvider = {
  fetchAcceptedProblems,
  fetchSolvedCount,
  validateUsername,
};

export default LeetcodeProvider;
