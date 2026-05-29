import { GoogleGenAI } from '@google/genai';
import Problem from '../models/Problem.js';
import mongoose from 'mongoose';

// Lazy-init: dotenv.config() in server.js runs AFTER ES module imports,
// so process.env.GEMINI_API_KEY is undefined at import time.
// We create the client on first use when the env is guaranteed to be loaded.
let _ai = null;
function getAI() {
    if (!_ai) {
        _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return _ai;
}

/**
 * Convert userId string to ObjectId for aggregation $match
 */
function toObjectId(userId) {
    return new mongoose.Types.ObjectId(userId);
}

/**
 * Fetch comprehensive user performance data
 * Combines dashboard stats with detailed problem analysis
 */
async function getUserPerformanceData(userId) {
    const uid = toObjectId(userId);

    // Get all problems with full details
    const problems = await Problem.find({ userId: uid }).sort({ solvedAt: -1 });

    if (problems.length === 0) {
        return null;
    }

    // Easy, Medium, Hard breakdown
    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;
    
    // Track topic counts
    const topicCounts = {};
    problems.forEach(p => {
        const diff = p.difficulty?.toLowerCase();
        if (diff === 'easy') easySolved++;
        else if (diff === 'medium') mediumSolved++;
        else if (diff === 'hard') hardSolved++;
        
        p.topics?.forEach(t => {
            if (t) {
                // Capitalize topic name for consistency
                const formattedTopic = t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                topicCounts[formattedTopic] = (topicCounts[formattedTopic] || 0) + 1;
            }
        });
    });

    const totalSolved = problems.length;

    // Strong topics: top 3 most solved topics
    const sortedTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1]);
    
    const strongTopics = sortedTopics.slice(0, 3).map(([name]) => name);
    
    // Core LeetCode topics to check for weak areas if the user hasn't solved much
    const coreTopics = ['Array', 'String', 'Hash Table', 'Dynamic Programming', 'Graph', 'Tree', 'Two Pointers', 'Binary Search', 'Stack', 'Queue', 'Heap (Priority Queue)'];
    const weakTopics = coreTopics
        .filter(t => !strongTopics.includes(t))
        .map(t => ({ name: t, count: topicCounts[t] || 0 }))
        .sort((a, b) => a.count - b.count)
        .slice(0, 3)
        .map(t => t.name);

    // Consistency score: active days in last 30 days (target: 12 days for 100%)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeDaysCount = new Set(
        problems
            .filter(p => p.solvedAt && new Date(p.solvedAt) >= thirtyDaysAgo)
            .map(p => new Date(p.solvedAt).toDateString())
    ).size;
    const consistencyScore = Math.min(100, Math.round((activeDaysCount / 12) * 100)) || 0;

    const topicsCovered = Object.keys(topicCounts).length;
    const recentProblems = problems.slice(0, 5).map(p => `${p.title} (${p.difficulty || 'Medium'})`);

    return {
        totalSolved,
        easySolved,
        mediumSolved,
        hardSolved,
        strongTopics,
        weakTopics,
        consistencyScore,
        topicsCovered,
        recentProblems
    };
}

/**
 * Generate AI-powered performance analysis using Gemini
 * Identifies weaknesses and strengths in the user's problem-solving pattern
 */
async function analyzeUserPerformance(userId) {
    try {
        const performanceData = await getUserPerformanceData(userId);

        if (!performanceData) {
            return {
                success: false,
                message: 'No problems solved yet. Start solving problems to get AI insights!'
            };
        }

        // Prepare data summary for the prompt
        const prompt = `You are a LeetCode performance analytics engine.
Analyze this user's LeetCode performance data and generate insights.

User Performance Data:
${JSON.stringify(performanceData, null, 2)}

You must return a valid JSON object matching this schema:
{
  "readinessScore": number (0-100),
  "strengths": string[] (Exactly 3 strengths. Keep them short, max 3 words each, capitalized. e.g. "Dynamic Programming", "Array Problems"),
  "weaknesses": string[] (Exactly 3 weaknesses. Keep them short, max 3 words each, capitalized. e.g. "Hard Problems", "Graph Traversal"),
  "weeklyFocus": string[] (Exactly 3 concrete actionable goals for this week, max 10 words each),
  "aiInsight": string (A concise summary of their current standing, exactly 1-2 sentences, max 40 words),
  "recommendedProblems": [
    {
      "title": string (Exact name of a LeetCode problem),
      "reason": string (Short reason why they should solve it, max 10 words)
    }
  ] (Recommend exactly 2-3 standard LeetCode problems aligned with their weaknesses/weekly focus)
}

CRITICAL RULES:
1. Do NOT include any markdown code blocks (e.g. \`\`\`json ... \`\`\`), HTML tags, or extra text. Return ONLY the JSON object.
2. Ensure the JSON is perfectly formatted and parsable.
3. The readinessScore should be a calculated estimate based on totalSolved, consistencyScore, difficulty breakdown, and weak topics. A user with fewer than 50 solved problems or low consistency should not have a score above 50.
`;

        // Call Gemini API using new @google/genai SDK with responseMimeType config
        const result = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });
        const analysisText = result.text;

        // Parse the analysis into structured format
        const analysis = parseAnalysis(analysisText);

        return {
            success: true,
            analysis,
            rawAnalysis: analysisText,
            performanceMetrics: {
                totalSolved: performanceData.totalSolved,
                easySolved: performanceData.easySolved,
                mediumSolved: performanceData.mediumSolved,
                hardSolved: performanceData.hardSolved,
                consistencyScore: performanceData.consistencyScore,
                topicsCovered: performanceData.topicsCovered
            }
        };
    } catch (error) {
        console.error('Error analyzing user performance:', error);
        throw error;
    }
}

/**
 * Parse Gemini analysis into structured sections
 */
function parseAnalysis(text) {
    try {
        let cleanText = text.trim();
        // Strip markdown code blocks if present
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        return JSON.parse(cleanText.trim());
    } catch (e) {
        console.error('Failed to parse Gemini response as JSON. Raw response:', text);
        throw new Error('AI returned an invalid response format. Please try again.');
    }
}

export { analyzeUserPerformance, getUserPerformanceData };
