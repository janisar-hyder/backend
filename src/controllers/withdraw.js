import { supabase } from '../config/supabase.js';
import createError from 'http-errors';

/**
 * @desc   Create withdrawal request
 * @route  POST /api/withdraw
 * @access Private
 */


// Constants
const MIN_WITHDRAWAL = 50;
const WITHDRAWAL_FEE_PERCENT = 2.5;

export const createWithdrawal = async (req, res, next) => {
  try {
    const { amount, method, address } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!amount || !method || !address) {
      throw createError(400, 'Amount, method, and address are required');
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < MIN_WITHDRAWAL) {
      throw createError(400, `Minimum withdrawal amount is $${MIN_WITHDRAWAL}`);
    }

    // Check KYC status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('kyc_status')
      .eq('user_id', userId)
      .single();

    if (profileError) throw profileError;
    if (!profile?.kyc_status) {
      throw createError(403, 'KYC verification is required for withdrawals');
    }

    // Check for pending withdrawals
    const { count: pendingCount, error: pendingError } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (pendingError) throw pendingError;
    if (pendingCount > 0) {
      throw createError(400, 'You already have a pending withdrawal');
    }

    // Create withdrawal record (balance not deducted yet)
    const { data: withdrawal, error: creationError } = await supabase.rpc('process_withdrawal', {
      p_user_id: userId,
      p_gross_amount: amountNum,
      p_fee_percent: WITHDRAWAL_FEE_PERCENT,
      p_payment_method: method,
      p_payment_address: address
    });

    if (creationError) throw creationError;

    res.status(201).json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal request submitted. Balance will be deducted upon admin approval.'
    });

  } catch (error) {
    next(error);
  }
};

// Admin approval endpoint
export const approveWithdrawal = async (req, res, next) => {
  try {
    const { withdrawalId } = req.body;
    const adminId = req.user.id;

    const { data: withdrawal, error } = await supabase.rpc('approve_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_admin_id: adminId
    });

    if (error) throw error;

    res.json({
      success: true,
      data: withdrawal,
      message: `Withdrawal approved. $${withdrawal.gross_amount} deducted from user balance.`
    });
  } catch (error) {
    next(error);
  }
};

// Admin rejection endpoint
export const rejectWithdrawal = async (req, res, next) => {
  try {
    const { withdrawalId, reason } = req.body;
    const adminId = req.user.id;

    const { data: withdrawal, error } = await supabase.rpc('reject_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_admin_id: adminId,
      p_reason: reason
    });

    if (error) throw error;

    res.json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal rejected. No balance was deducted.'
    });
  } catch (error) {
    next(error);
  }
};



