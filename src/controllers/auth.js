import supabase from '../config/supabase.js'

const pendingRegistrations = new Map()
const pendingLogins = new Map()

const generateOTP = () => Math.floor(100000 + Math.random() * 900000)

// ✅ Email format validator
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ✅ Block disposable domains
const blockedDomains = ['mailinator.com', 'tempmail.com', 'example.com']
function isBlockedDomain(email) {
  const domain = email.split('@')[1]
  return blockedDomains.includes(domain)
}

export const registerUser = async (req, res) => {
  const { firstName, lastName, email, phone, password, confirmPassword, referralCode } = req.body

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' })
  }

  if (isBlockedDomain(email)) {
    return res.status(400).json({ error: 'Temporary email domains not allowed' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const otp = generateOTP()
  const expiresAt = Date.now() + 15 * 60 * 1000

  pendingRegistrations.set(email, {
    otp,
    expiresAt,
    data: { firstName, lastName, email, phone, password, referralCode }
  })

  console.log(`📨 OTP for registration [${email}]: ${otp}`)
  res.json({ success: true, message: 'OTP sent to email' })
}

export const verifyRegisterOtp = async (req, res) => {
  const { email, otp } = req.body
  const stored = pendingRegistrations.get(email)

  if (!stored || stored.otp !== parseInt(otp)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' })
  }

  if (Date.now() > stored.expiresAt) {
    pendingRegistrations.delete(email)
    return res.status(400).json({ error: 'OTP expired' })
  }

  const { firstName, lastName, phone, password, referralCode } = stored.data
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return res.status(400).json({ error: error.message })

  await supabase.from('profiles').insert({
    user_id: data.user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    phone,
    referral_code: referralCode
  })

  pendingRegistrations.delete(email)
  res.json({ success: true, message: 'User registered', data })
}

export const loginUser = async (req, res) => {
  const { email, password } = req.body

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.log('[DEBUG] Login error:', error)
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const otp = generateOTP()
  const expiresAt = Date.now() + 15 * 60 * 1000

  pendingLogins.set(email, { otp, expiresAt, session: data.session })
  console.log(`📨 OTP for login [${email}]: ${otp}`)

  res.json({ success: true, message: 'OTP sent for login' })
}

export const verifyLoginOtp = async (req, res) => {
  const { email, otp } = req.body
  const stored = pendingLogins.get(email)

  if (!stored || stored.otp !== parseInt(otp)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' })
  }

  if (Date.now() > stored.expiresAt) {
    pendingLogins.delete(email)
    return res.status(400).json({ error: 'OTP expired' })
  }

  pendingLogins.delete(email)
  res.json({ success: true, message: 'Login successful', session: stored.session })
}
