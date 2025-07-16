// src/controllers/plan.js
import supabase from '../config/supabase.js'

const plans = {
  PlanA: { cost: 500, months: 5, roi: 5 },
  PlanB: { cost: 700, months: 7, roi: 6 },
  PlanC: { cost: 900, months: 9, roi: 7 }
}

export const buyPlan = async (req, res) => {
  const { planType } = req.body

  const selectedPlan = plans[planType]
  if (!selectedPlan) {
    return res.status(400).json({ error: 'Invalid plan type' })
  }

  // ✅ Insert into user_roi table
  const { error: roiError } = await supabase.from('user_roi').insert({
    user_id: req.user.id,
    plan_type: planType,
    cost: selectedPlan.cost,
    months: selectedPlan.months,
    roi_percent: selectedPlan.roi,
    start_date: new Date().toISOString(),
    end_date: new Date(new Date().setMonth(new Date().getMonth() + selectedPlan.months)).toISOString()
  })

  if (roiError) {
    console.error('[ROI INSERT ERROR]', roiError.message)
    return res.status(500).json({ error: 'Failed to save plan purchase' })
  }

  return res.json({ message: 'Plan purchased successfully' })
}



export const updateMonthlyROI = async (req, res) => {
  try {
    const { data: activePlans, error } = await supabase
      .from('user_roi')
      .select('*')
      .lte('start_date', new Date().toISOString())
      .gte('end_date', new Date().toISOString()) // Plan still active

    if (error) {
      console.error('[ROI FETCH ERROR]', error.message)
      return res.status(500).json({ error: 'Failed to fetch ROI plans' })
    }

    for (const plan of activePlans) {
      const { user_id, roi_percent, cost, id: plan_id } = plan
      const roiAmount = (cost * roi_percent) / 100

      // Insert into monthly earnings
      const { error: earningError } = await supabase.from('roi_earnings').insert({
        user_id,
        plan_id,
        amount: roiAmount,
        date: new Date().toISOString()
      })

      if (earningError) {
        console.error('[ROI EARNING ERROR]', earningError.message)
        continue
      }

      // ✅ Check if this user was referred by someone
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
          referrer_id: profileData.referred_by,  // This is UUID of the referrer
          referred_user_id: user_id,
          plan_id,
          amount: bonus,
          date: new Date().toISOString()
        })
      }
    }

    return res.json({ message: 'Monthly ROI updated for active plans' })
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
