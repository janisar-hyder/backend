import express from 'express';
import { 
  buyPlan,
  confirmPayment,
  calculateMonthlyRoi ,
  getPlanDetails
} from '../controllers/plan.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';
import { nowPaymentsWebhook } from '../controllers/payment.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/buy', verifyToken, buyPlan);
router.get('/my-plan', verifyToken, getPlanDetails);

// Payment webhook (no auth - called by payment processor)
router.post('/confirm-payment', confirmPayment);

// Add webhook endpoint
router.post('/payment/webhook', nowPaymentsWebhook);

// Admin endpoint for ROI calculations
router.get('/calculate-roi', verifyToken, verifyAdmin, calculateMonthlyRoi);

export default router;