import supabase from '../config/supabase.js'

// Plan configurations (updated to match business logic)
const PLANS = {
  "Plan A": {
    durationMonths: 5,
    roiPercent: 10,  // 10% monthly ROI
    price: 100
  },
  "Plan B": {
    durationMonths: 3,
    roiPercent: 15,  // 15% monthly ROI
    price: 200
  },
  "Plan C": {
    durationMonths: 1,
    roiPercent: 20,  // 20% monthly ROI
    price: 500
  }
}

// Buy a plan (redirects to payment)
export const buyPlan = async (req, res) => {
  const { planType } = req.body
  const userId = req.user.id

  // Validate plan type
  if (!PLANS[planType]) {
    return res.status(400).json({ error: 'Invalid plan type' })
  }

  try {
    // Get user's current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (profileError) throw profileError

    // Check if user already has an active plan
    if (profile.plan_bought) {
      return res.status(400).json({ error: 'You already have an active plan' })
    }

    // Redirect to payment (in a real app, this would be a payment gateway integration)
    const paymentLink = `https://nowpayments.io/checkout?plan=${encodeURIComponent(planType)}&user=${userId}`
    
    return res.json({
      message: 'Redirecting to payment',
      paymentLink,
      planDetails: PLANS[planType]
    })

  } catch (error) {
    console.error('[BUY PLAN ERROR]', error.message)
    return res.status(500).json({ error: 'Failed to process plan purchase' })
  }
}

// Webhook for payment confirmation (called by payment gateway)
export const confirmPayment = async (req, res) => {
  const { userId, planType, amount, transactionId } = req.body

  try {
    // Verify payment with payment gateway (pseudo-code)
    // const paymentValid = await verifyPayment(transactionId)
    // if (!paymentValid) throw new Error('Invalid payment')

    const plan = PLANS[planType]
    if (!plan) throw new Error('Invalid plan')

    // Check minimum investment (now called price)
    if (amount < plan.price) {
      throw new Error(`Minimum investment for ${planType} is $${plan.price}`)
    }

    const now = new Date()
    const endDate = new Date()
    endDate.setMonth(now.getMonth() + plan.durationMonths)

    // Update user profile with new plan
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan_bought: planType,
        plan_start_date: now.toISOString(),
        plan_end_date: endDate.toISOString(),
        last_roi_calculation: now.toISOString(),
        roi_earnings: 0 // Reset ROI on new plan
      })
      .eq('user_id', userId)

    if (updateError) throw updateError

    // If user was referred, update referrer's referral_earnings (optional logic)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('user_id', userId)
      .single()

    if (profileError) throw profileError

    if (profile.referred_by) {
      // Add 1% referral bonus to referrer
      await supabase
        .from('profiles')
        .update({
          referral_earnings: supabase.raw('referral_earnings + ?', [amount * 0.01])
        })
        .eq('user_id', profile.referred_by)
    }

    return res.json({ 
      success: true,
      message: 'Plan activated successfully',
      planDetails: {
        type: planType,
        startDate: now,
        endDate,
        monthlyROI: plan.roiPercent
      }
    })

  } catch (error) {
    console.error('[PAYMENT CONFIRM ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to confirm payment',
      details: error.message
    })
  }
}

// Calculate ROI for all active plans (run monthly via cron job or Supabase scheduled function)
export const calculateRoi = async (req, res) => {
  try {
    // Get all users with active plans
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .not('plan_bought', 'is', null)

    if (usersError) throw usersError

    const now = new Date()
    const updatePromises = []

    for (const user of users) {
      const plan = PLANS[user.plan_bought]
      if (!plan) continue

      const startDate = new Date(user.plan_start_date)
      const endDate = new Date(user.plan_end_date)
      const lastCalcDate = user.last_roi_calculation ? new Date(user.last_roi_calculation) : startDate

      // Skip if plan hasn't started or already ended
      if (now < startDate || now > endDate) continue

      // Calculate full months since last calculation (use date-fns or similar for production)
      const monthsPassed = Math.floor((now.getTime() - lastCalcDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
      if (monthsPassed < 1) continue

      // Calculate ROI
      const roiEarnings = plan.price * (plan.roiPercent / 100) * monthsPassed

      // Prepare update data
      const updateData = {
        roi_earnings: (user.roi_earnings || 0) + roiEarnings,
        last_roi_calculation: now.toISOString()
      }

      // If plan ended, return principal and clear plan
      if (now >= endDate) {
        updateData.account_balance = (user.account_balance || 0) + plan.price
        updateData.plan_bought = null
        updateData.plan_start_date = null
        updateData.plan_end_date = null
      }

      updatePromises.push(
        supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', user.user_id)
      )
    }

    await Promise.all(updatePromises)
    return res.json({ 
      success: true,
      message: `ROI calculated for ${updatePromises.length} users`
    })

  } catch (error) {
    console.error('[ROI CALCULATION ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to calculate ROI',
      details: error.message
    })
  }
}

// Get current plan details
export const getPlanDetails = async (req, res) => {
  const userId = req.user.id

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('plan_bought, plan_start_date, plan_end_date, roi_earnings')
      .eq('user_id', userId)
      .single()

    if (error) throw error

    if (!profile.plan_bought) {
      return res.json({
        hasPlan: false,
        availablePlans: PLANS
      })
    }

    const plan = PLANS[profile.plan_bought]
    const now = new Date()
    const startDate = new Date(profile.plan_start_date)
    const endDate = new Date(profile.plan_end_date)
    const monthsRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24 * 30)))

    return res.json({
      hasPlan: true,
      currentPlan: {
        type: profile.plan_bought,
        startDate: profile.plan_start_date,
        endDate: profile.plan_end_date,
        monthsRemaining,
        monthlyROI: plan.roiPercent,
        totalEarned: profile.roi_earnings || 0,
        principalReturn: monthsRemaining === 0 ? plan.price : 0
      },
      planDetails: plan
    })

  } catch (error) {
    console.error('[GET PLAN ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to get plan details',
      details: error.message
    })
  }
}

// ---
// Supabase schema best practices (for reference):
// Table: profiles
// Columns:
//   user_id (UUID, PK, FK to auth.users)
//   roi_earnings (numeric, default 0)
//   plan_bought (text, nullable)
//   referral_earnings (numeric, default 0)
//   account_balance (numeric, default 0)
//   plan_start_date (timestamp, nullable)
//   plan_end_date (timestamp, nullable)
//   last_roi_calculation (timestamp, nullable)
//   referred_by (UUID, nullable)
// Index: plan_bought
// ---