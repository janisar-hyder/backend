import express from 'express'
import { verifyToken } from '../middlewares/auth.js'

const router = express.Router()

// Protected route to get logged-in user's profile
router.get('/', verifyToken, async (req, res) => {
  try {
    res.json({
      message: 'Profile route accessed',
      user: req.user
    })
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' })
  }
})

export default router
