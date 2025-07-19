import supabase from '../config/supabase.js';

// GET /api/admin/users
export const getAllUsers = async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ users: data });
};

// GET /api/admin/withdraws
export const getWithdrawRequests = async (req, res) => {
  const { data, error } = await supabase.from('withdraw_requests').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ withdraws: data });
};

// POST /api/admin/withdraws/:id/approve
export const approveWithdraw = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('withdraw_requests')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await notifyUser(data.user_id, 'Your withdrawal request has been approved.');
  res.json({ success: true, withdraw: data });
};

// POST /api/admin/withdraws/:id/decline
export const declineWithdraw = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('withdraw_requests')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await notifyUser(data.user_id, 'Your withdrawal request has been declined.');
  res.json({ success: true, withdraw: data });
};

// Helper: Notify user (pseudo-code, replace with real notification logic)
export const notifyUser = async (userId, message) => {
  // You could send an email, push notification, or in-app notification here
  console.log(`Notify user ${userId}: ${message}`);
}; 