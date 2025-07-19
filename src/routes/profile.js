// src/routes/profile.js
import express from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { getProfile, startKyc, handleKycWebhook } from '../controllers/profileController.js'

const router = express.Router()

// GET /api/profile
router.get('/', verifyToken, getProfile)

// POST /api/profile/kyc/start
router.post('/kyc/start', verifyToken, startKyc)

// POST /api/profile/kyc/webhook
router.post('/kyc/webhook', handleKycWebhook)

export default router
