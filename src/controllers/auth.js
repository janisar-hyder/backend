import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import supabaseAdmin from '../config/supabaseAdmin.js';
const tempPasswordResets = new Map();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const tempRegistrationData = new Map();
const tempLogins = new Map();

// Generate unique referral code
async function generateUniqueReferralCode(prefix = 'REF') {
  let unique = false;
  let newReferralCode;

  while (!unique) {
    newReferralCode = `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;
    const { data } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('referral_code', newReferralCode)
      .single();

    if (!data) unique = true;
  }

  return newReferralCode;
}

// Validate referral code
async function validateReferralCode(referralCode) {
  if (!referralCode) return null;

  const { data: referrer, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('referral_code', referralCode)
    .single();

  if (error || !referrer) {
    throw new Error('Invalid referral code');
  }

  return referrer.user_id;
}

// Registration with OTP
export const registerDetails = async (req, res) => {
  const { firstname, lastname, email, phone, password, confirmPassword, referralCode } = req.body;

  if (!email || !firstname || !lastname || !phone || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    // Check if email exists in profiles table
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      return res.status(409).json({ error: 'User already exists' });
    }

    let referredBy = null;
    if (referralCode) {
      try {
        referredBy = await validateReferralCode(referralCode);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    // First create the user with password
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstname,
          last_name: lastname,
          phone
        }
      }
    });

    if (signUpError) throw signUpError;

    // Store registration data temporarily (we'll use this in completeSignup)
    tempRegistrationData.set(email, {
      firstname,
      lastname,
      phone,
      password,
      referredBy,
      role: 'user'
    });

    // Send OTP for verification
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false // User already created
      }
    });

    if (otpError) throw otpError;

    return res.json({ 
      message: 'OTP sent to email for verification',
      email
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ 
      error: error.message || 'Registration failed',
      details: error 
    });
  }
};

export const completeSignup = async (req, res) => {
  const { email, token } = req.body;

  try {
    const storedData = tempRegistrationData.get(email);
    if (!storedData) {
      throw new Error('Registration data not found or expired');
    }

    const { firstname, lastname, phone, password, referredBy, role } = storedData;

    // Verify OTP
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (otpError) throw otpError;

    const user_id = otpData.user.id;

    // Generate unique referral code for new user
    const referral_code = await generateUniqueReferralCode();

    // Create profile in database
    const { error: profileError } = await supabase.from('profiles').insert({
      user_id,
      email,
      firstname,
      lastname,
      phone,
      password_hash: await bcrypt.hash(password, 10),
      referral_code,
      referred_by: referredBy,
      user_verified: true,
      role: role || 'user'
    });

    if (profileError) throw profileError;

    // Handle referral if applicable - Enhanced version
    if (referredBy) {
      try {
        // METHOD 1: Using stored procedure (most reliable)
        const { error: rpcError } = await supabase.rpc('increment_referral_count', {
          referred_user_id: referredBy
        });

        if (rpcError) {
          console.log('Falling back to direct update...');
          
          // METHOD 2: Direct update with atomic increment
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              no_of_users_referred: supabase.rpc('increment', {
                column: 'no_of_users_referred',
                value: 1
              })
            })
            .eq('user_id', referredBy);

          if (updateError) {
            console.log('Falling back to fetch-and-update...');
            
            // METHOD 3: Fetch current value and update
            const { data: referrer, error: fetchError } = await supabase
              .from('profiles')
              .select('no_of_users_referred')
              .eq('user_id', referredBy)
              .single();

            if (!fetchError && referrer) {
              const newCount = (referrer.no_of_users_referred || 0) + 1;
              await supabase
                .from('profiles')
                .update({ no_of_users_referred: newCount })
                .eq('user_id', referredBy);
            } else {
              console.error('Failed to fetch referrer data:', fetchError);
            }
          }
        }
      } catch (e) {
        console.error('All referral increment methods failed:', e);
      }
    }

    // Clean up
    tempRegistrationData.delete(email);

    return res.json({ 
      message: 'Registration complete',
      user_id,
      email,
      referral_code 
    });

  } catch (error) {
    console.error('Complete signup error:', error);
    return res.status(400).json({ 
      error: error.message || 'Registration failed',
      details: error.details 
    });
  }
};

// Unified login with password + OTP
export const loginWithPasswordAndOTP = async (req, res) => {
  const { email, password } = req.body;

  try {
    // First check in profiles table
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, password_hash, role')
      .eq('email', email)
      .single();

    // If not found in profiles, check in admins table
    if (profileError || !profile) {
      const { data: admins, error: adminError } = await supabase
        .from('admins')
        .select('id, password_hash, role')
        .eq('email', email)
        .single();

      if (adminError || !admins) {
        return res.status(404).json({ error: 'Account not found' });
      }
      profile = admins;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, profile.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Store user ID and role temporarily
    tempLogins.set(email, {
      userId: profile.user_id,
      role: profile.role || 'user' // Default to 'user' if role not specified
    });

    // Send OTP
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false
      }
    });

    if (otpError) throw otpError;

    return res.json({ message: 'OTP sent to email' });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(400).json({ error: error.message });
  }
};

export const verifyLoginOTP = async (req, res) => {
  const { email, token } = req.body;

  try {
    // Verify OTP - this creates the session
    const { data, error: otpError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (otpError) throw otpError;

    // Get stored user data
    const loginData = tempLogins.get(email);
    if (!loginData) {
      throw new Error('Login session expired');
    }

    // Try to get profile from both tables
    let profile = null;

    // First try profiles table (using user_id)
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', loginData.userId)
      .single();

    if (!userError && userProfile) {
      profile = userProfile;
    } else {
      // If not found in profiles, try admins table (using id)
      const { data: adminProfile, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)  // Lookup by email instead of ID
        .single();

      if (adminError || !adminProfile) {
        console.log('Admin lookup failed for:', email);
        throw new Error('User profile not found in either table');
      }
      profile = adminProfile;
    }

    tempLogins.delete(email);

    // Return the session and user information
    return res.json({
      user: {
        ...profile,
        role: profile.role || loginData.role || 'user' // Default to user if no role specified
      },
      session: data.session
    });

  } catch (error) {
    console.error('OTP verification error:', {
      message: error.message,
      email: email,
      error: error
    });
    tempLogins.delete(email);
    return res.status(400).json({ 
      error: error.message,
      details: 'Please try logging in again' 
    });
  }
};
















// Password reset endpoints
export const initiatePasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if email exists in profiles table (users only)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, user_verified')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User account not found' });
    }

    if (!profile.user_verified) {
      return res.status(403).json({ error: 'Account not verified. Please verify your account first.' });
    }

    // Store the email temporarily for verification
    tempPasswordResets.set(email, {
      userId: profile.user_id,
      verified: false
    });

    // Send OTP
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false
      }
    });

    if (otpError) throw otpError;

    return res.json({ message: 'OTP sent to email for password reset' });

  } catch (error) {
    console.error('Password reset initiation error:', error);
    return res.status(400).json({ error: error.message });
  }
};

export const verifyPasswordResetOTP = async (req, res) => {
  const { email, token } = req.body;

  try {
    // Verify OTP
    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (otpError) throw otpError;

    // Get stored reset data
    const resetData = tempPasswordResets.get(email);
    if (!resetData) {
      throw new Error('Password reset session expired or not found');
    }

    // Mark as verified
    tempPasswordResets.set(email, {
      ...resetData,
      verified: true
    });

    return res.json({ message: 'OTP verified successfully. You can now reset your password.' });

  } catch (error) {
    console.error('Password reset OTP verification error:', error);
    return res.status(400).json({ error: error.message });
  }
};

export const completePasswordReset = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  try {
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check password strength if needed
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Get stored reset data
    const resetData = tempPasswordResets.get(email);
    if (!resetData || !resetData.verified) {
      return res.status(403).json({ error: 'OTP not verified or session expired' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password in profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ password_hash: newPasswordHash })
      .eq('email', email);

    if (updateError) throw updateError;

    // Clean up
    tempPasswordResets.delete(email);

    return res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Password reset completion error:', error);
    return res.status(400).json({ error: error.message });
  }
};