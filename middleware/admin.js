/**
 * Admin-only middleware
 * Must be used AFTER verifyAuth middleware
 * Checks if req.isAdmin is true
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  if (!req.isAdmin) {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required. This action is restricted to administrators.' 
    });
  }

  next();
};

/**
 * Log admin actions to database
 */
const logAdminAction = async (supabase, adminId, action, details = {}) => {
  try {
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: adminId,
        action_type: action,
        details: details,
        ip_address: details.ip || null
      });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

module.exports = { requireAdmin, logAdminAction };