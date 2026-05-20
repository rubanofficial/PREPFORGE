import axios from 'axios';

const LEETCODE_API = 'https://leetcode.com/graphql/';

/**
 * Stable GraphQL query using ONLY official documented fields
 * Avoids unofficial/deprecated fields that cause 400 errors
 * Fetches: username, solved stats, ranking, reputation
 */
const STABLE_USER_QUERY = `
  query getUserStats($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        ranking
        reputation
        userAvatar
      }
      submitStats {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
        totalSubmissionNum {
          difficulty
          count
          submissions
        }
      }
    }
  }
`;

/**
 * LeetCode GraphQL Provider
 * Minimal, stable API integration
 * - Sends only stable GraphQL queries
 * - Returns raw LeetCode data
 * - Handles API errors safely
 */
class LeetcodeProvider {
  constructor() {
    this.apiUrl = LEETCODE_API;
  }

  /**
   * Fetch user stats from LeetCode
   * @param {string} username - LeetCode username
   * @returns {Promise<Object>} Raw LeetCode user stats
   * @throws {Error} With notFound, graphqlError, or timeout flags
   */
  async fetchUserStats(username) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          query: STABLE_USER_QUERY,
          variables: { username }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://leetcode.com/'
          },
          timeout: 10000
        }
      );

      // Handle GraphQL errors from response
      if (response.data?.errors && response.data.errors.length > 0) {
        const graphqlError = response.data.errors[0];
        const errorMsg = graphqlError.message || 'Unknown GraphQL error';
        
        // Log error details for debugging
        console.error('LeetCode GraphQL Error:', {
          message: errorMsg,
          locations: graphqlError.locations,
          extensions: graphqlError.extensions
        });

        const error = new Error(`LeetCode API error: ${errorMsg}`);
        error.graphqlError = true;
        error.statusCode = 502; // Bad Gateway - external API issue
        throw error;
      }

      // Validate response structure
      if (!response.data?.data) {
        throw new Error('Invalid response from LeetCode API');
      }

      // Check if user exists
      const matchedUser = response.data.data.matchedUser;
      if (!matchedUser) {
        const error = new Error(`LeetCode user "${username}" not found`);
        error.notFound = true;
        error.statusCode = 404;
        throw error;
      }

      // Return raw LeetCode data
      return matchedUser;

    } catch (error) {
      // Handle network errors
      if (error.code === 'ECONNABORTED') {
        const err = new Error('LeetCode API timeout - request took too long');
        err.statusCode = 504;
        throw err;
      }

      if (error.code === 'ENOTFOUND') {
        const err = new Error('Cannot reach LeetCode API - network error');
        err.statusCode = 503;
        throw err;
      }

      // Handle HTTP errors from axios
      if (error.response) {
        const status = error.response.status;
        const responseData = error.response.data;

        // 400: Bad Request - usually schema validation error
        if (status === 400) {
          const graphqlErrors = responseData?.errors || [];
          const errorMsg = graphqlErrors[0]?.message || 'GraphQL schema validation failed';
          
          console.error('GraphQL Schema Error:', errorMsg);
          const err = new Error(`GraphQL error: ${errorMsg}`);
          err.graphqlError = true;
          err.statusCode = 502;
          throw err;
        }

        // 429: Rate limited
        if (status === 429) {
          const err = new Error('LeetCode rate limit exceeded - try again later');
          err.rateLimited = true;
          err.statusCode = 429;
          throw err;
        }

        // Other HTTP errors
        const err = new Error(`LeetCode API returned status ${status}`);
        err.statusCode = status;
        throw err;
      }

      // Re-throw if already processed
      if (error.statusCode) throw error;

      // Unknown error
      const err = new Error(`Failed to fetch LeetCode data: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }
  }
}

export default new LeetcodeProvider();
