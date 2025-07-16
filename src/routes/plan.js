// routes/plan.js
import express from 'express'
import { verifyToken } from '../middlewares/auth.js'
import {
  buyPlan,
  getUserROI,
  updateMonthlyROI,
  getROIHistory
} from '../controllers/plan.js'

const router = express.Router()

router.post('/buy', verifyToken, buyPlan)
router.get('/roi', verifyToken, getUserROI)
router.post('/roi/update', updateMonthlyROI) // Will be scheduled
router.get('/roi/history', verifyToken, getROIHistory)


export default router
