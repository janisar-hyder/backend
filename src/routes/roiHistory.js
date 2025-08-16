import express from 'express'
import { 
  getRoiHistory,
  getPlanRoiHistory,
  getRoiStats
} from '../controllers/roiHistory.js'
import { verifyToken } from '../middlewares/auth.js'

const router = express.Router()

// Protected routes (require authentication)
router.get('/my-history', verifyToken, getRoiHistory)
router.get('/plan/:planType', verifyToken, getPlanRoiHistory)

// Admin routes (you may want to add admin middleware here)
router.get('/stats', getRoiStats)

export default router 