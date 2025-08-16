import express from 'express';
import { 
  getUserInfo,
  getAccountBalance,
  getActivePlan,
  getRoiEarnings,
  getKycStatus,
  getReferralInfo,
  updateKycStatus,
  getTotalUsers,
  getAllActivePlans,
  getAllUsersBasicDetails,
  updateUserProfile,
  getUsersProfile,
  getAdminProfile 
} from '../controllers/info.js';

const router = express.Router();
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

// User routes
router.get('/', verifyToken, getUserInfo);
router.get('/account-balance', verifyToken, getAccountBalance);
router.get('/active-plan', verifyToken, getActivePlan);
router.get('/roi-earnings', verifyToken, getRoiEarnings);
router.get('/kyc-status', verifyToken, getKycStatus);
router.get('/referral-info', verifyToken, getReferralInfo);
router.put('/profile', verifyToken, updateUserProfile);
router.get('/profile', verifyToken, getUsersProfile);

// Admin routes
router.put('/update-kyc', verifyToken, verifyAdmin, updateKycStatus);
router.get('/stats/total-users', verifyToken, verifyAdmin, getTotalUsers);
router.get('/stats/active-plans', verifyToken, verifyAdmin, getAllActivePlans);
router.get('/admin/users', verifyToken, verifyAdmin, getAllUsersBasicDetails);
router.get('/admin/profile', verifyToken, verifyAdmin, getAdminProfile);


export default router;