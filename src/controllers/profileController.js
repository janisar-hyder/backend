import axios from 'axios';
import crypto from 'crypto';
import { supabase } from '../config/supabase.js';

export const startKYC = async (req, res) => {
  try {
    const { user_id, email } = req.body;
    
    // Create verification session with Didit
    const response = await axios.post(
      'https://verification.didit.me/v2/session/',
      {
        workflow_id: process.env.DIDIT_WORKFLOW_ID,
        reference_id: user_id,
        user_email: email
      },
      {
        headers: {
          'x-api-key': process.env.DIDIT_API_KEY,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        }
      }
    );

    // Return the full response from Didit
    return res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('KYC Error:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'kyc_failed',
      message: error.message || 'Failed to start KYC process',
      details: error.response?.data || null
    });
  }
};

// Webhook verification remains the same
export const verifyWebhook = (req, res, next) => {
  const signature = req.headers['x-didit-signature'];
  const hmac = crypto.createHmac('sha256', process.env.DIDIT_WEBHOOK_SECRET);
  const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
  
  if (signature !== digest) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
};

export const handleWebhook = async (req, res) => {
  try {
    console.log('Webhook Received:', req.body);
    
    // Extract relevant data from webhook
    const { session_id, status, reference_id } = req.body;
    
    // Update user in database based on status
    // This is pseudo-code - adjust to your actual DB implementation
    const user = await User.findOneAndUpdate(
      { user_id: reference_id },
      { 
        user_verified: status === 'approved',
        verification_status: status.toLowerCase() // 'approved', 'rejected', etc.
      },
      { new: true }
    );
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};