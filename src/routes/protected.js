// src/routes/protected.js
import express from 'express'
import { authenticate } from '../middlewares/auth.js'

const router = express.Router()

router.get('/profile', authenticate, (req, res) => {
  res.json({ message: 'You are logged in', user: req.user })
})

export default router
