import express from 'express';

// POST /api/payment/webhook
export const nowPaymentsWebhook = async (req, res) => {
  // NOWPayments sends payment info in req.body
  const paymentData = req.body;
  // TODO: Add your payment verification and processing logic here
  console.log('NOWPayments Webhook received:', paymentData);

  // Respond with 200 OK to acknowledge receipt
  res.status(200).json({ success: true });
}; 