import { supabase } from '../config/supabase.js';
import cron from 'node-cron';

// Plan configurations (monthly ROI as decimals)
export const PLANS = {
  "Micro Plan": {
    name: "Micro Plan",
    price: 100, // $100
    monthlyROI: 0.04, // 4% monthly (decimal)
    durationMonths: 3, // 3 months
    referralReward: 0.01 // 1%
  },
  "Saver Plan": {
    name: "Saver Plan",
    price: 1000, // $1000
    monthlyROI: 0.045, // 4.5% monthly (decimal)
    durationMonths: 6, // 6 months
    referralReward: 0.02 // 2%
  },
  "Growth Plan": {
    name: "Growth Plan",
    price: 10000, // $10000
    monthlyROI: 0.0515, // 5.15% monthly (decimal)
    durationMonths: 12, // 12 months
    referralReward: 0.03 // 3%
  }
};

// Schedule monthly ROI calculation on 10th of each month at midnight
cron.schedule('0 0 10 * *', async () => {
  console.log('Running monthly ROI calculation...');
  try {
    await calculateMonthlyRoi({}, {
      json: (data) => console.log('ROI Calculation Result:', data)
    });
  } catch (error) {
    console.error('Cron job failed:', error);
  }
});

export const buyPlan = async (req, res) => {
  const { planType } = req.body;
  const userId = req.user.id;

  if (!PLANS[planType]) {
    return res.status(400).json({ error: 'Invalid plan type' });
  }

  const paymentLinks = {
    'Micro Plan': 'https://nowpayments.io/payment/?iid=5058260581',
    'Saver Plan': 'https://nowpayments.io/payment/?iid=4991403138',
    'Growth Plan': 'https://nowpayments.io/payment/?iid=5141947071'
  };

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('roi_earnings, plan_bought, principal_returned')
      .eq('user_id', userId)
      .single();

    if (profileError) throw profileError;

    // Check if user has an active plan
    if (profile.plan_bought) {
      const now = new Date();
      const endDate = new Date(profile.plan_end_date);
      
      // If plan is still active (not expired)
      if (now < endDate) {
        return res.status(400).json({ 
          error: 'You already have an active plan',
          currentPlan: profile.plan_bought
        });
      }
    }

    // If user has completed a plan before (principal was returned)
    if (profile.principal_returned) {
      // Update principal_returned to false in preparation for new plan
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ principal_returned: false })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    }

    return res.json({
      success: true,
      message: 'Redirecting to payment',
      paymentLink: paymentLinks[planType],
      planDetails: {
        ...PLANS[planType],
        monthlyROI: PLANS[planType].monthlyROI * 100,
        formattedMonthlyROI: (PLANS[planType].monthlyROI * 100).toFixed(2) + '%'
      }
    });

  } catch (error) {
    console.error('[BUY PLAN ERROR]', error.message);
    return res.status(500).json({ 
      error: 'Failed to process plan purchase',
      details: error.message 
    });
  }
};


export const confirmPayment = async (req, res) => {
  const IPN_KEY = 'RiAg9A1LNLOACLJMRWIRRWO7TG3MsCpc';
  const receivedKey = req.headers['x-nowpayments-sig'];
  
  if (!receivedKey || receivedKey !== IPN_KEY) {
    return res.status(401).json({ error: 'Invalid IPN key' });
  }

  const { payment_status, planType, userId } = req.body;

  try {
    if (payment_status !== 'finished') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const plan = PLANS[planType];
    if (!plan) throw new Error('Invalid plan');

    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(now.getMonth() + plan.durationMonths);

    // Get current profile to check principal_returned status
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('principal_returned, referred_by')
      .eq('user_id', userId)
      .single();

    // Update profile with new plan details
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan_bought: planType,
        plan_start_date: now.toISOString(),
        plan_end_date: endDate.toISOString(),
        last_roi_calculation: now.toISOString(),
        roi_earnings: 0,
        current_monthly_roi: plan.monthlyROI,
        principal_returned: false, // Always set to false for new plan
        updated_at: now.toISOString()
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Handle referral bonus if applicable
    if (currentProfile?.referred_by) {
      const referralBonus = plan.price * plan.referralReward;
      
      const { error: referralError } = await supabase
        .from('profiles')
        .update({
          referral_earnings: supabase.rpc('increment', {
            column_name: 'referral_earnings',
            amount: referralBonus
          }),
          account_balance: supabase.rpc('increment', {
            column_name: 'account_balance',
            amount: referralBonus
          }),
          no_of_users_referred: supabase.rpc('increment', {
            column_name: 'no_of_users_referred',
            amount: 1
          })
        })
        .eq('user_id', currentProfile.referred_by);

      if (referralError) throw referralError;

      await supabase
        .from('referral_transactions')
        .insert({
          referrer_id: currentProfile.referred_by,
          referred_id: userId,
          amount: referralBonus,
          plan_type: planType,
          created_at: now.toISOString()
        });
    }

    return res.json({ 
      success: true, 
      message: 'Plan activated successfully',
      data: {
        plan_activated: planType,
        plan_amount: plan.price,
        referral_bonus_added: currentProfile?.referred_by ? plan.price * plan.referralReward : 0
      }
    });
  } catch (error) {
    console.error('[PAYMENT CONFIRM ERROR]', error.message);
    return res.status(500).json({ 
      error: 'Failed to confirm payment',
      details: error.message 
    });
  }
};


