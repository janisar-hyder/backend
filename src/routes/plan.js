import express from 'express'
import { 
  buyPlan,
  confirmPayment,
  calculateRoi,
  getPlanDetails
} from '../controllers/plan.js'
import { verifyToken } from '../middlewares/auth.js'

const router = express.Router()

// Protected routes (require authentication)
router.post('/buy', verifyToken, buyPlan)
router.get('/my-plan', verifyToken, getPlanDetails)

// Payment webhook (no auth - called by payment processor)
router.post('/confirm-payment', confirmPayment)

// Admin endpoint for ROI calculations (protect this in production!)
router.get('/calculate-roi', calculateRoi)

export default router