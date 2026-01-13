require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
// Updated to the newer GenAI SDK for better compatibility
const { GoogleGenAI } = require('@google/genai'); 

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables!');
  process.exit(1);
}

// Using the new SDK structure
const ai = new GoogleGenAI({ apiKey: API_KEY });

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

// System prompt (Kept exactly as you had it)
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

// 🤖 UPDATED: Using Gemini 2.5 Flash
const getModelResponse = async (prompt) => {
  return await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: prompt,
    config: {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Nexus AI Backend is running',
    geminiConfigured: !!API_KEY 
  });
});

// Test Gemini connection
app.get('/api/test', async (req, res) => {
  try {
    const result = await getModelResponse('Say "Nexus AI is online!" in a friendly way.');
    res.json({ 
      success: true, 
      message: result.text
    });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate project hints
app.post('/api/project-hints', async (req, res) => {
  try {
    const { project } = req.body;
    if (!project || !project.name) {
      return res.status(400).json({ success: false, error: 'Project data is required' });
    }

    const prompt = `${NEXUS_SYSTEM_PROMPT}\n\nUSER'S PROJECT:\n- Name: ${project.name}\n- Description: ${project.description || 'No description provided'}\n- Progress: ${project.progress}%\n- Team Size: ${project.team} members\n- Deadline: ${project.due}\n- Status: ${project.status}\n\nTASK: As Nexus AI, provide insights, tech stack, next steps, and challenges.`;

    const result = await getModelResponse(prompt);
    res.json({ success: true, hints: result.text });
  } catch (error) {
    console.error('❌ Project hints error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat with AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, project, conversationHistory } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    let context = conversationHistory?.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n') || '';
    let projectContext = project ? `\nPROJECT: ${project.name} (${project.progress}% done)` : '';

    const fullPrompt = `${NEXUS_SYSTEM_PROMPT}\n${context}${projectContext}\nUSER: ${message}`;
    const result = await getModelResponse(fullPrompt);

    res.json({ success: true, response: result.text });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate roadmap
app.post('/api/roadmap', async (req, res) => {
  try {
    const { project } = req.body;
    if (!project || !project.name) return res.status(400).json({ success: false, error: 'Project data is required' });

    const prompt = `${NEXUS_SYSTEM_PROMPT}\n\nCreate a 5-phase roadmap for: ${project.name}. Description: ${project.description}`;
    const result = await getModelResponse(prompt);

    res.json({ success: true, roadmap: result.text });
  } catch (error) {
    console.error('❌ Roadmap error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Nexus AI Backend running on port ${PORT}`);
});
