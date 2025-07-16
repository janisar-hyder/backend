import express from 'express'
import { verifyToken } from '../middlewares/auth.js'
import supabase from '../config/supabase.js'

const router = express.Router()

// GET /api/profile
// Fetch logged-in user's profile
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single()

    if (error) {
      console.error('[PROFILE ERROR]', error.message)
      return res.status(404).json({ error: 'Profile not found' })
    }

    res.json({
      message: 'Profile fetched successfully',
      profile: data
    })
  } catch (err) {
    console.error('[PROFILE ERROR]', err.message)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router