// Admin approve/reject withdrawal
export const processWithdrawal = async (req, res, next) => {
  try {
    const { withdrawalId, action, reason } = req.body;
    const adminId = req.user.id;

    if (!withdrawalId || !action || (action === 'reject' && !reason)) {
      throw createError(400, 'Invalid request parameters');
    }

    // Process the action
    const { data: result, error } = await supabase.rpc(
      action === 'approve' ? 'approve_withdrawal' : 'reject_withdrawal',
      {
        withdrawal_id: withdrawalId,
        admin_id: adminId,
        rejection_reason: reason || null
      }
    );

    if (error) throw error;

    res.json({
      success: true,
      data: result,
      message: `Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    });

  } catch (error) {
    console.error('Withdrawal processing error:', {
      error: error.message,
      stack: error.stack,
      admin: req.user?.id,
      body: req.body
    });
    next(error);
  }
};


/**
 * @desc   Get all withdrawals (admin)
 * @route  GET /api/withdraw/all
 * @access Private/Admin
 */
export const getAllWithdrawals = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return next(createError(403, 'Not authorized'));
    }

    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: withdrawals.length,
      data: withdrawals
    });

  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get user withdrawals
 * @route  GET /api/withdraw
 * @access Private
 */


/**
 * @desc   Get user's pending withdrawals
 * @route  GET /api/withdrawals
 * @access Private
 */

// Get user withdrawals
export const getUserWithdrawals = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    next(error);
  }
};


/**
 * @desc   Get all withdrawals (admin)
 * @route  GET /api/admin/withdrawals
 * @access Private/Admin
 */

export const getAdminWithdrawals = async (req, res, next) => {
  try {
    const { status, user_id } = req.query;
    
    // Verify admin role
    if (req.user.role !== 'admin') {
      return next(createError(403, 'Not authorized'));
    }

    // 1. First get all withdrawals (with optional filters)
    let query = supabase
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (user_id) query = query.eq('user_id', user_id);

    const { data: withdrawals, error: withdrawalsError } = await query;

    if (withdrawalsError) {
      console.error('Withdrawals fetch error:', withdrawalsError);
      throw new Error(`Database error: ${withdrawalsError.message}`);
    }

    // Return empty array if no withdrawals found
    if (!withdrawals || withdrawals.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    // 2. Get user IDs from withdrawals
    const userIds = withdrawals.map(w => w.user_id);

    // 3. Fetch profile data for these users - using 'firstname' instead of 'first_name'
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, firstname, email')  // Changed to 'firstname'
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Profiles fetch error:', profilesError);
      throw new Error(`Profile fetch error: ${profilesError.message}`);
    }

    // 4. Combine the data - using 'firstname' instead of 'first_name'
    const withdrawalsWithProfile = withdrawals.map(withdrawal => {
      const profile = profiles.find(p => p.user_id === withdrawal.user_id);
      return {
        ...withdrawal,
        first_name: profile?.firstname || null,  // Changed to 'firstname'
        email: profile?.email || null
      };
    });

    res.status(200).json({
      success: true,
      count: withdrawalsWithProfile.length,
      data: withdrawalsWithProfile
    });

  } catch (err) {
    console.error('Error in getAdminWithdrawals:', err);
    next(createError(500, err.message || 'Failed to process withdrawals data'));
  }
};



/**
 * @desc   Update withdrawal status (admin)
 * @route  PUT /api/withdraw/:id
 * @access Private/Admin
 */


export const updateWithdrawalStatus = async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body;
    const { id } = req.params;
    const MIN_WITHDRAWAL = 10;
    const WITHDRAWAL_FEE_PERCENT = 2.5;

    // Validate inputs
    if (!id) return next(createError(400, 'Withdrawal ID is required'));
    if (req.user.role !== 'admin') return next(createError(403, 'Not authorized'));
    
    const validStatuses = ['approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return next(createError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`));
    }

    // Process withdrawal
    const { data: updatedWithdrawal, error } = await supabase
      .rpc('process_withdrawal', {
        p_withdrawal_id: id,
        p_new_status: status,
        p_processor_id: req.user.id,
        p_admin_notes: admin_notes || null,
        p_min_amount: MIN_WITHDRAWAL,
        p_fee_percent: WITHDRAWAL_FEE_PERCENT
      })
      .single();

    if (error) {
      console.error('Withdrawal processing error:', error);
      if (error.message.includes('Insufficient balance')) {
        return next(createError(400, error.message));
      }
      if (error.message.includes('below minimum')) {
        return next(createError(400, error.message));
      }
      return next(createError(500, error.message || 'Failed to process withdrawal'));
    }

    res.status(200).json({
      success: true,
      data: updatedWithdrawal,
      fee_details: {
        percent: WITHDRAWAL_FEE_PERCENT,
        amount: updatedWithdrawal.fee,
        gross_amount: updatedWithdrawal.gross_amount,
        net_amount: updatedWithdrawal.amount // amount stored is net amount
      }
    });

  } catch (err) {
    console.error('Withdrawal approval error:', err);
    next(createError(500, 'Internal server error'));
  }
};

// Example getWithdrawalById controller
export const getWithdrawalById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    const { data: withdrawal, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!withdrawal) throw createError(404, 'Withdrawal not found');

    // Ensure user owns withdrawal or is admin
    if (withdrawal.user_id !== userId && !isAdmin) {
      throw createError(403, 'Unauthorized access');
    }

    res.json({
      success: true,
      data: withdrawal
    });

  } catch (error) {
    next(error);
  }
};