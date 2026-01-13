require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI with explicit versioning
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  process.exit(1);
}

// Research update: Using the v1beta endpoint via the SDK options
// This bypasses the 404 seen on the standard v1 route
const genAI = new GoogleGenerativeAI(API_KEY);

app.use(cors()); // Simplified for testing; you can add your whitelist back later
app.use(express.json());

const NEXUS_SYSTEM_PROMPT = `You are Nexus AI...`;

// Updated getModel to use the latest stable flash model
const getModel = () => {
  // We pass 'v1beta' as the second argument to the SDK's getGenerativeModel
  return genAI.getGenerativeModel(
    { model: "gemini-1.5-flash" },
    { apiVersion: 'v1beta' } 
  );
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Nexus AI Backend is running' });
});

app.get('/api/test', async (req, res) => {
  try {
    const model = getModel();
    const result = await model.generateContent('Say "Nexus AI is online!"');
    const response = await result.response;
    res.json({ success: true, message: response.text() });
  } catch (error) {
    console.error('Gemini Test Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Original logic for chat/hints
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

// Vercel deployment logic
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`✅ Local server on ${PORT}`));
}

module.exports = app;
