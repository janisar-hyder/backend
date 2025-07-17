// src/controllers/plan.js
import supabase from '../config/supabase.js'

const plans = {
  PlanA: { cost: 500, months: 5, roi: 5 },
  PlanB: { cost: 700, months: 7, roi: 6 },
  PlanC: { cost: 900, months: 9, roi: 7 }
}

export const buyPlan = async (req, res) => {
  const { planType } = req.body;
  const selectedPlan = plans[planType];

  if (!selectedPlan) {
    return res.status(400).json({ error: 'Invalid plan type' });
  }

  const userId = req.user.id;
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(now.getMonth() + selectedPlan.months);

  // 1. Insert into user_roi table
  const { error: roiError, data: roiData } = await supabase
    .from('user_roi')
    .insert({
      user_id: userId,
      plan_type: planType,
      cost: selectedPlan.cost,
      months: selectedPlan.months,
      roi_percent: selectedPlan.roi,
      start_date: now.toISOString(),
      end_date: endDate.toISOString()
    })
    .select()
    .single();

  if (roiError) {
    console.error('[ROI INSERT ERROR]', roiError);
    return res.status(500).json({ error: 'Failed to save plan purchase' });
  }

  // 2. Insert initial ROI history with 0 amount
  const { error: roiHistoryError } = await supabase
    .from('roi_history')
    .insert({
      user_id: userId,
      plan_id: roiData?.id,
      amount: 0,
      date: now.toISOString()
    });

  if (roiHistoryError) {
    console.error('[ROI HISTORY INSERT ERROR]', roiHistoryError);
    // Do not return here, just log the error
  }

  return res.json({ message: 'Plan purchased successfully' });
};





export const updateMonthlyROI = async (req, res) => {
  try {
    const now = new Date()

    const { data: activePlans, error } = await supabase
      .from('user_roi')
      .select('*')
      .lte('start_date', now.toISOString())
      .gte('end_date', now.toISOString())

    if (error) {
      console.error('[ROI FETCH ERROR]', error.message)
      return res.status(500).json({ error: 'Failed to fetch ROI plans' })
    }

    for (const plan of activePlans) {
      const { user_id, roi_percent, cost, id: plan_id } = plan
      const roiAmount = (cost * roi_percent) / 100

      // Step 1: Get last ROI earning for this user and plan
      const { data: lastEarning, error: fetchEarningErr } = await supabase
        .from('roi_earnings')
        .select('date')
        .eq('user_id', user_id)
        .eq('plan_id', plan_id)
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (fetchEarningErr && fetchEarningErr.code !== 'PGRST116') {
        // If error is not 'no rows found'
        console.error('[EARNING FETCH ERROR]', fetchEarningErr.message)
        continue
      }

      const canUpdate =
        !lastEarning ||
        (new Date(now) - new Date(lastEarning.date)) / (1000 * 60 * 60 * 24) >= 30

      if (!canUpdate) {
        console.log(`[SKIPPED] Less than 30 days for user: ${user_id}, plan: ${plan_id}`)
        continue
      }

      // Step 2: Insert new ROI earning
      const { error: earningError } = await supabase.from('roi_earnings').insert({
        user_id,
        plan_id,
        amount: roiAmount,
        date: now.toISOString()
      })

      if (earningError) {
        console.error('[ROI EARNING ERROR]', earningError.message)
        continue
      }

      // Step 3: Handle referral bonus
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('referred_by')
        .eq('user_id', user_id)
        .single()

      if (profileErr) {
        console.error('[PROFILE FETCH ERROR]', profileErr.message)
        continue
      }

      if (profileData?.referred_by) {
        const bonus = roiAmount * 0.01

        const { error: bonusError } = await supabase.from('referral_earnings').insert({
          referrer_id: profileData.referred_by,
          referred_user_id: user_id,
          plan_id,
          amount: bonus,
          date: now.toISOString()
        })

        if (bonusError) {
          console.error('[REFERRAL BONUS ERROR]', bonusError.message)
        }
      }
    }

    return res.json({ message: 'ROI updated if 30 days have passed' })
  } catch (err) {
    console.error('[UPDATE ROI ERROR]', err)
    return res.status(500).json({ error: 'Server error while updating ROI' })
  }
}




export const getUserROI = async (req, res) => {
  const userId = req.user.id

  const { data, error } = await supabase
    .from('user_roi')
    .select('*')
    .eq('user_id', userId)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ message: 'ROI history fetched', roi: data })
}

export const getROIHistory = async (req, res) => {
  const { data, error } = await supabase
    .from('roi_earnings')
    .select('*')
    .eq('user_id', req.user.id)

  if (error) return res.status(500).json({ error: 'Failed to fetch ROI history' })

  res.json({ message: 'ROI history fetched', earnings: data })
}
