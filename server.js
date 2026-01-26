require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Initialize Gemini AI
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables!');
}
const genAI = new GoogleGenerativeAI(API_KEY || "");

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

// --- AUTH MIDDLEWARE (INLINE) ---
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No authorization token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error fetching user profile' 
      });
    }

    req.user = user;
    req.profile = profile;
    req.isAdmin = profile.is_admin || false;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.profile = null;
      req.isAdmin = false;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.user = null;
      req.profile = null;
      req.isAdmin = false;
      return next();
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    req.user = user;
    req.profile = profile;
    req.isAdmin = profile?.is_admin || false;

    next();
  } catch (error) {
    req.user = null;
    req.profile = null;
    req.isAdmin = false;
    next();
  }
};

// --- AUTH ROUTES ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || null
        }
      }
    });

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.json({ 
      success: true, 
      message: 'Account created successfully',
      user: data.user,
      session: data.session
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Signup failed' 
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ 
        success: false, 
        error: error.message 
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({ 
      success: true, 
      message: 'Login successful',
      user: data.user,
      profile: profile,
      session: data.session
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed' 
    });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      await supabase.auth.signOut(token);
    }

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Logout failed' 
    });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    res.json({ 
      success: true, 
      user,
      profile 
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get user' 
    });
  }
});

// --- PROJECT ROUTES ---
app.get('/api/projects', verifyAuth, async (req, res) => {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ 
      success: true, 
      projects 
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch projects' 
    });
  }
});

app.get('/api/projects/:id', verifyAuth, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }

    res.json({ 
      success: true, 
      project 
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch project' 
    });
  }
});

app.post('/api/projects', verifyAuth, async (req, res) => {
  try {
    const { name, description, logo_url, team_size, due_date, tags, priority } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Project name is required' 
      });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: req.user.id,
        name,
        description,
        logo_url,
        team_size: team_size || 1,
        due_date,
        tags: tags || [],
        priority: priority || 'medium'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      project 
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create project' 
    });
  }
});

app.patch('/api/projects/:id', verifyAuth, async (req, res) => {
  try {
    const { name, description, logo_url, progress, team_size, due_date, status, tags, priority } = req.body;

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found or access denied' 
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (progress !== undefined) updates.progress = progress;
    if (team_size !== undefined) updates.team_size = team_size;
    if (due_date !== undefined) updates.due_date = due_date;
    if (status !== undefined) updates.status = status;
    if (tags !== undefined) updates.tags = tags;
    if (priority !== undefined) updates.priority = priority;

    const { data: project, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      project 
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update project' 
    });
  }
});

app.delete('/api/projects/:id', verifyAuth, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found or access denied' 
      });
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ 
      success: true, 
      message: 'Project deleted successfully' 
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete project' 
    });
  }
});

// --- AI ROUTES ---
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

const getModelResponse = async (prompt) => {
  // CRITICAL CHANGE: Using the current latest stable alias for 2026
  const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 2048,
    },
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    geminiConfigured: !!API_KEY,
    supabaseConfigured: !!process.env.SUPABASE_URL
  });
});

app.get('/api/test', async (req, res) => {
  try {
    const text = await getModelResponse('Say "Nexus AI is online!" in a friendly way.');
    res.json({ success: true, message: text });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project-hints', optionalAuth, async (req, res) => {
  try {
    const { project } = req.body;
    if (!project?.name) return res.status(400).json({ success: false, error: 'Project data is required' });

    const prompt = `${NEXUS_SYSTEM_PROMPT}
USER'S PROJECT:
- Name: ${project.name}
- Description: ${project.description || 'No description'}
- Progress: ${project.progress || 0}%
- Team: ${project.team_size || project.team || 1} members

TASK: Provide Smart Insights, Recommended Tech Stack, Next Steps, and Challenges.`;

    const text = await getModelResponse(prompt);
    res.json({ success: true, hints: text });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chat', optionalAuth, async (req, res) => {
  try {
    const { message, project, conversationHistory } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    let context = conversationHistory?.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n') || '';
    let projectContext = project ? `\nCONTEXT: Project ${project.name} is ${project.progress || 0}% done.` : '';

    const fullPrompt = `${NEXUS_SYSTEM_PROMPT}\n${context}${projectContext}\nUSER: ${message}\nNEXUS AI:`;

    const text = await getModelResponse(fullPrompt);
    res.json({ success: true, response: text });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/roadmap', optionalAuth, async (req, res) => {
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
