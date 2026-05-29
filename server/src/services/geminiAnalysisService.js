import { GoogleGenerativeAI } from '@google/generative-ai';
import Problem from '../models/Problem.js';
import mongoose from 'mongoose';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    // Aggregate statistics using MongoDB
    const [stats] = await Problem.aggregate([
        { $match: { userId: uid } },
        {
            $facet: {
                totalCount: [{ $count: 'count' }],
                difficultyBreakdown: [
                    {
                        $group: {
                            _id: '$difficulty',
                            count: { $sum: 1 }
                        }
                    }
                ],
                topicStats: [
                    { $unwind: '$topics' },
                    {
                        $group: {
                            _id: '$topics',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 20 }
                ],
                languageStats: [
                    { $match: { language: { $ne: null, $ne: '' } } },
                    {
                        $group: {
                            _id: '$language',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ],
                // Time period analysis
                timeStats: [
                    {
                        $group: {
                            _id: null,
                            firstProblem: { $min: '$solvedAt' },
                            lastProblem: { $max: '$solvedAt' },
                            avgProblemsPerDay: {
                                $divide: [
                                    { $sum: 1 },
                                    {
                                        $max: [
                                            {
                                                $divide: [
                                                    { $subtract: ['$lastProblem', '$firstProblem'] },
                                                    86400000 // milliseconds in a day
                                                ]
                                            },
                                            1 // at least 1 day
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        }
    ]);

    // Parse difficulty breakdown
    const difficulty = { easy: 0, medium: 0, hard: 0, unknown: 0 };
    for (const stat of stats.difficultyBreakdown) {
        const key = stat._id ? stat._id.toLowerCase() : 'unknown';
        if (key in difficulty) {
            difficulty[key] = stat.count;
        } else {
            difficulty.unknown += stat.count;
        }
    }

    // Parse topic stats
    const topTopics = stats.topicStats.map(t => ({
        name: t._id,
        count: t.count
    }));

    // Parse language stats
    const languages = stats.languageStats.map(l => ({
        name: l._id,
        count: l.count
    }));

    // Identify weak and strong topics
    const allTopics = {};
    problems.forEach(p => {
        p.topics?.forEach(topic => {
            allTopics[topic] = (allTopics[topic] || 0) + 1;
        });
    });

    // Sort topics by frequency
    const topicsSorted = Object.entries(allTopics)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
        totalProblems: stats.totalCount[0]?.count || 0,
        difficulty,
        topTopics,
        languages,
        allTopics: topicsSorted,
        problemsList: problems.map(p => ({
            title: p.title,
            difficulty: p.difficulty,
            topics: p.topics,
            language: p.language,
            solvedAt: p.solvedAt
        })),
        timeStats: stats.timeStats[0] || {}
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
        const dataSummary = `
User Performance Data:
- Total Problems Solved: ${performanceData.totalProblems}
- Difficulty Breakdown: Easy (${performanceData.difficulty.easy}), Medium (${performanceData.difficulty.medium}), Hard (${performanceData.difficulty.hard}), Unknown (${performanceData.difficulty.unknown})
- Top 10 Topics: ${performanceData.topTopics.slice(0, 10).map(t => `${t.name} (${t.count})`).join(', ')}
- Languages Used: ${performanceData.languages.map(l => `${l.name} (${l.count})`).join(', ')}
- All Topics Covered (${performanceData.allTopics.length}): ${performanceData.allTopics.slice(0, 20).map(t => t.name).join(', ')}${performanceData.allTopics.length > 20 ? '...' : ''}
- Recent Problems (Last 5): ${performanceData.problemsList.slice(0, 5).map(p => `${p.title} (${p.difficulty})`).join(', ')}
`;

        // Create the AI prompt
        const prompt = `You are an expert coding interview coach analyzing a LeetCode user's performance data. Based on the following problem-solving statistics, provide a detailed performance analysis.

${dataSummary}

Please analyze and provide:

1. **STRENGTHS** (2-3 bullet points):
   - Identify areas where the user excels based on their solved problems
   - Look at difficulty distribution, topic coverage, and consistency
   
2. **WEAKNESSES** (2-3 bullet points):
   - Identify gaps in problem-solving approach
   - Highlight underrepresented topics or difficulty levels
   - Suggest areas needing improvement
   
3. **RECOMMENDED FOCUS AREAS** (3-4 specific topics/difficulties):
   - Based on interview preparation best practices
   - Consider balance and progression

4. **ACTION PLAN** (3-4 specific steps):
   - Concrete steps to improve weak areas
   - Realistic timeline and milestones

Format the response as clear, actionable insights. Be encouraging but honest about areas for improvement.`;

        // Call Gemini API
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent(prompt);
        const analysisText = result.response.text();

        // Parse the analysis into structured format
        const analysis = parseAnalysis(analysisText);

        return {
            success: true,
            analysis,
            rawAnalysis: analysisText,
            performanceMetrics: {
                totalProblems: performanceData.totalProblems,
                difficulty: performanceData.difficulty,
                topicsCount: performanceData.allTopics.length,
                languagesUsed: performanceData.languages.length
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
    const sections = {
        strengths: [],
        weaknesses: [],
        focusAreas: [],
        actionPlan: []
    };

    // Split by sections
    const strengthsMatch = text.match(/STRENGTHS[^:]*:([\s\S]*?)(?=WEAKNESSES|$)/i);
    const weaknessesMatch = text.match(/WEAKNESSES[^:]*:([\s\S]*?)(?=RECOMMENDED|ACTION|$)/i);
    const focusMatch = text.match(/(?:RECOMMENDED\s+)?FOCUS\s+AREAS[^:]*:([\s\S]*?)(?=ACTION|$)/i);
    const actionMatch = text.match(/ACTION\s+PLAN[^:]*:([\s\S]*?)$/i);

    // Parse bullet points from each section
    const parseBullets = (text) => {
        if (!text) return [];
        return text
            .split('\n')
            .filter(line => line.trim().match(/^[-•*•]\s+|^\d+\.\s+/))
            .map(line => line.replace(/^[-•*•]\s+|^\d+\.\s+/, '').trim())
            .filter(line => line.length > 0);
    };

    sections.strengths = parseBullets(strengthsMatch?.[1] || '');
    sections.weaknesses = parseBullets(weaknessesMatch?.[1] || '');
    sections.focusAreas = parseBullets(focusMatch?.[1] || '');
    sections.actionPlan = parseBullets(actionMatch?.[1] || '');

    return sections;
}

export { analyzeUserPerformance, getUserPerformanceData };
