import jwt from 'jsonwebtoken'
import supabase from '../config/supabase.js'

const tempUsers = new Map()

// ✅ Generate a unique referral code
async function generateUniqueReferralCode(prefix = 'REF') {
  let unique = false
  let newReferralCode

  while (!unique) {
    newReferralCode = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`
    const { data } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('referral_code', newReferralCode)
      .single()

    if (!data) unique = true
  }

  return newReferralCode
}

export const registerDetails = async (req, res) => {
  const { firstname, lastname, email, phone, password, confirmPassword, referralCode } = req.body

  if (!firstname || !lastname || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' })
  }

  let referredBy = null
  if (referralCode) {
    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('referral_code', referralCode)
      .single()

    if (referrer) {
      referredBy = referrer.user_id
    }
  }

  const newReferralCode = await generateUniqueReferralCode()

  const otp = Math.floor(100000 + Math.random() * 900000)
  tempUsers.set(email, {
    otp,
    user: {
      firstname,
      lastname,
      email,
      phone,
      password,
      referralCode: newReferralCode,
      referredBy
    }
  })

  console.log(`📨 OTP for registration [${email}]: ${otp}`)
  return res.json({ message: 'OTP sent to email' })
}

export const verifyRegisterOtp = async (req, res) => {
  const { email, otp } = req.body
  const record = tempUsers.get(email)

  if (!record || record.otp !== parseInt(otp)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' })
  }

  const { firstname, lastname, password, phone, referralCode, referredBy } = record.user

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    user_id: data.user.id,
    email,
    firstname,
    lastname,
    phone,
    referral_code: referralCode,
    referred_by: referredBy,
    user_verified: true,
    kyc: false,
    account_balance: 0,
    roi_balance: 0,
    referral_earnings: 0,
    referral_no: 0,
    plan_bought: null
  })

  if (profileError) {
    console.error('[PROFILE INSERT ERROR]', profileError)
    return res.status(500).json({ error: profileError.message })
  }

  // ✅ Increment referral_no of the referrer (corrected logic)
  if (referredBy) {
    await supabase.rpc('increment_referral_no', { ref_user_id: referredBy })
  }

  tempUsers.delete(email)

  return res.json({
    message: 'User registered and verified',
    user: data.user
  })
}

export const loginDetails = async (req, res) => {
  const { email, password } = req.body

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return res.status(400).json({ error: 'Invalid email or password' })
  }

  const otp = Math.floor(100000 + Math.random() * 900000)
  const expiresAt = Date.now() + 15 * 60 * 1000

  tempUsers.set(email, { otp, expiresAt, password })

  console.log(`📨 OTP for login [${email}]: ${otp}`)

  return res.json({ message: 'OTP sent successfully' })
}

export const verifyLoginOtp = async (req, res) => {
  const { email, otp } = req.body
  const stored = tempUsers.get(email)

  if (!stored || stored.otp !== parseInt(otp)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' })
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: stored.password
    })

    if (error) {
      console.log('[DEBUG] Login error:', error)
      return res.status(400).json({ error: error.message })
    }

    tempUsers.delete(email)

    const token = jwt.sign(
      { id: data.user.id, email: data.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('kyc')
      .eq('user_id', data.user.id)
      .single()

    if (profileError) {
      console.log('[DEBUG] Profile fetch error:', profileError.message)
    }

    return res.json({
      message: 'Login successful',
      token,
      user: data.user,
      email_verified: !!(data.user.email_confirmed_at || data.user.confirmed_at),
      kyc: profile?.kyc || false
    })
  } catch (err) {
    console.error('[DEBUG] OTP verify login error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
