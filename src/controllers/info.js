import { supabase } from '../config/supabase.js';
import { PLANS } from '../controllers/plan.js';

// Enhanced helper function with better error handling
async function getUserProfile(userId) {
  try {
    if (!userId) throw new Error('User ID is required');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Profile not found');
    
    return {
      ...data,
      kyc_status: data.kyc_status || false,
      no_of_users_referred: data.no_of_users_referred || 0,
      account_balance: data.account_balance || 0,
      roi_earnings: data.roi_earnings || 0,
      referral_earnings: data.referral_earnings || 0
    };
  } catch (error) {
    console.error(`[PROFILE FETCH ERROR] User: ${userId}`, error.message);
    throw error;
  }
}

// Standardized response format
const formatResponse = (success, data = null, error = null) => ({
  success,
  data,
  error: error ? {
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  } : null,
  timestamp: new Date().toISOString()
});

// Get all user info
export const getUserInfo = async (req, res) => {
  try {
    if (!req.user?.id) throw new Error('Authentication required');
    
    const profile = await getUserProfile(req.user.id);
    
    res.json(formatResponse(true, {
      accountBalance: profile.account_balance,
      activePlan: profile.plan_bought,
      roiEarnings: profile.roi_earnings,
      kycStatus: profile.kyc_status,
      referralCode: profile.referral_code,
      referralEarnings: profile.referral_earnings,
      usersReferred: profile.no_of_users_referred
    }));
  } catch (error) {
    console.error('[USER INFO ERROR]', error);
    res.status(500).json(formatResponse(false, null, error));
  }
};

// Individual endpoints follow the same pattern
export const getAccountBalance = async (req, res) => {
  try {
    if (!req.user?.id) throw new Error('Authentication required');
    
    const profile = await getUserProfile(req.user.id);
    res.json(formatResponse(true, { balance: profile.account_balance }));
  } catch (error) {
    console.error('[BALANCE ERROR]', error);
    res.status(error.message.includes('not found') ? 404 : 500)
       .json(formatResponse(false, null, error));
  }
};

export const getActivePlan = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json(formatResponse(false, null, 'Authentication required'));
    }
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json(formatResponse(false, null, 'User profile not found'));
    }

    if (!profile.plan_bought) {
      return res.json(formatResponse(true, { 
        planActive: false,
        message: "No active investment plan",
        hasPlan: false
      }));
    }

    const planDetails = PLANS[profile.plan_bought];
    if (!planDetails) {
      await resetUserPlan(profile.user_id);
      return res.json(formatResponse(true, {
        planActive: false,
        message: "Previous plan was invalid and has been reset",
        hasPlan: false
      }));
    }

    const now = new Date();
    const endDate = new Date(profile.plan_end_date);
    const isPlanEnded = now > endDate;
    const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

    // Calculate monthly ROI - use DB value or fallback to calculation
    const dailyROI = planDetails.dailyROI || 0.04/30; // Fallback calculation if not set
    const monthlyROI = parseFloat((dailyROI * 30).toFixed(6));

    if (isPlanEnded && !profile.principal_returned) {
      const { error: returnError } = await returnPrincipalToUser(profile.user_id, planDetails.price);
      if (returnError) {
        console.error('Failed to return principal:', returnError);
      }
    }

    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    return res.json(formatResponse(true, {
      planActive: !isPlanEnded,
      status: isPlanEnded ? 'completed' : 'active',
      hasPlan: true,
      planDetails: {
        name: planDetails.name,
        amount: planDetails.price,
        daysRemaining,
        monthlyROI, // Now properly calculated
        totalEarned: parseFloat((updatedProfile?.roi_earnings || 0).toFixed(2))
      },
      accountBalance: parseFloat((updatedProfile?.account_balance || 0).toFixed(2))
    }));

  } catch (error) {
    console.error('[PLAN ERROR]', error);
    return res.status(500).json(formatResponse(false, null, {
      message: error.message || 'Failed to get plan details',
      code: 'SERVER_ERROR'
    }));
  }
};

// Helper functions
async function resetUserPlan(userId) {
  await supabase
    .from('profiles')
    .update({
      plan_bought: null,
      plan_start_date: null,
      plan_end_date: null
    })
    .eq('user_id', userId);
}

