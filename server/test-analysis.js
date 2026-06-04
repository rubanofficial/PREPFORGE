import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { analyzeUserPerformance, getUserPerformanceData } from './src/services/geminiAnalysisService.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
}

const userSchema = new mongoose.Schema({
    email: String,
    username: String
});
const User = mongoose.model('User', userSchema);

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        const user = await User.findOne({ email: 'rubans082005@gmail.com' });
        if (!user) {
            console.error('User not found');
            process.exit(1);
        }

        console.log(`User found: ${user.username} (${user._id})`);

        console.log('1. Fetching performance data...');
        const startTime = Date.now();
        const data = await getUserPerformanceData(user._id);
        const dataTime = Date.now() - startTime;
        console.log(`Fetched data in ${dataTime}ms`);
        if (!data) {
            console.log('No data found for user');
            return;
        }
        console.log(`Total solved: ${data.totalSolved}`);
        console.log(`Solved slugs sample: ${data.solvedProblemSlugs.slice(0, 5).join(', ')}`);

        console.log('2. Running analysis...');
        const analysisStartTime = Date.now();
        const analysis = await analyzeUserPerformance(user._id);
        const analysisTime = Date.now() - analysisStartTime;
        console.log(`Analysis complete in ${analysisTime}ms`);
        
        console.log('Result success:', analysis.success);
        if (analysis.success) {
            console.log('Analysis result:', JSON.stringify(analysis.analysis, null, 2).substring(0, 500) + '...');
        } else {
            console.log('Analysis error message:', analysis.message);
        }

    } catch (err) {
        console.error('Error occurred:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
