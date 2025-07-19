import express from 'express';
import { adminLogin, verifyAdminOtp } from '../controllers/adminAuth.js';
import { getAllUsers, getWithdrawRequests, approveWithdraw, declineWithdraw } from '../controllers/adminUser.js';
const router = express.Router();

router.post('/login', adminLogin);
router.post('/verify-otp', verifyAdminOtp);
router.get('/users', getAllUsers);
router.get('/withdraws', getWithdrawRequests);
router.post('/withdraws/:id/approve', approveWithdraw);
router.post('/withdraws/:id/decline', declineWithdraw);

export default router; 