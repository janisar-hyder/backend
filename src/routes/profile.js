// src/routes/profile.js
import express from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { getProfile } from '../controllers/profileController.js'

const router = express.Router()

// GET /api/profile
router.get('/', verifyToken, getProfile)

export default router
