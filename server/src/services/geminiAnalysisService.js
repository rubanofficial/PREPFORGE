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
 * Fetch comprehensive user performance data with enriched breakdowns.
 *
 * Returns per-topic difficulty counts, weighted scores, solved slugs list,
 * and full problem details so the AI prompt can make evidence-based judgements.
 */
async function getUserPerformanceData(userId) {
    const uid = toObjectId(userId);

    // Get all problems with full details
    const problems = await Problem.find({ userId: uid }).sort({ solvedAt: -1 });

    if (problems.length === 0) {
        return null;
    }

    // ── Difficulty breakdown ────────────────────────────────────────────
    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;

    // ── Per-topic difficulty breakdown ──────────────────────────────────
    // { "Array": { easy: 5, medium: 8, hard: 2 }, ... }
    const topicDifficultyBreakdown = {};
    const topicCounts = {};

    // ── Full solved problem list (for Gemini context) ──────────────────
    const solvedProblemDetails = [];
    const solvedProblemSlugs = [];

    problems.forEach(p => {
        const diff = p.difficulty?.toLowerCase();
        if (diff === 'easy') easySolved++;
        else if (diff === 'medium') mediumSolved++;
        else if (diff === 'hard') hardSolved++;

        // Collect slug for exclusion list
        if (p.titleSlug) {
            solvedProblemSlugs.push(p.titleSlug);
        }

        // Collect full details for AI context
        solvedProblemDetails.push({
            title: p.title,
            titleSlug: p.titleSlug,
            difficulty: p.difficulty || 'Unknown',
            topics: p.topics || []
        });

        // Build per-topic difficulty map
        p.topics?.forEach(t => {
            if (t) {
                const formattedTopic = t.split(' ')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');

                // Flat topic count
                topicCounts[formattedTopic] = (topicCounts[formattedTopic] || 0) + 1;

                // Per-topic difficulty breakdown
                if (!topicDifficultyBreakdown[formattedTopic]) {
                    topicDifficultyBreakdown[formattedTopic] = { easy: 0, medium: 0, hard: 0 };
                }
                if (diff === 'easy') topicDifficultyBreakdown[formattedTopic].easy++;
                else if (diff === 'medium') topicDifficultyBreakdown[formattedTopic].medium++;
                else if (diff === 'hard') topicDifficultyBreakdown[formattedTopic].hard++;
            }
        });
    });

    const totalSolved = problems.length;

    // ── Weighted score: easy×1 + medium×2 + hard×3 ─────────────────────
    const weightedScore = (easySolved * 1) + (mediumSolved * 2) + (hardSolved * 3);

    // ── Consistency score: active days in last 30 days ──────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeDaysCount = new Set(
        problems
            .filter(p => p.solvedAt && new Date(p.solvedAt) >= thirtyDaysAgo)
            .map(p => new Date(p.solvedAt).toDateString())
    ).size;
    const consistencyScore = Math.min(100, Math.round((activeDaysCount / 12) * 100)) || 0;

    const topicsCovered = Object.keys(topicCounts).length;

    return {
        totalSolved,
        easySolved,
        mediumSolved,
        hardSolved,
        weightedScore,
        consistencyScore,
        topicsCovered,
        topicCounts,
        topicDifficultyBreakdown,
        solvedProblemSlugs,
        solvedProblemDetails
    };
}

