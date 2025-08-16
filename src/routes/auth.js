import express from 'express';
import { 
  registerDetails, 
  completeSignup,
  loginWithPasswordAndOTP,
  verifyLoginOTP,
  initiatePasswordReset,
  verifyPasswordResetOTP,
  completePasswordReset
} from '../controllers/auth.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// Registration flow
router.post('/register', registerDetails);
router.post('/verify-otp', completeSignup);

// Login flow
router.post('/login', loginWithPasswordAndOTP); // Step 1: Password + request OTP
router.post('/login/verify', verifyLoginOTP);   // Step 2: Verify OTP

// Password reset flow
router.post('/forgot-password', initiatePasswordReset);       // Step 1: Request OTP
router.post('/forgot-password/verify', verifyPasswordResetOTP); // Step 2: Verify OTP
router.post('/reset-password', completePasswordReset);        // Step 3: Set new password

// Logout
router.post('/logout', async (req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;