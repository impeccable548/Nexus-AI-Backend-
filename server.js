require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini AI
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables!');
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

// System prompt
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
- Be encouraging but honest about challenges

When analyzing projects, consider: project type, progress, team size, timeline, and user's specific goals.`;

// Get Gemini model
const getModel = () => {
  return genAI.getGenerativeModel({ 
    model: "gemini-pro",
    generationConfig: {
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
    const model = getModel();
    const result = await model.generateContent('Say "Nexus AI is online!" in a friendly way.');
    const response = await result.response;
    res.json({ 
      success: true, 
      message: response.text() 
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
      return res.status(400).json({ 
        success: false, 
        error: 'Project data is required' 
      });
    }

    const prompt = `${NEXUS_SYSTEM_PROMPT}

USER'S PROJECT:
- Name: ${project.name}
- Description: ${project.description || 'No description provided'}
- Progress: ${project.progress}%
- Team Size: ${project.team} members
- Deadline: ${project.due}
- Status: ${project.status}

TASK: As Nexus AI, analyze this project and provide:
1. **Smart Insights** - 5-7 specific, actionable hints for THIS project (not generic advice)
2. **Recommended Tech Stack** - Suggest specific tools/frameworks if relevant
3. **Next Steps** - Based on ${project.progress}% progress, what should they do NOW?
4. **Potential Challenges** - What to watch out for

Be specific to THIS project. Use markdown formatting. Be encouraging but practical.`;

    console.log('🤖 Generating project hints for:', project.name);
    const model = getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Generated hints');
    res.json({ 
      success: true, 
      hints: text 
    });

  } catch (error) {
    console.error('❌ Project hints error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Chat with AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, project, conversationHistory } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    // Build context
    let contextMessages = '';
    if (conversationHistory && conversationHistory.length > 0) {
      contextMessages = conversationHistory.slice(-5).map(msg => 
        `${msg.role === 'user' ? 'User' : 'Nexus AI'}: ${msg.content}`
      ).join('\n');
    }
    
    let projectContext = '';
    if (project) {
      projectContext = `\n\nCURRENT PROJECT CONTEXT:
- Name: ${project.name}
- Description: ${project.description || 'Not specified'}
- Progress: ${project.progress}%
- Team: ${project.team} members
- Deadline: ${project.due}`;
    }
    
    const prompt = `${NEXUS_SYSTEM_PROMPT}

CONVERSATION HISTORY:
${contextMessages}
${projectContext}

USER MESSAGE: ${message}

RESPOND AS NEXUS AI: Be helpful, specific, and actionable. If discussing the project, reference the context above. Keep it conversational and under 200 words unless more detail is requested. Use markdown formatting.`;

    console.log('🤖 Processing chat message');
    const model = getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Chat response generated');
    res.json({ 
      success: true, 
      response: text 
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Generate roadmap
app.post('/api/roadmap', async (req, res) => {
  try {
    const { project } = req.body;
    
    if (!project || !project.name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Project data is required' 
      });
    }

    const prompt = `${NEXUS_SYSTEM_PROMPT}

PROJECT: ${project.name}
DESCRIPTION: ${project.description || 'Not specified'}
CURRENT PROGRESS: ${project.progress}%

TASK: As Nexus AI, create a detailed project roadmap with 5 phases. For each phase include:
- Phase name
- Key tasks (3-5 specific tasks)
- Estimated duration
- Success criteria

Format using markdown. Be specific to this project type.`;

    console.log('🤖 Generating roadmap for:', project.name);
    const model = getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Roadmap generated');
    res.json({ 
      success: true, 
      roadmap: text 
    });

  } catch (error) {
    console.error('❌ Roadmap error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Nexus AI Backend running on port ${PORT}`);
  console.log(`🤖 Gemini API configured: ${!!API_KEY}`);
  console.log(`🌍 Allowed origins:`, allowedOrigins);
});