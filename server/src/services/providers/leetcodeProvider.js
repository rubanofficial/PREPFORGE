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
 * SAFE UPPER LIMIT PROTECTION
 * 
 * Why this matters:
 * 1. BACKEND PROTECTION: Prevents massive API calls from overloading our server
 * 2. PROVIDER PROTECTION: Respects rate limits and provider capacity
 * 3. DATABASE PROTECTION: Prevents sudden huge insertions
 * 4. NETWORK PROTECTION: Limits payload size to prevent timeouts
 * 5. RESOURCE PROTECTION: Manages memory during processing
 * 
 * Real-world example:
 * - A user with 5000+ solved problems would create enormous payloads
 * - Setting upper limit to 3000 ensures:
 *   - API response stays <50MB
 *   - Normalization completes quickly
 *   - Deduplication is fast
 *   - MongoDB batch insert is safe
 *   - No OOM errors on server
 */
const SAFE_UPPER_LIMIT = 3000; // Max problems to fetch in one sync

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
 * Fetch solved problem statistics for a user
 * 
 * Uses Alfa LeetCode API REST endpoint: /:username/solved
 * 
 * Returns:
 * - totalSolved: Total number of problems solved
 * - easySolved: Number of easy problems solved
 * - mediumSolved: Number of medium problems solved
 * - hardSolved: Number of hard problems solved
 * 
 * WHY FETCH STATS FIRST?
 * 1. DYNAMIC LIMIT: Use total count as limit for acSubmission
 * 2. OPTIMIZATION: Skip fetching if user has 0 problems
 * 3. PROGRESS TRACKING: Know how many total we're syncing
 * 4. DEDUPLICATION: Compare new sync count vs database
 * 5. USER AWARENESS: Can notify user of progress
 * 
 * @param {string} username - LeetCode username
 * @returns {Object} Raw provider response with solved stats
 */
