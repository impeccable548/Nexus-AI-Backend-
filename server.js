require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found!');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(API_KEY);

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

const NEXUS_SYSTEM_PROMPT = `You are Nexus AI, an intelligent project management assistant... (Keep your full prompt here)`;

// MODEL FIX
const getModel = () => {
  return genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", 
    generationConfig: {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });
};

// --- ALL YOUR ROUTES ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Nexus AI Backend is running', geminiConfigured: !!API_KEY });
});

app.get('/api/test', async (req, res) => {
  try {
    const model = getModel();
    const result = await model.generateContent('Say "Nexus AI is online!"');
    const response = await result.response;
    res.json({ success: True, message: response.text() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project-hints', async (req, res) => {
  try {
    const { project } = req.body;
    if (!project || !project.name) return res.status(400).json({ error: 'Project data required' });
    const prompt = `${NEXUS_SYSTEM_PROMPT}\n\nUSER'S PROJECT: ${project.name}...`;
    const model = getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ success: true, hints: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, project, conversationHistory } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const model = getModel();
    const result = await model.generateContent(message); // You can add your full context logic back here
    const response = await result.response;
    res.json({ success: true, response: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/roadmap', async (req, res) => {
  try {
    const { project } = req.body;
    const model = getModel();
    const result = await model.generateContent(`Create a roadmap for ${project.name}`);
    const response = await result.response;
    res.json({ success: true, roadmap: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IMPORTANT FOR VERCEL
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`✅ Local server on ${PORT}`));
}

module.exports = app; // Matches your vercel.json "dest"
