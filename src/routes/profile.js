import express from 'express';
import { 
  startKYC,
  verifyWebhook,
  handleWebhook 
} from '../controllers/profileController.js';

const router = express.Router();

// KYC Flow
router.post('/start-kyc', startKYC); // Redirects to Didit
router.post('/webhook', verifyWebhook, handleWebhook); // Secure webhook

export default router;