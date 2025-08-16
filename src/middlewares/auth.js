// middleware/auth.js
import { supabase } from '../config/supabase.js'

/**
 * Unified authentication middleware for Supabase users and admins
 */
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    console.log('Token received:', token ? 'exists' : 'missing')

    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' })
    }

    // 1. Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Supabase auth error:', authError?.message)
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const userId = user.id
    const userEmail = user.email
    console.log('Supabase auth user:', userId, userEmail)

    // 2. Check in admins table first (since admins are privileged)
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, email, role, created_at')
      .eq('id', userId)
      .single()

    if (admin) {
      req.user = {
        id: admin.id, // Using admin's 'id' field
        user_id: admin.id, // Also include as user_id for consistency
        email: admin.email,
        role: admin.role || 'admin',
        isAdmin: true,
        created_at: admin.created_at,
        access_token: token
      }
      console.log('Authenticated as admin:', req.user.email)
      return next()
    }

    if (adminError && adminError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Admin lookup error:', adminError.message)
    }

    // 3. Check in user profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, role, firstname, lastname')
      .eq('user_id', userId)
      .single()

    if (!profile || profileError) {
      console.error('Profile not found in either table for id:', userId)
      return res.status(403).json({
        error: 'Complete your registration',
        details: 'Account not fully setup in our system'
      })
    }

    req.user = {
      id: profile.user_id, // Using profile's 'user_id' as id
      user_id: profile.user_id, // Explicit user_id
      email: profile.email,
      role: profile.role || 'user',
      isAdmin: false,
      firstname: profile.firstname,
      lastname: profile.lastname,
      access_token: token
    }

    console.log('Authenticated as user:', req.user.email)
    next()
  } catch (err) {
    console.error('Auth middleware exception:', err)
    res.status(500).json({ error: 'Internal server error during authentication' })
  }
}

/**
 * Admin-only access guard (enhanced version)
 */
export const verifyAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    console.warn('Admin access denied for:', {
      attempted_by: req.user?.email || 'unknown',
      role: req.user?.role || 'unauthenticated',
      path: req.path,
      method: req.method
    })
    
    return res.status(403).json({
      error: 'Admin access required',
      details: {
        required: 'admin',
        your_role: req.user?.role || 'unauthenticated'
      },
      solution: 'Contact your system administrator'
    })
  }
  
  // Additional admin validation if needed
  if (!req.user.id) {
    console.error('Admin validation failed - missing id:', req.user)
    return res.status(403).json({ error: 'Invalid admin credentials' })
  }

  next()
}

/**
 * Auth error handler (enhanced version)
 */
export const handleAuthErrors = (err, req, res, next) => {
  // Log detailed error information
  console.error('[AUTH MIDDLEWARE ERROR]', {
    error: err,
    path: req.path,
    method: req.method,
    user: req.user?.email || 'unauthenticated'
  })

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      solution: 'Get a new token by logging in again'
    })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      solution: 'Refresh your token or log in again'
    })
  }

  // Handle Supabase-specific errors
  if (err.code && err.code.startsWith('PGRST')) {
    return res.status(500).json({
      error: 'Database error during authentication',
      code: err.code,
      report_to: 'support@yourdomain.com'
    })
  }

  res.status(500).json({
    error: 'Authentication system error',
    report_to: 'support@yourdomain.com'
  })
}

/**
 * New middleware to verify chat access
 */
export const verifyChatAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // For admin endpoints
    if (req.path.startsWith('/admin') && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // For user-specific endpoints
    if (req.params.userId && req.params.userId !== req.user.user_id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized access to this conversation' })
    }

    next()
  } catch (err) {
    console.error('Chat access verification error:', err)
    res.status(500).json({ error: 'Internal server error during access verification' })
  }
}