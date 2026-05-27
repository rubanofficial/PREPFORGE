import leetcodeAuthProvider from '../providers/leetcodeAuthProvider.js';
import Problem from '../../models/Problem.js';
import User from '../../models/User.js';
import axios from 'axios';

/**
 * Problem Enrichment Service
 * 
 * Backfills missing difficulty data for problems that were synced
 * before the GraphQL query was updated to include difficulty.
 * 
 * FLOW:
 * 1. Find all problems with difficulty = null for a user
 * 2. Fetch problem details from LeetCode using titleSlug
 * 3. Update problem with difficulty and topics
 * 4. Track progress and metrics
 */

const ENRICHMENT_BATCH_SIZE = 10; // Fetch 10 problems details in parallel

/**
 * Enrich all problems for a user with difficulty data
 * 
 * @param {string} userId - MongoDB user ID
 * @param {Object} leetcodeClient - Authenticated LeetCode client (optional - for authenticated enrichment)
 * @returns {Promise<Object>} Enrichment metrics
 */
async function enrichUserProblems(userId, leetcodeClient = null) {
    console.log(`\n🔄 Starting problem enrichment for user: ${userId}`);

    try {
        // Get user to verify they exist and have auth
        const user = await User.findById(userId);
        if (!user) {
            return {
                success: false,
                error: 'User not found',
                enrichedCount: 0,
                failedCount: 0,
            };
        }

        // Find all problems with null difficulty for this user
        const problemsToEnrich = await Problem.find({
            userId,
            difficulty: null,
        }).limit(1000); // Safety limit

        console.log(`📊 Found ${problemsToEnrich.length} problems to enrich`);

        if (problemsToEnrich.length === 0) {
            return {
                success: true,
                message: 'No problems to enrich',
                enrichedCount: 0,
                failedCount: 0,
            };
        }

        let enrichedCount = 0;
        let failedCount = 0;

        // Process in batches
        for (let i = 0; i < problemsToEnrich.length; i += ENRICHMENT_BATCH_SIZE) {
            const batch = problemsToEnrich.slice(i, i + ENRICHMENT_BATCH_SIZE);

            console.log(`\n📦 Processing batch ${Math.floor(i / ENRICHMENT_BATCH_SIZE) + 1}/${Math.ceil(problemsToEnrich.length / ENRICHMENT_BATCH_SIZE)}`);

            // Enrich problems in parallel
            const enrichPromises = batch.map(problem =>
                enrichSingleProblem(problem, leetcodeClient)
            );

            const results = await Promise.allSettled(enrichPromises);

            results.forEach((result, idx) => {
                if (result.status === 'fulfilled' && result.value.enriched) {
                    enrichedCount++;
                } else {
                    failedCount++;
                }
            });
        }

        console.log(`\n✅ Enrichment complete. Enriched: ${enrichedCount}, Failed: ${failedCount}`);

        return {
            success: true,
            enrichedCount,
            failedCount,
            total: problemsToEnrich.length,
        };
    } catch (error) {
        console.error(`❌ Problem enrichment failed:`, error.message);
        return {
            success: false,
            error: error.message,
            enrichedCount: 0,
            failedCount: 0,
        };
    }
}

/**
 * Enrich a single problem with difficulty data
 * 
 * @param {Object} problem - Problem document from MongoDB
 * @param {Object} leetcodeClient - Authenticated LeetCode client (optional)
 * @returns {Promise<Object>} {enriched: boolean, error?: string}
 */
async function enrichSingleProblem(problem, leetcodeClient = null) {
    try {
        // If no auth client, use public API (Alfa LeetCode)
        if (!leetcodeClient) {
            const result = await enrichFromPublicAPI(problem);
            return result;
        }

        // Use authenticated client to fetch problem details
        const { problem: problemDetail, error } = await leetcodeAuthProvider.fetchProblemDetail(
            leetcodeClient,
            problem.titleSlug
        );

        if (error || !problemDetail) {
            console.warn(`⚠️  Failed to enrich "${problem.titleSlug}": ${error?.message || 'Unknown error'}`);
            return { enriched: false };
        }

        // Update problem with fetched data
        const updateData = {};

        if (problemDetail.difficulty) {
            updateData.difficulty = problemDetail.difficulty;
        }

        if (Array.isArray(problemDetail.topics) && problemDetail.topics.length > 0) {
            updateData.topics = problemDetail.topics.map(t => t.slug?.toLowerCase() || t.name?.toLowerCase()).filter(Boolean);
        }

        if (Object.keys(updateData).length === 0) {
            return { enriched: false };
        }

        updateData.updatedAt = new Date();

        await Problem.findByIdAndUpdate(problem._id, updateData);
        console.log(`✅ Enriched: "${problem.title}" - difficulty: ${problemDetail.difficulty}`);

        return { enriched: true };
    } catch (error) {
        console.error(`❌ Error enriching "${problem.title}":`, error.message);
        return { enriched: false, error: error.message };
    }
}

/**
 * Enrich problem using public Alfa LeetCode API
 * This is slower but doesn't require authentication
 * 
 * @param {Object} problem - Problem document
 * @returns {Promise<Object>} {enriched: boolean}
 */
async function enrichFromPublicAPI(problem) {
    try {
        // Alfa LeetCode API endpoint for problem details
        const response = await axios.get(`https://alfa-leetcode-api.onrender.com/select?titleSlug=${problem.titleSlug}`, {
            timeout: 5000
        });

        const data = response.data;

        if (data && data.difficulty) {
            await Problem.findByIdAndUpdate(problem._id, {
                difficulty: data.difficulty,
                updatedAt: new Date(),
            });
            return { enriched: true };
        }

        return { enriched: false };
    } catch (error) {
        console.error(`⚠️  Public API enrichment failed for "${problem.titleSlug}":`, error.message);
        return { enriched: false };
    }
}

export default {
    enrichUserProblems,
    enrichSingleProblem,
};
