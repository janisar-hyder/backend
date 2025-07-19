import supabase from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'adminsecret';
const tempAdmins = new Map();

// POST /api/admin/login (step 1: request OTP)
export const adminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const otp = Math.floor(100000 + Math.random() * 900000);
  const expiresAt = Date.now() + 15 * 60 * 1000;
  tempAdmins.set(email, { otp, expiresAt });
  console.log(`📨 ADMIN OTP for login [${email}]: ${otp}`);
  res.json({ message: 'OTP sent to admin email' });
};

// POST /api/admin/verify-otp (step 2: verify OTP and Supabase access token)
export const verifyAdminOtp = async (req, res) => {
  const { email, otp } = req.body;
  const stored = tempAdmins.get(email);
  if (!stored || stored.otp !== parseInt(otp)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }
  // Find admin in Supabase
  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !admin) {
    return res.status(401).json({ error: 'Admin not found' });
  }
  tempAdmins.delete(email);
  const token = jwt.sign(
    { adminId: admin.id, email: admin.email },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  res.json({ message: 'Admin verified', token });
}; 