async function returnPrincipalToUser(userId, amount) {
  await supabase
    .from('profiles')
    .update({
      account_balance: supabase.raw('account_balance + ?', [amount]),
      principal_returned: true
    })
    .eq('user_id', userId);
}


export const getRoiEarnings = async (req, res) => {
  try {
    if (!req.user?.id) throw new Error('Authentication required');
    
    const profile = await getUserProfile(req.user.id);
    
    // Format to exactly 2 decimal places as a number
    const formattedEarnings = Math.round((profile.roi_earnings || 0) * 100) / 100;
    
    res.json(formatResponse(true, {
      earnings: formattedEarnings,
      currency: 'USD',
      formatted: formattedEarnings.toFixed(2) // Optional string representation
    }));
  } catch (error) {
    console.error('[ROI ERROR]', error);
    res.status(500).json(formatResponse(false, null, error));
  }
};


export const getKycStatus = async (req, res) => {
  try {
    if (!req.user?.id) throw new Error('Authentication required');
    
    const profile = await getUserProfile(req.user.id);
    res.json(formatResponse(true, {
      kycStatus: profile.kyc_status,
      verified: profile.kyc_status === true
    }));
  } catch (error) {
    console.error('[KYC ERROR]', error);
    res.status(500).json(formatResponse(false, null, error));
  }
};

export const getReferralInfo = async (req, res) => {
  try {
    if (!req.user?.id) throw new Error('Authentication required');
    
    const profile = await getUserProfile(req.user.id);
    res.json(formatResponse(true, {
      code: profile.referral_code,
      earnings: profile.referral_earnings,
      referrals: profile.no_of_users_referred,
      totalEarnings: profile.referral_earnings // Could add calculation here
    }));
  } catch (error) {
    console.error('[REFERRAL ERROR]', error);
    res.status(500).json(formatResponse(false, null, error));
  }
};

