import jwt from 'jsonwebtoken'
import supabase from '../config/supabase.js'

const tempUsers = new Map()

export const registerDetails = async (req, res) => {
  const { firstname, lastname, email, phone, password, confirmPassword, referralCode } = req.body

  if (!firstname || !lastname) {
    return res.status(400).json({ error: 'First name and last name are required' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' })
  }

  const otp = Math.floor(100000 + Math.random() * 900000)

  // ✅ Save all user details including names
  tempUsers.set(email, {
    otp,
    user: {
      firstname,
      lastname,
      email,
      phone,
      password,
      referralCode
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

  const { firstname, lastname, password, phone, referralCode } = record.user

  // Sign up the user with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  // ✅ Mark user as verified
  const { error: profileError } = await supabase.from('profiles').insert({
    user_id: data.user.id,
    email,
    firstname,
    lastname,
    phone,
    referral_code: referralCode,
    user_verified: true,   // ✅ Set true after email verification
    kyc: false
  })

  if (profileError) {
    return res.status(500).json({ error: 'Failed to save user profile' })
  }

  tempUsers.delete(email)

  return res.json({
    message: 'User registered. Email verified successfully.',
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

  if (!stored || stored.otp !== otp) {
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

    // ✅ Fetch KYC status from Supabase "profiles" table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('kyc')
      .eq('user_id', data.user.id)
      .single()

    if (profileError) {
      console.log('[DEBUG] Profile fetch error:', profileError)
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
