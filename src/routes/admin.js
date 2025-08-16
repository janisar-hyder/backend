import express from 'express'
import { 
  getAllUsers,
  getWithdrawRequests,
  approveWithdraw,
  declineWithdraw
} from '../controllers/adminUser.js'
import {
  adminLogin,
  verifyAdminOtp
} from '../controllers/adminAuth.js'

const router = express.Router()

// Admin authentication routes
router.post('/login', adminLogin)
router.post('/verify-otp', verifyAdminOtp)

// Admin user management routes
router.get('/users', getAllUsers)
router.get('/withdraws', getWithdrawRequests)
router.post('/withdraws/:id/approve', approveWithdraw)
router.post('/withdraws/:id/decline', declineWithdraw)

export default router 