/**
 * Generate AI-powered performance analysis using Gemini.
 *
 * Sends enriched data to Gemini with strict rules for granular topic
 * classification, weighted scoring, evidence-based ratings, unsolved-only
 * recommendations, placement assessment, and a 4-week roadmap.
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

        // ── Build the comprehensive prompt ─────────────────────────────
        const prompt = `You are a brutally honest, evidence-based LeetCode performance analytics engine.
Analyze this user's complete LeetCode problem-solving history and generate a comprehensive analysis.

═══════════════════════════════════════════════════════════
USER PERFORMANCE DATA
═══════════════════════════════════════════════════════════

Summary:
- Total Unique Accepted Problems: ${performanceData.totalSolved}
- Easy: ${performanceData.easySolved} | Medium: ${performanceData.mediumSolved} | Hard: ${performanceData.hardSolved}
- Weighted Score (E×1 + M×2 + H×3): ${performanceData.weightedScore}
- Consistency Score (last 30 days): ${performanceData.consistencyScore}%
- Topics Covered: ${performanceData.topicsCovered}

Per-Topic Difficulty Breakdown:
${JSON.stringify(performanceData.topicDifficultyBreakdown, null, 2)}

All Solved Problems (title, difficulty, topics):
${JSON.stringify(performanceData.solvedProblemDetails, null, 2)}

Already Solved Problem Slugs (DO NOT recommend these):
${JSON.stringify(performanceData.solvedProblemSlugs)}

═══════════════════════════════════════════════════════════
CRITICAL ANALYSIS RULES
═══════════════════════════════════════════════════════════

1. Do NOT judge topic strength using only problem tags or counts. Analyze the ACTUAL problems solved and their difficulty.
2. Give MORE weight to Medium and Hard problems than Easy problems when computing ratings. A user who solved 10 Easy array problems is weaker than one who solved 3 Medium + 2 Hard.
3. The data already contains only unique accepted problems. Do not double-count.
4. Do NOT recommend ANY problem whose titleSlug appears in the solvedProblemSlugs list above.
5. You MUST distinguish between these sub-categories and rate them SEPARATELY:
   - "Basic Graphs" (BFS, DFS, connected components, flood fill) vs "Advanced Graphs" (Dijkstra, MST, Bellman-Ford, weighted graph algorithms)
   - "Basic DP" (fibonacci, climbing stairs, house robber, coin change basic) vs "Advanced DP" (bitmask DP, digit DP, interval DP, knapsack variants, LCS/LIS optimization)
   - "Binary Search Basics" (standard sorted array search) vs "Binary Search on Answer" (min/max optimization, capacity-type problems)
   - "Heap / Priority Queue" as its own separate category (NOT merged with anything)
6. Prioritize MISSING patterns over repeating already-mastered topics in the next10Problems recommendations.
7. Be brutally honest and evidence-based. Do NOT use generic advice. Justify every conclusion with actual solved problems from the data.
8. The overallReadinessScore must factor in: total unique problems, difficulty distribution (heavily weighted), topic coverage breadth, consistency, and weak area severity. Users with fewer than 50 problems or poor difficulty mix should NOT score above 50.
9. Provide EXACTLY 3-5 items for strongestAreas and weakestAreas, each with specific evidence from the solved problems.
10. Provide EXACTLY 3-5 missing interview patterns.
11. Provide EXACTLY 10 problems for next10Problems. ALL must be real LeetCode problems. NONE may be already solved.
12. The 4-week roadmap must be specific and actionable based on the user's actual gaps. Not generic.

═══════════════════════════════════════════════════════════
REQUIRED OUTPUT JSON SCHEMA
═══════════════════════════════════════════════════════════

Return a valid JSON object matching this EXACT schema:

{
  "overallReadinessScore": number (0-100),
  "topicStrengthRatings": {
    "Arrays": number (0-10),
    "Strings": number (0-10),
    "Sliding Window": number (0-10),
    "Linked List": number (0-10),
    "Trees": number (0-10),
    "Binary Search Basics": number (0-10),
    "Binary Search on Answer": number (0-10),
    "Basic Graphs": number (0-10),
    "Advanced Graphs": number (0-10),
    "Heap / Priority Queue": number (0-10),
    "Basic DP": number (0-10),
    "Advanced DP": number (0-10),
    "Stack": number (0-10),
    "Queue": number (0-10),
    "Two Pointers": number (0-10),
    "Backtracking": number (0-10),
    "Greedy": number (0-10),
    "Math": number (0-10),
    "Bit Manipulation": number (0-10),
    "Trie": number (0-10)
  },
  "strongestAreas": [
    {
      "topic": string,
      "rating": number (0-10),
      "evidence": string (cite specific solved problems and difficulty)
    }
  ],
  "weakestAreas": [
    {
      "topic": string,
      "rating": number (0-10),
      "evidence": string (cite what is missing)
    }
  ],
  "missingInterviewPatterns": [
    {
      "pattern": string,
      "importance": "High" | "Medium" | "Low",
      "description": string
    }
  ],
  "next10Problems": [
    {
      "title": string (exact LeetCode problem name),
      "difficulty": "Easy" | "Medium" | "Hard",
      "topic": string,
      "reason": string (why this problem fills a gap)
    }
  ],
  "placementAssessment": {
    "currentLevel": string (e.g. "Beginner", "Mid-Level", "Advanced", "Expert"),
    "serviceCompanyReadiness": string (e.g. "85% — Ready for most service company interviews"),
    "productCompanyReadiness": string (e.g. "55% — Needs significant DP and Advanced Graph work"),
    "fourWeekRoadmap": {
      "week1": { "focus": string, "problems": string[], "goal": string },
      "week2": { "focus": string, "problems": string[], "goal": string },
      "week3": { "focus": string, "problems": string[], "goal": string },
      "week4": { "focus": string, "problems": string[], "goal": string }
    }
  }
}

Return ONLY the JSON object. No markdown, no code fences, no extra text.`;

        // ── Call Gemini API ─────────────────────────────────────────────
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
                topicsCovered: performanceData.topicsCovered,
                weightedScore: performanceData.weightedScore
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
