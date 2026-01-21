const express = require('express');
const { supabase } = require('../middleware/auth');
const { verifyAuth } = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(verifyAuth);

/**
 * GET /api/projects
 * Get all projects for current user
 */
router.get('/', async (req, res) => {
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

/**
 * GET /api/projects/:id
 * Get single project by ID
 */
router.get('/:id', async (req, res) => {
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

/**
 * POST /api/projects
 * Create new project
 */
router.post('/', async (req, res) => {
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

/**
 * PATCH /api/projects/:id
 * Update project
 */
router.patch('/:id', async (req, res) => {
  try {
    const { name, description, logo_url, progress, team_size, due_date, status, tags, priority } = req.body;

    // Verify ownership
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

/**
 * DELETE /api/projects/:id
 * Delete project
 */
router.delete('/:id', async (req, res) => {
  try {
    // Verify ownership
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

module.exports = router;