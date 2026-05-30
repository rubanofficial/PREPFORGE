# 🤖 AI Performance Analysis Setup Guide

## Overview
The PREPFORGE AI Analysis system uses **Google Gemini AI** to analyze your LeetCode problem-solving patterns and provide intelligent insights about your strengths, weaknesses, and personalized improvement recommendations.

## What It Does
The AI analyzes your problem-solving data to:
- ✅ **Identify Strengths**: Topics and difficulty levels where you excel
- ⚠️ **Highlight Weaknesses**: Areas where you need improvement
- 🎯 **Recommend Focus Areas**: Priority topics based on interview prep best practices
- 📋 **Create Action Plans**: Specific, actionable steps to improve

## Setup Instructions

### 1️⃣ Get Your Gemini API Key

1. Go to [Google AI Studio](https://ai.google.dev/)
2. Click **"Get API Key"** or **"Create API Key"**
3. Select your project (or create a new one)
4. Copy the generated API key

### 2️⃣ Add API Key to `.env`

In `server/.env`, add:
```bash
# ===== GEMINI AI =====
GEMINI_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your actual Gemini API key.

### 3️⃣ Verify Installation

The Gemini package is already installed. Check that it's in `package.json`:
```json
"@google/generative-ai": "latest"
```

If not, run:
```bash
cd server
npm install @google/generative-ai
```

### 4️⃣ Restart Server

```bash
cd server
npm run dev  # or your development command
```

## API Usage

### Endpoint: GET `/api/leetcode/ai-analysis`

**Authentication**: Required (Bearer token)

**Example Request**:
```javascript
const response = await fetch('http://localhost:5000/api/leetcode/ai-analysis', {
    method: 'GET',
    headers: {
        'Authorization': 'Bearer YOUR_JWT_TOKEN',
        'Content-Type': 'application/json'
    }
});
const data = await response.json();
```

**Successful Response** (Status 200):
```json
{
    "success": true,
    "message": "AI analysis completed",
    "data": {
        "analysis": {
            "strengths": [
                "Strong foundation in graph algorithms with 8 problems solved",
                "Excellent difficulty progression - balanced mix of Easy, Medium, and Hard problems"
            ],
            "weaknesses": [
                "Limited coverage of dynamic programming problems (only 2 solved)",
                "No experience with advanced graph problems (topological sort, bridges)"
            ],
            "focusAreas": [
                "Dynamic Programming - critical for interviews",
                "String Manipulation - frequently asked in interviews",
                "Bit Manipulation - important for system design interviews"
            ],
            "actionPlan": [
                "Spend 2 weeks on DP: Start with coin change, knapsack, then advance to LCS and matrix chain",
                "Practice 5-10 string problems: Focus on sliding window and two-pointer techniques",
                "Learn bit manipulation techniques: Practice 3-5 problems on XOR, bit shifting, and masks"
            ]
        },
        "metrics": {
            "totalProblems": 42,
            "difficulty": {
                "easy": 15,
                "medium": 18,
                "hard": 8,
                "unknown": 1
            },
            "topicsCount": 12,
            "languagesUsed": 2
        },
        "timestamp": "2024-01-15T10:30:00.000Z"
    }
}
```

**Error Response** (Status 400):
```json
{
    "success": false,
    "message": "No problems solved yet. Start solving problems to get AI insights!"
}
```

**Error Response** (Status 500):
```json
{
    "success": false,
    "message": "Gemini API key is invalid or expired"
}
```

## Implementation Details

### Data Analysis Flow

```
1. User LeetCode Data (MongoDB)
   ↓
2. Fetch: getUserPerformanceData()
   - Total problems solved
   - Difficulty breakdown (Easy/Medium/Hard)
   - Topic coverage & frequency
   - Programming languages used
   - Recent problem history
   ↓
3. Prepare: Format data into structured summary
   ↓
4. Generate: Call Gemini AI with analysis prompt
   ↓
5. Parse: Extract structured insights (strengths, weaknesses, etc.)
   ↓
6. Return: JSON response with analysis & metrics
```

### AI Prompt Strategy

The system sends Gemini a comprehensive prompt including:
- **User Context**: Total problems, difficulty distribution
- **Topic Coverage**: Frequency of different topic categories
- **Programming Languages**: Which languages they practice
- **Recent Activity**: Last 5 problems solved
- **Analysis Request**: Generate strengths, weaknesses, focus areas, action plan

### Response Parsing

The AI response is parsed into 4 sections:
- **STRENGTHS**: Extract bullet points about strong areas
- **WEAKNESSES**: Extract bullet points about areas to improve
- **FOCUS AREAS**: Extract recommended topics/difficulties
- **ACTION PLAN**: Extract specific improvement steps

## Usage Examples

### Frontend Integration (React)

```jsx
import { getPerformanceAnalysis } from '../services/aiAnalysisService.js';
import { useState } from 'react';

function AIAnalysisPage() {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getPerformanceAnalysis();
            setAnalysis(data.data.analysis);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>🤖 Analyzing your performance...</div>;
    if (error) return <div>❌ Error: {error}</div>;

    return (
        <div>
            <button onClick={handleAnalyze}>Get AI Analysis</button>
            {analysis && (
                <div>
                    <h2>✅ Strengths</h2>
                    <ul>
                        {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                    
                    <h2>⚠️ Weaknesses</h2>
                    <ul>
                        {analysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                    
                    <h2>🎯 Focus Areas</h2>
                    <ul>
                        {analysis.focusAreas.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                    
                    <h2>📋 Action Plan</h2>
                    <ol>
                        {analysis.actionPlan.map((a, i) => <li key={i}>{a}</li>)}
                    </ol>
                </div>
            )}
        </div>
    );
}

export default AIAnalysisPage;
```

### Server-Side Usage

```javascript
import { analyzeUserPerformance } from './services/geminiAnalysisService.js';

// In your controller
const userId = req.user.userId;
const analysis = await analyzeUserPerformance(userId);

if (analysis.success) {
    console.log('Strengths:', analysis.analysis.strengths);
    console.log('Action Plan:', analysis.analysis.actionPlan);
}
```

## Cost & Rate Limits

### Pricing
- **Gemini 1.5 Flash**: Free tier available (monthly quota)
- Check [Google AI Pricing](https://ai.google.dev/pricing) for details
- Monitor API usage in Google AI Studio dashboard

### Rate Limits
- Default: 60 requests/minute (free tier)
- Adjust in [Google Cloud Console](https://console.cloud.google.com/) if needed

### Best Practices
1. ✅ Cache analysis results (re-analyze every 7-30 days)
2. ✅ Implement rate limiting on your server
3. ✅ Handle API failures gracefully
4. ✅ Monitor API quota usage

## Troubleshooting

### Issue: "Gemini API key not configured"
**Solution**: Add `GEMINI_API_KEY` to `.env` file and restart server

### Issue: "No problems solved yet"
**Solution**: Sync LeetCode problems first via `/api/leetcode/sync-problems` endpoint

### Issue: "API key is invalid or expired"
**Solution**: 
1. Check that key is correct in `.env`
2. Verify key hasn't expired in Google AI Studio
3. Generate a new key if needed

### Issue: "Rate limit exceeded"
**Solution**:
1. Check request frequency
2. Add caching to avoid repeated analyses
3. Implement exponential backoff retry logic

## Advanced Features (Future)

Potential enhancements:
- 📊 **Historical Analysis**: Track improvement over time
- 🎓 **Learning Paths**: AI-generated curriculum
- 👥 **Peer Comparison**: Anonymous benchmarking
- 📱 **Notifications**: Alerts for recommended focus areas
- 🔄 **Re-analysis**: Periodic updates with progress

## Files Modified/Created

- ✅ `server/src/services/geminiAnalysisService.js` - AI analysis logic
- ✅ `server/src/controllers/leetcodeController.js` - Analysis endpoint
- ✅ `server/src/routes/leetcodeRoutes.js` - Route registration
- ✅ `server/.env` - Added GEMINI_API_KEY variable
- ✅ `client/src/services/aiAnalysisService.js` - Frontend service
- ✅ `.env.example` - Documentation template

## Security Notes

⚠️ **IMPORTANT**:
- Never commit API keys to git
- Use `.env` files (add to `.gitignore`)
- Rotate keys periodically
- Use environment variables in production
- Monitor API key usage for unauthorized access

## Support & Resources

- [Google AI Studio](https://ai.google.dev/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Google AI Cookbook](https://github.com/google/generative-ai-python)
- PREPFORGE Issues: Report problems in repository

---

**Last Updated**: January 2024  
**Status**: ✅ Production Ready
