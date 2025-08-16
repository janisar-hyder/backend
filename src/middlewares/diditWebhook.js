import crypto from 'crypto';

const verifyWebhook = (req, res, next) => {
  const receivedSig = req.headers['x-didit-signature'];
  
  if (!process.env.DIDIT_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const computedSig = crypto
    .createHmac('sha256', process.env.DIDIT_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (receivedSig !== computedSig) {
    console.warn('Invalid webhook signature:', {
      received: receivedSig,
      computed: computedSig
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
};

export default verifyWebhook;