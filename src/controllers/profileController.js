// src/controllers/profileControllers.js
import supabase from '../config/supabase.js'

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id // This comes from JWT middleware

    // Fetch user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[GET PROFILE ERROR]', error.message)
      return res.status(404).json({ error: 'Profile not found' })
    }

    // Fetch users referred by this user
    const { data: referredUsers, error: referredError } = await supabase
      .from('profiles')
      .select('user_id, email, firstname, lastname, plan_bought')
      .eq('referred_by', userId)

    // Prepare plan details
    const planDetails = profile.plan_bought ? {
      plan_bought: profile.plan_bought,
      plan_start_date: profile.plan_start_date,
      plan_end_date: profile.plan_end_date,
      roi_earnings: profile.roi_earnings,
      account_balance: profile.account_balance
    } : null

    // Prepare referral info
    const referralInfo = {
      referral_code: profile.referral_code,
      referred_by: profile.referred_by,
      referral_earnings: profile.referral_earnings,
      referred_users: referredUsers || []
    }

    res.json({
      message: 'Profile fetched successfully',
      profile: {
        ...profile,
        plan_details: planDetails,
        referral_info: referralInfo
      }
    })
  } catch (err) {
    console.error('[PROFILE ERROR]', err.message)
    res.status(500).json({ error: 'Something went wrong' })
  }
}

// Start KYC process: redirect user to Sumsub dashboard
export const startKyc = async (req, res) => {
  try {
    const userId = req.user.id;
    // Generate a Sumsub access token for this user (pseudo-code, replace with real API call)
    // You should use your Sumsub SDK or REST API here
    const sumsubToken = 'GENERATED_SUMSUB_TOKEN';
    const sumsubDashboardUrl = `https://app.sumsub.com/idensic/mobile-sdk/?accessToken=${sumsubToken}`;
    res.json({
      message: 'Redirect to Sumsub KYC dashboard',
      url: sumsubDashboardUrl
    });
  } catch (err) {
    console.error('[KYC START ERROR]', err.message);
    res.status(500).json({ error: 'Failed to start KYC process' });
  }
};

// Webhook endpoint for Sumsub to notify KYC completion
export const handleKycWebhook = async (req, res) => {
  try {
    // Sumsub will send userId and KYC status in the webhook payload
    const { userId, reviewResult } = req.body;
    if (reviewResult && reviewResult.reviewAnswer === 'GREEN') {
      // KYC is verified
      const { error } = await supabase
        .from('profiles')
        .update({ kyc: true })
        .eq('user_id', userId);
      if (error) throw error;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[KYC WEBHOOK ERROR]', err.message);
    res.status(500).json({ error: 'Failed to process KYC webhook' });
  }
};
