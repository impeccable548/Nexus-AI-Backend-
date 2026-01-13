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

const NEXUS_SYSTEM_PROMPT = `You are Nexus AI... (rest of your prompt)`;

// MODEL FIX: Changed to gemini-1.5-flash
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

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', geminiConfigured: !!API_KEY });
});

app.get('/api/test', async (req, res) => {
  try {
    const model = getModel();
    const result = await model.generateContent('Say "Nexus AI is online!"');
    const response = await result.response;
    res.json({ success: true, message: response.text() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const model = getModel();
    const result = await model.generateContent(message);
    const response = await result.response;
    res.json({ success: true, response: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IMPORTANT: Only listen if not running as a Vercel Function
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Local server on port ${PORT}`);
  });
}

// THIS IS THE KEY FOR YOUR VERCEL.JSON
module.exports = app;
