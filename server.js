require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Initialize Gemini AI
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables!');
}
const genAI = new GoogleGenerativeAI(API_KEY || "");

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// --- FULL SYSTEM PROMPT ---
const NEXUS_SYSTEM_PROMPT = `You are Nexus AI, an intelligent project management assistant built to help users plan and execute their projects successfully.

PERSONALITY:
- Friendly, encouraging, and professional
- Give actionable, specific advice (not generic tips)
- Be concise but thorough
- Focus on practical solutions

YOUR ROLE:
- Analyze project details and provide smart, personalized hints
- Suggest tech stacks and tools based on project type
- Create roadmaps and timelines
- Help with problem-solving and decision-making
- Offer team management and productivity tips

IMPORTANT RULES:
- NEVER say "I'm Gemini" or mention Google - you are NEXUS AI
- Give SPECIFIC advice with examples, not generic tips
- Keep responses under 300 words unless asked for more detail
- Use markdown formatting (##, **, bullet points)
- Be encouraging but honest about challenges.`;

// 🤖 Production Stable Model Helper
const getModelResponse = async (prompt) => {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 2048,
    },
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};

// --- ROUTES ---

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    geminiConfigured: !!API_KEY,
    supabaseConfigured: !!process.env.SUPABASE_URL
  });
});

// 2. Test Gemini connection
app.get('/api/test', async (req, res) => {
  try {
    const text = await getModelResponse('Say "Nexus AI is online!" in a friendly way.');
    res.json({ success: true, message: text });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Generate project hints
app.post('/api/project-hints', async (req, res) => {
  try {
    const { project } = req.body;
    if (!project?.name) return res.status(400).json({ success: false, error: 'Project data is required' });

    const prompt = `${NEXUS_SYSTEM_PROMPT}
USER'S PROJECT:
- Name: ${project.name}
- Description: ${project.description || 'No description'}
- Progress: ${project.progress}%
- Team: ${project.team} members

TASK: Provide Smart Insights, Recommended Tech Stack, Next Steps, and Challenges.`;

    const text = await getModelResponse(prompt);
    res.json({ success: true, hints: text });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Chat with AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, project, conversationHistory } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    let context = conversationHistory?.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n') || '';
    let projectContext = project ? `\nCONTEXT: Project ${project.name} is ${project.progress}% done.` : '';

    const fullPrompt = `${NEXUS_SYSTEM_PROMPT}\n${context}${projectContext}\nUSER: ${message}\nNEXUS AI:`;

    const text = await getModelResponse(fullPrompt);
    res.json({ success: true, response: text });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Generate roadmap
app.post('/api/roadmap', async (req, res) => {
  try {
    const { project } = req.body;
    if (!project?.name) return res.status(400).json({ success: false, error: 'Project data is required' });

    const prompt = `${NEXUS_SYSTEM_PROMPT}\nCreate a 5-phase roadmap for: ${project.name}. Description: ${project.description}`;
    const text = await getModelResponse(prompt);
    res.json({ success: true, roadmap: text });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export for Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Nexus Backend running on http://localhost:${PORT}`);
    console.log(`🤖 Gemini AI: ${API_KEY ? '✅' : '❌'}`);
    console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  });
}

module.exports = app;