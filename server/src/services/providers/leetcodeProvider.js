import axios from 'axios';

const ALFA_LEETCODE_API = 'https://alfa-leetcode-api.onrender.com';

const API_TIMEOUT = 30000;
const MAX_RETRIES = 1;

const SAFE_UPPER_LIMIT = 3000;

function createAxiosInstance() {
  return axios.create({
    baseURL: ALFA_LEETCODE_API,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function handleApiError(error, operation) {
  console.error(`❌ Alfa API Error [${operation}]:`, {
    message: error.message,
    code: error.code,
    statusCode: error.response?.status,
    timestamp: new Date().toISOString()
  });

  if (error.code === 'ECONNABORTED') {
    return {
      error: 'TIMEOUT',
      message: 'API request timeout (>30s)',
      statusCode: 504
    };
  }

  if (error.code === 'ENOTFOUND') {
    return {
      error: 'NETWORK_ERROR',
      message: 'Cannot reach API - network unreachable',
      statusCode: 503
    };
  }

  if (error.response?.status === 404) {
    return {
      error: 'USER_NOT_FOUND',
      message: 'LeetCode user not found',
      statusCode: 404
    };
  }

  if (error.response?.status === 429) {
    return {
      error: 'RATE_LIMITED',
      message: 'API rate limit exceeded - try again later',
      statusCode: 429
    };
  }

  if (error.response?.status === 400) {
    return {
      error: 'BAD_REQUEST',
      message: error.response.data?.message || 'Bad request to API',
      statusCode: 400
    };
  }

  if (error.response?.status) {
    return {
      error: 'HTTP_ERROR',
      message: `API returned status ${error.response.status}`,
      statusCode: error.response.status
    };
  }

  return {
    error: 'API_ERROR',
    message: error.message || 'Unknown API error',
    statusCode: 502
  };
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }

  const trimmed = username.trim();

  if (trimmed.length < 1 || trimmed.length > 50) {
    return false;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return false;
  }

  return true;
}

async function fetchSolvedStats(username) {
  console.log(`📊 Provider: Fetching solved stats for "${username}"`);

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

    let totalSolved = response.data.solvedProblem || response.data.totalSolved || response.data.total || 0;

    const easySolved = response.data.easySolved || 0;
    const mediumSolved = response.data.mediumSolved || 0;
    const hardSolved = response.data.hardSolved || 0;

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

async function fetchAcceptedProblems(username, limit = 20, offset = 0) {
  console.log(`🔍 Provider: Fetching accepted problems for "${username}" with limit=${limit}, offset=${offset}`);

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

  const effectiveLimit = Math.min(limit, SAFE_UPPER_LIMIT);

  if (limit > SAFE_UPPER_LIMIT) {
    console.warn(`⚠️  Provider: Limit ${limit} exceeds safe upper limit ${SAFE_UPPER_LIMIT}, capping to ${effectiveLimit}`);
  }

  try {
    const client = createAxiosInstance();

    let endpoint = `/${username.trim()}/submission?limit=${effectiveLimit}&skip=${offset}`;
    console.log(`📤 Provider: Sending REST request to ${ALFA_LEETCODE_API}${endpoint}`);

    let response;

    try {
      response = await client.get(endpoint);
    } catch (firstError) {
      if (firstError.response?.status === 404 || firstError.code === 'ERR_BAD_REQUEST') {
        endpoint = `/${username.trim()}/submission?limit=${effectiveLimit}`;
        console.log(`⚠️  Provider: Retrying without skip parameter`);
        console.log(`📤 Provider: Sending REST request to ${ALFA_LEETCODE_API}${endpoint}`);

        try {
          response = await client.get(endpoint);
        } catch (secondError) {
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

    console.log(`🔎 DEBUG [fetchAcceptedProblems]: Response structure:`, {
      type: typeof response.data,
      isArray: Array.isArray(response.data),
      keys: Object.keys(response.data || {}),
      dataLength: Array.isArray(response.data)
        ? response.data.length
        : (response.data?.submissions?.length || 'unknown')
    });

    if (!response.data) {
      console.warn(`⚠️  Provider: Empty response data for user "${username}"`);
      return {
        error: 'EMPTY_RESPONSE',
        message: 'API returned empty response',
        statusCode: 502
      };
    }

    let submissionList = null;

    if (Array.isArray(response.data.submissionList)) {
      console.log(`✅ Provider: Detected structure: { submissionList: [...] }`);
      submissionList = response.data.submissionList;
    } else if (Array.isArray(response.data.submissions)) {
      console.log(`✅ Provider: Detected structure: { submissions: [...] }`);
      submissionList = response.data.submissions;
    } else if (Array.isArray(response.data)) {
      console.log(`✅ Provider: Detected structure: response.data is direct array`);
      submissionList = response.data;
    } else if (Array.isArray(response.data.data)) {
      console.log(`✅ Provider: Detected structure: { data: [...] }`);
      submissionList = response.data.data;
    } else {
      for (const [key, value] of Object.entries(response.data)) {
        if (Array.isArray(value)) {
          console.log(`✅ Provider: Found array at key "${key}"`);
          submissionList = value;
          break;
        }
      }
    }

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

    if (offset === 0) {
      console.log(`📋 Provider: First submission sample:`, JSON.stringify(submissionList[0], null, 2));
    }

    console.log(`📋 Provider: Fetched ${submissionList.length} problems (limit=${effectiveLimit}, offset=${offset})`);

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

export const LeetcodeProvider = {
  fetchSolvedStats,
  fetchAcceptedProblems,
  validateUsername
};

export default LeetcodeProvider;