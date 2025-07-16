import express from 'express'
import {
  registerUser,
  verifyRegisterOtp,
  loginUser,
  verifyLoginOtp
} from '../controllers/auth.js'

const router = express.Router()

// Step 1: Register details and send OTP
router.post('/register-details', registerUser)

// Step 2: Verify OTP and complete registration
router.post('/register-verify', verifyRegisterOtp)

// Step 3: Login details and send OTP
router.post('/login', loginUser)

// Step 4: Verify OTP and complete login
router.post('/login-verify', verifyLoginOtp)

export default router