// Calculate monthly ROI
export const calculateMonthlyRoi = async (req, res) => {
  try {
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        user_id, 
        plan_bought, 
        plan_start_date, 
        plan_end_date, 
        roi_earnings, 
        account_balance, 
        last_roi_calculation, 
        current_monthly_roi,
        principal_returned
      `)
      .not('plan_bought', 'is', null);

    if (usersError) throw usersError;

    const now = new Date();
    const updatePromises = [];

    for (const user of users) {
      const plan = PLANS[user.plan_bought];
      if (!plan) continue;

      const startDate = new Date(user.plan_start_date);
      const endDate = new Date(user.plan_end_date);
      
      // Skip if plan hasn't started or has ended
      if (now < startDate || now > endDate) continue;

      const lastCalcDate = user.last_roi_calculation ? new Date(user.last_roi_calculation) : startDate;
      const monthsPassed = Math.floor((now - lastCalcDate) / (1000 * 60 * 60 * 24 * 30));
      
      if (monthsPassed < 1) continue;

      // Calculate earnings using decimal ROI value
      const monthlyEarnings = plan.price * (user.current_monthly_roi || plan.monthlyROI);
      const totalEarnings = monthlyEarnings * monthsPassed;

      updatePromises.push(
        supabase
          .from('profiles')
          .update({
            roi_earnings: (user.roi_earnings || 0) + totalEarnings,
            account_balance: (user.account_balance || 0) + totalEarnings,
            last_roi_calculation: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('user_id', user.user_id)
      );
    }

    await Promise.all(updatePromises);
    
    const result = { 
      success: true,
      message: `Updated ROI for ${updatePromises.length} users`
    };
    
    if (res) return res.json(result);
    return result;

  } catch (error) {
    console.error('[MONTHLY ROI CALCULATION ERROR]', error);
    const result = { 
      error: 'Monthly ROI calculation failed',
      details: error.message 
    };
    if (res) return res.status(500).json(result);
    throw error;
  }
};

// Get current plan details
// Get current plan details
export const getPlanDetails = async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch profile
    let { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        plan_bought, 
        plan_start_date, 
        plan_end_date, 
        roi_earnings, 
        account_balance,
        current_monthly_roi,
        principal_returned
      `)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    // If no plan, return available options
    if (!profile.plan_bought) {
      return res.json({
        hasPlan: false,
        availablePlans: Object.values(PLANS).map(plan => ({
          name: plan.name,
          price: plan.price,
          durationMonths: plan.durationMonths,
          monthlyROI: parseFloat((plan.monthlyROI * 100).toFixed(2)),
          formattedMonthlyROI: (plan.monthlyROI * 100).toFixed(2) + '%',
          referralReward: (plan.referralReward * 100).toFixed(2) + '%'
        }))
      });
    }

    const plan = PLANS[profile.plan_bought];
    if (!plan) {
      await supabase
        .from('profiles')
        .update({
          plan_bought: null,
          plan_start_date: null,
          plan_end_date: null,
          current_monthly_roi: 0
        })
        .eq('user_id', userId);
      return res.status(400).json({ error: 'Invalid plan reference - reset completed' });
    }

    const now = new Date();
    const endDate = new Date(profile.plan_end_date);
    const isPlanEnded = now > endDate;
    const status = isPlanEnded ? 'completed' : 'active';

    const monthlyROIPercentage = parseFloat(((profile.current_monthly_roi || plan.monthlyROI) * 100).toFixed(2));
    const totalEarned = parseFloat((profile.roi_earnings || 0).toFixed(2));
    const principalAmount = plan.price;

    // If plan ended & principal not returned yet
    if (isPlanEnded && !profile.principal_returned) {
      // Return principal via RPC
      const { error: updateError } = await supabase
        .rpc('complete_plan_and_return_principal', {
          p_user_id: userId,
          p_principal_amount: principalAmount
        });
      if (updateError) throw updateError;

      // Clear plan info and reset ROI
      const { error: clearError } = await supabase
        .from('profiles')
        .update({
          plan_bought: null,
          plan_start_date: null,
          plan_end_date: null,
          current_monthly_roi: 0
        })
        .eq('user_id', userId);
      if (clearError) throw clearError;

      // Refresh profile with updated balance
      const { data: freshProfile, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          plan_bought, 
          plan_start_date, 
          plan_end_date, 
          roi_earnings, 
          account_balance,
          current_monthly_roi,
          principal_returned
        `)
        .eq('user_id', userId)
        .single();

      if (!fetchError && freshProfile) {
        profile = freshProfile;
      }
    }

    const monthsRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24 * 30)));

    return res.json({
      hasPlan: !!profile.plan_bought,
      status,
      currentPlan: profile.plan_bought ? {
        type: profile.plan_bought,
        name: plan.name,
        amount: plan.price,
        startDate: profile.plan_start_date,
        endDate: profile.plan_end_date,
        monthsRemaining,
        monthlyROI: monthlyROIPercentage,
        totalEarned,
        formattedMonthlyROI: monthlyROIPercentage.toFixed(2) + '%',
        principalReturn: principalAmount,
        principalReturned: profile.principal_returned || false
      } : null,
      accountBalance: parseFloat((profile.account_balance || 0).toFixed(2))
    });

  } catch (error) {
    console.error('[GET PLAN ERROR]', error);
    return res.status(500).json({ 
      error: 'Failed to get plan details',
      details: error.message 
    });
  }
};
