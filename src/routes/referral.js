import express from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { getReferralEarnings, getReferralInfo } from '../controllers/referral.js'

const router = express.Router()

router.get('/earnings', verifyToken, getReferralEarnings)
router.get('/info', verifyToken, getReferralInfo)

export default router
