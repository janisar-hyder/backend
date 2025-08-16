import express from 'express';
import { 
  createWithdrawal,
  getAdminWithdrawals,
  getUserWithdrawals,
  updateWithdrawalStatus,
  getWithdrawalById
} from '../controllers/withdraw.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Apply token verification to all withdrawal routes
router.use(verifyToken);

// User-specific routes
router.route('/')
  .post(
    // Create new withdrawal
    createWithdrawal
  )
  .get(
    // Get current user's withdrawals (with optional query params)
    getUserWithdrawals
  );

// Admin management routes
router.route('/admin')
  .get(
    verifyAdmin,
    // Get all withdrawals with filtering capabilities
    getAdminWithdrawals
  );

// Withdrawal-specific operations
router.route('/:id')
  .get(
    // Get specific withdrawal details (user can see their own, admin can see any)
    getWithdrawalById
  );

router.route('/:id/status')
  .put(
    verifyAdmin,
    // Admin-only status updates (approve/reject)
    updateWithdrawalStatus
  );

export default router;