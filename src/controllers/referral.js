import { supabase } from '../config/supabase.js'

export const getReferralInfo = async (req, res) => {
  try {
    const userId = req.user.id

    // Fetch current user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code, referred_by')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    // Fetch users referred by this user
    const { data: referredUsers, error: referredError } = await supabase
      .from('profiles')
      .select('user_id, email, firstname, lastname')
      .eq('referred_by', userId)

    if (referredError) {
      return res.status(500).json({ error: 'Failed to fetch referred users' })
    }

    res.json({
      message: 'Referral info fetched',
      your_referral_code: profile.referral_code,
      referred_by: profile.referred_by,
      users_you_referred: referredUsers
    })
  } catch (err) {
    console.error('[REFERRAL INFO ERROR]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

export const getReferralEarnings = async (req, res) => {
  try {
    const userId = req.user.id
    const { data, error } = await supabase
      .from('referral_earnings')
      .select('*')
      .eq('referrer_id', userId)

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch referral earnings' })
    }

    res.json({
      message: 'Referral earnings fetched',
      earnings: data
    })
  } catch (err) {
    console.error('[REFERRAL EARNINGS ERROR]', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}
