import axios from 'axios';

const LEETCODE_API = 'https://leetcode.com/graphql/';

// GraphQL query to fetch user submissions and stats
const SUBMISSIONS_QUERY = `
  query getSubmissions($userName: String!) {
    userProfileUserLevelProgress(userName: $userName) {
      solvedProblem
    }
    recentAcSubmissions(username: $userName, limit: 20) {
      submissions {
        id
        title
        titleSlug
        timestamp
        statusDisplay
      }
    }
    userProfile(username: $userName) {
      username
      realName
      profile {
        userAvatar
        reputation
      }
    }
  }
`;

// GraphQL query to fetch problem difficulty and tags
const PROBLEM_DETAILS_QUERY = `
  query getProblem($titleSlug: String!) {
    problem(titleSlug: $titleSlug) {
      questionId
      title
      titleSlug
      difficulty
      topicTags {
        name
        slug
      }
      codeSnippets {
        lang
      }
    }
  }
`;

/**
 * Fetch user's recent submissions from LeetCode
 * @param {string} username - LeetCode username
 * @returns {Promise<Array>} Array of recent submissions
 */
const getRecentSubmissions = async (username) => {
  try {
    const response = await axios.post(
      LEETCODE_API,
      {
        query: SUBMISSIONS_QUERY,
        variables: { userName: username }
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

    // Check for GraphQL errors (different from HTTP errors)
    if (response.data.errors) {
      const errorMsg = response.data.errors[0]?.message || 'Unknown error';
      console.error('LeetCode GraphQL error:', errorMsg);
      throw new Error(`LeetCode error: ${errorMsg}`);
    }

    // Check if data exists
    if (!response.data.data) {
      throw new Error('No data returned from LeetCode API');
    }

    // Extract submissions from response
    const submissions = response.data.data.recentAcSubmissions?.submissions || [];
    
    if (submissions.length === 0) {
      throw new Error(`No accepted submissions found for user "${username}". User might not exist or has no submissions.`);
    }

    return submissions;
  } catch (error) {
    console.error('Error fetching submissions:', error.message);
    throw error;
  }
};

/**
 * Fetch solved problem statistics
 * @param {string} username - LeetCode username
 * @returns {Promise<Object>} User stats (solvedCount, etc)
 */
const getSolvedStats = async (username) => {
  try {
    const response = await axios.post(
      LEETCODE_API,
      {
        query: SUBMISSIONS_QUERY,
        variables: { userName: username }
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

    if (response.data.errors) {
      const errorMsg = response.data.errors[0]?.message || 'Unknown error';
      console.error('LeetCode GraphQL error:', errorMsg);
      throw new Error(`LeetCode error: ${errorMsg}`);
    }

    if (!response.data.data) {
      throw new Error('No data returned from LeetCode API');
    }

    const stats = {
      solvedCount: response.data.data.userProfileUserLevelProgress?.solvedProblem || 0,
      username: response.data.data.userProfile?.username || username
    };

    return stats;
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    throw error;
  }
};

/**
 * Fetch problem difficulty and topics for a specific problem
 * @param {string} titleSlug - Problem slug (e.g., "two-sum")
 * @returns {Promise<Object>} Problem details
 */
const getProblemDetails = async (titleSlug) => {
  try {
    const response = await axios.post(
      LEETCODE_API,
      {
        query: PROBLEM_DETAILS_QUERY,
        variables: { titleSlug }
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

    if (response.data.errors) {
      const errorMsg = response.data.errors[0]?.message || 'Unknown error';
      throw new Error(`LeetCode error: ${errorMsg}`);
    }

    const problemData = response.data.data?.problem;

    if (!problemData) {
      throw new Error(`Problem not found: ${titleSlug}`);
    }

    return {
      title: problemData.title,
      titleSlug: problemData.titleSlug,
      difficulty: problemData.difficulty,
      topics: problemData.topicTags?.map(tag => tag.name) || [],
      questionId: problemData.questionId
    };
  } catch (error) {
    console.error('Error fetching problem details:', error.message);
    throw error;
  }
};

/**
 * Main function: Fetch all LeetCode data for a user
 * @param {string} username - LeetCode username
 * @returns {Promise<Object>} Complete user data with submissions
 */
const fetchLeetCodeData = async (username) => {
  try {
    // Step 1: Fetch recent submissions and stats in parallel for efficiency
    const [submissions, stats] = await Promise.all([
      getRecentSubmissions(username),
      getSolvedStats(username)
    ]);

    // Step 2: Validate we have data
    if (!submissions || submissions.length === 0) {
      throw new Error(`No accepted submissions found for user: ${username}`);
    }

    // Step 3: Fetch problem details for each submission in parallel
    // Limit to 20 most recent to avoid rate limiting
    const problemDetailsPromises = submissions.slice(0, 20).map(sub =>
      getProblemDetails(sub.titleSlug).catch(err => {
        console.warn(`Skipping problem ${sub.titleSlug}: ${err.message}`);
        return null;
      })
    );

    const problemDetailsList = await Promise.all(problemDetailsPromises);

    // Step 4: Merge submission data with problem details
    const enrichedSubmissions = submissions.map((submission, index) => ({
      ...submission,
      problemDetails: problemDetailsList[index]
    }));

    return {
      username: stats.username,
      solvedCount: stats.solvedCount,
      submissions: enrichedSubmissions.filter(sub => sub.problemDetails) // Remove failed fetches
    };
  } catch (error) {
    console.error('Error in fetchLeetCodeData:', error.message);
    throw error;
  }
};

export default {
  fetchLeetCodeData,
  getRecentSubmissions,
  getSolvedStats,
  getProblemDetails
};