// Admin endpoint with enhanced validation
export const updateKycStatus = async (req, res) => {
  try {
    if (!req.user?.isAdmin) throw new Error('Admin access required');
    
    const { userId, status } = req.body;
    
    if (typeof status !== 'boolean') {
      throw new Error('Invalid status: must be boolean');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ kyc_status: status })
      .eq('user_id', userId);

    if (error) throw error;

    res.json(formatResponse(true, {
      userId,
      newStatus: status,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('[KYC UPDATE ERROR]', error);
    res.status(400).json(formatResponse(false, null, error));
  }
};



// Get total number of users
export const getTotalUsers = async (req, res) => {
  try {
    if (!req.user?.isAdmin) throw new Error('Admin access required');

    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    res.json(formatResponse(true, {
      totalUsers: count || 0,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('[TOTAL USERS ERROR]', error);
    res.status(500).json(formatResponse(false, null, error));
  }
};





// Get total active investments
export const getAllActivePlans = async (req, res) => {
  try {
    if (!req.user?.isAdmin) throw new Error('Admin access required');

    // Get all users with plan information
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        user_id,
        email,
        plan_bought,
        plan_start_date,
        plan_end_date,
        roi_earnings
      `);

    if (error) throw error;

    const now = new Date();
    let totalInvestment = 0;
    let activePlanCount = 0;

    const enhancedPlans = users.map(user => {
      // Handle NULL plan_bought case
      const hasPlan = user.plan_bought && user.plan_bought !== 'NULL';
      
      const planDetails = hasPlan 
        ? PLANS[user.plan_bought] || { name: 'Unknown Plan', price: 0, dailyROI: 0 }
        : { name: 'No Plan Purchased', price: 0, dailyROI: 0 };

      // Calculate plan details only if it's an active plan
      let endDate, daysRemaining;
      if (hasPlan && user.plan_end_date) {
        endDate = new Date(user.plan_end_date);
        daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
      } else {
        endDate = null;
        daysRemaining = 0;
      }

      // Only count investment for actual plans
      if (hasPlan) {
        totalInvestment += planDetails.price;
        activePlanCount++;
      }

      return {
        userId: user.user_id,
        userEmail: user.email,
        planType: hasPlan ? user.plan_bought : 'NULL',
        planName: planDetails.name,
        investmentAmount: planDetails.price,
        startDate: hasPlan ? user.plan_start_date : null,
        endDate: endDate,
        daysRemaining,
        earned: user.roi_earnings || 0,
        dailyROI: planDetails.dailyROI,
        monthlyROI: parseFloat((planDetails.dailyROI * 30).toFixed(4))
      };
    });

    res.json(formatResponse(true, {
      totalUsers: users.length,
      activePlanCount,
      totalInvestment,
      plans: enhancedPlans,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('[ACTIVE PLANS ERROR]', error);
    res.status(500).json(formatResponse(false, null, error));
  }
};


// Get admin user details
// Updated endpoint in controllers/info.js

/**
 * Admin endpoint to get all users with basic details
 */
export const getAllUsersBasicDetails = async (req, res) => {
  try {
    if (!req.user?.isAdmin) throw new Error('Admin access required');

    // Get all users with the specified fields
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(`
        user_id,
        firstname,
        lastname,
        email,
        kyc_status,
        account_balance,
        no_of_users_referred,
        plan_bought,
        updated_at
      `)
      .order('updated_at', { ascending: false }); // Sort by last updated

    if (error) throw error;

    // Format the response data with proper null checks
    const usersData = profiles.map(profile => ({
      user_id: profile.user_id,
      firstname: profile.firstname || '',
      lastname: profile.lastname || '',
      email: profile.email || '',
      kyc_status: Boolean(profile.kyc_status),
      account_balance: Number(profile.account_balance) || 0,
      no_of_users_referred: Number(profile.no_of_users_referred) || 0,
      plan_bought: profile.plan_bought || null
    }));

    res.json(formatResponse(true, usersData));
  } catch (error) {
    console.error('[ADMIN ALL USERS ERROR]', error);
    
    // More specific error messages
    let errorMessage = 'Failed to fetch users';
    if (error.message.includes('permission denied')) {
      errorMessage = 'Insufficient permissions';
    } else if (error.message.includes('does not exist')) {
      errorMessage = 'Database column not found';
    }
    
    res.status(500).json(formatResponse(false, null, {
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }));
  }
};




/**
 * Update user profile information
 */
export const updateUserProfile = async (req, res) => {
  try {
    if (!req.user?.id) throw new Error('Authentication required');
    
    const { firstname, lastname, phone } = req.body;
    
    // Basic validation
    if (!firstname || !lastname) {
      throw new Error('First name and last name are required');
    }

    if (phone && !/^[\d\s\+\-\(\)]{10,20}$/.test(phone)) {
      throw new Error('Invalid phone number format');
    }

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        firstname,
        lastname,
        phone,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id)
      .select('firstname, lastname, phone')
      .single();

    if (error) throw error;
    if (!updatedProfile) throw new Error('Profile not found');

    res.json(formatResponse(true, {
      message: 'Profile updated successfully',
      profile: updatedProfile
    }));
  } catch (error) {
    console.error('[UPDATE PROFILE ERROR]', error);
    res.status(400).json(formatResponse(false, null, error));
  }
};



export const getUsersProfile = async (req, res) => {
  try {
    if (!req.user?.id) throw new Error('Authentication required');
    
    // Fetch user profile from Supabase (simplified query)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        firstname,
        lastname,
        phone,
        email
      `)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    if (!profile) throw new Error('Profile not found');

    // Format the response
    res.json(formatResponse(true, {
      message: 'Profile retrieved successfully',
      profile: {
        firstname: profile.firstname,
        lastname: profile.lastname,
        email: profile.email, // Directly from profiles table
        phone: profile.phone
      }
    }));
  } catch (error) {
    console.error('[GET PROFILE ERROR]', error);
    res.status(400).json(formatResponse(false, null, {
      message: error instanceof Error ? error.message : 'Failed to retrieve profile',
      details: error
    }));
  }
};



export const getAdminProfile = async (req, res) => {
  try {
    if (!req.user?.email) throw new Error('Authentication required');
    
    // Verify the user is actually an admin by email
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('email, role')
      .eq('email', req.user.email)
      .single();

    if (adminError) throw adminError;
    if (!admin) throw new Error('Admin profile not found');

    // Format the response
    res.json(formatResponse(true, {
      message: 'Admin profile retrieved successfully',
      profile: {
        email: admin.email,
        role: admin.role
      }
    }));
  } catch (error) {
    console.error('[GET ADMIN PROFILE ERROR]', error);
    res.status(403).json(formatResponse(false, null, {
      message: error instanceof Error ? error.message : 'Failed to retrieve admin profile',
      details: error.message // Only send the error message for security
    }));
  }
};