async function fetchSolvedStats(username) {
  console.log(`📊 Provider: Fetching solved stats for "${username}"`);

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
    const endpoint = `/${username.trim()}/solved`;

    console.log(`📤 Provider: Sending REST request to ${ALFA_LEETCODE_API}${endpoint}`);
    const response = await client.get(endpoint);

    console.log(`📥 Provider: Response status: ${response.status}`);

    // Debug log
    console.log(`🔎 DEBUG [fetchSolvedStats]: Response structure:`, {
      type: typeof response.data,
      keys: Object.keys(response.data || {})
    });

    if (!response.data) {
      console.warn(`⚠️  Provider: Empty response data for stats "${username}"`);
      return {
        error: 'EMPTY_RESPONSE',
        message: 'API returned empty response',
        statusCode: 502
      };
    }

    // Extract stats - Handle different field name variations
    // The API response might have: solvedProblem, totalSolved, total
    let totalSolved = response.data.solvedProblem || response.data.totalSolved || response.data.total || 0;
    
    const easySolved = response.data.easySolved || 0;
    const mediumSolved = response.data.mediumSolved || 0;
    const hardSolved = response.data.hardSolved || 0;
    
    // If totalSolved is not provided, calculate from difficulty breakdown
    if (totalSolved === 0 && (easySolved > 0 || mediumSolved > 0 || hardSolved > 0)) {
      totalSolved = easySolved + mediumSolved + hardSolved;
      console.log(`✅ Provider: Calculated totalSolved from difficulty breakdown: ${totalSolved}`);
    }

    if (totalSolved === 0) {
      console.warn(`⚠️  Provider: User "${username}" has no solved problems`);
      return {
        success: true,
        data: {
          username: username.trim(),
          totalSolved: 0,
          easySolved: easySolved,
          mediumSolved: mediumSolved,
          hardSolved: hardSolved,
          fetchedAt: new Date().toISOString()
        }
      };
    }

    console.log(`✅ Provider: Successfully fetched stats - Total solved: ${totalSolved}`);

    return {
      success: true,
      data: {
        username: username.trim(),
        totalSolved,
        easySolved: easySolved,
        mediumSolved: mediumSolved,
        hardSolved: hardSolved,
        fetchedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    const apiError = handleApiError(error, 'fetchSolvedStats');
    console.error(`❌ Provider: Fetch stats failed for "${username}":`, apiError);
    return apiError;
  }
}

/**
 * Fetch accepted (solved) problems for a user with dynamic limit and offset
 * 
 * Uses Alfa LeetCode API REST endpoint: /:username/submission?limit=N&skip=offset
 * Note: Some versions use /acSubmission, we try /submission first
 * 
 * WHY DYNAMIC LIMIT WITH PAGINATION?
 * 1. SCALABILITY: Fetch only what the user has solved
 * 2. COMPLETENESS: Don't hardcode "fetch 20" - fetch ALL via pagination
 * 3. EFFICIENCY: Use stats to know exact limit needed
 * 4. SAFETY: Upper limit protection prevents overload
 * 
 * Parameters:
 * @param {string} username - LeetCode username
 * @param {number} limit - Problems to fetch per request
 * @param {number} offset - Skip this many problems (for pagination)
 * @returns {Object} Raw provider response with accepted problems
 */
async function fetchAcceptedProblems(username, limit = 20, offset = 0) {
  console.log(`🔍 Provider: Fetching accepted problems for "${username}" with limit=${limit}, offset=${offset}`);

  // Validate input
  if (!validateUsername(username)) {
    console.warn(`⚠️  Provider: Invalid username format: "${username}"`);
    return {
      error: 'INVALID_USERNAME',
      message: 'Username must be 1-50 characters (alphanumeric, dash, underscore)',
      statusCode: 400
    };
  }

  if (!Number.isInteger(limit) || limit < 1) {
    console.warn(`⚠️  Provider: Invalid limit: ${limit}`);
    return {
      error: 'INVALID_LIMIT',
      message: 'Limit must be a positive integer',
      statusCode: 400
    };
  }

  if (!Number.isInteger(offset) || offset < 0) {
    console.warn(`⚠️  Provider: Invalid offset: ${offset}`);
    return {
      error: 'INVALID_OFFSET',
      message: 'Offset must be a non-negative integer',
      statusCode: 400
    };
  }

  // Apply safe upper limit protection
  const effectiveLimit = Math.min(limit, SAFE_UPPER_LIMIT);
  
  if (limit > SAFE_UPPER_LIMIT) {
    console.warn(`⚠️  Provider: Limit ${limit} exceeds safe upper limit ${SAFE_UPPER_LIMIT}, capping to ${effectiveLimit}`);
  }

  try {
    const client = createAxiosInstance();
    
    // Try /submission endpoint first (more common variant)
    // Try multiple parameter variations for pagination
    let endpoint = `/${username.trim()}/submission?limit=${effectiveLimit}&skip=${offset}`;
    console.log(`📤 Provider: Sending REST request to ${ALFA_LEETCODE_API}${endpoint}`);
    
    let response;
    try {
      response = await client.get(endpoint);
    } catch (firstError) {
      // Try without skip parameter
      if (firstError.response?.status === 404 || firstError.code === 'ERR_BAD_REQUEST') {
        endpoint = `/${username.trim()}/submission?limit=${effectiveLimit}`;
        console.log(`⚠️  Provider: Retrying without skip parameter`);
        console.log(`📤 Provider: Sending REST request to ${ALFA_LEETCODE_API}${endpoint}`);
        try {
          response = await client.get(endpoint);
        } catch (secondError) {
          // Try /acSubmission endpoint
          endpoint = `/${username.trim()}/acSubmission?limit=${effectiveLimit}&skip=${offset}`;
          console.log(`⚠️  Provider: Trying /acSubmission endpoint`);
          console.log(`📤 Provider: Sending REST request to ${ALFA_LEETCODE_API}${endpoint}`);
          try {
            response = await client.get(endpoint);
          } catch (thirdError) {
            throw thirdError;
          }
        }
      } else {
        throw firstError;
      }
    }

    console.log(`📥 Provider: Response status: ${response.status}`);

    // **CRITICAL DEBUG LOGGING** - Inspect REAL response structure
    console.log(`🔎 DEBUG [fetchAcceptedProblems]: Response structure:`, {
      type: typeof response.data,
      isArray: Array.isArray(response.data),
      keys: Object.keys(response.data || {}),
      dataLength: Array.isArray(response.data) ? response.data.length : (response.data?.submissions?.length || 'unknown')
    });

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
    if (offset === 0) {
      console.log(`📋 Provider: First submission sample:`, JSON.stringify(submissionList[0], null, 2));
    }
    
    console.log(`📋 Provider: Fetched ${submissionList.length} problems (limit=${effectiveLimit}, offset=${offset})`);
    
    // **CRITICAL WARNING**: If fetched < limit, API might have max page size or end reached
    if (submissionList.length < effectiveLimit) {
      console.warn(`⚠️  Provider: Received fewer items than requested (${submissionList.length} < ${effectiveLimit})`);
      console.warn(`   This means: API hit end of results OR has max page size`);
    }

    console.log(`✅ Provider: Successfully fetched ${submissionList.length} problems`);

    return {
      success: true,
      data: {
        username: username.trim(),
        submissions: submissionList,
        count: submissionList.length,
        limitRequested: limit,
        limitUsed: effectiveLimit,
        offsetUsed: offset,
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
 * Export provider functions
 * 
 * PROVIDER RESPONSIBILITIES:
 * ✅ Fetch data from Alfa LeetCode API
 * ✅ Handle errors and timeouts
 * ✅ Log API issues (detailed logs)
 * ✅ Return raw provider data only
 * ✅ Handle invalid usernames
 * ✅ Validate API responses
 * ✅ Apply safe limits
 * 
 * NOT PROVIDER RESPONSIBILITIES:
 * ❌ Normalize data
 * ❌ Insert into MongoDB
 * ❌ Calculate analytics
 * ❌ Validate business logic
 * ❌ Transform data structure
 * ❌ Handle duplicates
 * 
 * Why keep provider lightweight?
 * 1. ISOLATION: Easy to replace with GFG/Codeforces provider later
 * 2. TESTABILITY: Can mock provider responses independently
 * 3. REUSABILITY: Controller can call provider for multiple purposes
 * 4. CLARITY: Provider = API calls, Normalization = data transformation
 * 5. MAINTAINABILITY: If API changes, only update provider
 */
export const LeetcodeProvider = {
  fetchSolvedStats,
  fetchAcceptedProblems,
  validateUsername
};

export default LeetcodeProvider;
