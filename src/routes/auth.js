import express from 'express'
import {
  registerDetails,
  verifyRegisterOtp,
  loginDetails,
  verifyLoginOtp
} from '../controllers/auth.js'

const router = express.Router()

router.post('/register-details', registerDetails)
router.post('/register-verify', verifyRegisterOtp)

router.post('/login', loginDetails)
router.post('/login-verify', verifyLoginOtp)

export default router
