// Controllers/chat.js

import { supabase } from '../config/supabase.js';

const DEFAULT_ADMIN_ID = 'b33e4c25-5f5d-484d-931f-e8914f889d98';


export const getChatHistory = async (req, res) => {
  try {
    const currentUserId = req.user.user_id;
    const isAdmin = req.user.role === 'admin';

    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (isAdmin) {
      query = query.or(
        `and(admin_id.eq.${currentUserId},sender_role.eq.admin),` +
        `and(recipient_id.eq.${currentUserId},sender_role.eq.user)`
      );
    } else {
      query = query.or(
        `and(user_id.eq.${currentUserId},sender_role.eq.user),` +
        `and(recipient_id.eq.${currentUserId},sender_role.eq.admin)`
      );
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    const formattedMessages = messages.map(msg => ({
      ...msg,
      message: msg.message || '[No message content]',
      // Remove time conversion here - keep as UTC
      created_at: msg.created_at,
      read_at: msg.read_at,
      direction: msg.sender_role === (isAdmin ? 'admin' : 'user') ? 'outgoing' : 'incoming'
    }));

    res.json({
      success: true,
      messages: formattedMessages
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch messages'
    });
  }
};


export const getUsersWithChats = async (req, res) => {
  try {
    const currentAdminId = req.user.user_id;

    // Get all unique users who have conversations with this admin
    const { data: conversations, error } = await supabase
      .from('messages')
      .select('user_id')
      .or(
        `and(admin_id.eq.${currentAdminId},sender_role.eq.admin),` +
        `and(recipient_id.eq.${currentAdminId},sender_role.eq.user)`
      )
      .not('user_id', 'is', null);

    if (error) throw error;

    const uniqueUserIds = [...new Set(conversations.map(c => c.user_id))];

    if (uniqueUserIds.length === 0) {
      return res.json([]);
    }

    // Get user details and last messages
    const usersWithChats = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const { data: user } = await supabase
          .from('profiles')
          .select('user_id, email, firstname, lastname')
          .eq('user_id', userId)
          .single();

        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(admin_id.eq.${currentAdminId},user_id.eq.${userId}),` +
            `and(recipient_id.eq.${currentAdminId},user_id.eq.${userId})`
          )
          .order('created_at', { ascending: false })
          .limit(1);

        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('recipient_id', currentAdminId)
          .eq('user_id', userId);

        return {
          user_id: user.user_id,
          email: user.email,
          name: `${user.firstname} ${user.lastname}`.trim() || user.email.split('@')[0],
          last_message: messages[0]?.message,
          last_message_at: messages[0]?.created_at,
          unread_count: unreadCount || 0
        };
      })
    );

    // Sort by most recent message
    usersWithChats.sort((a, b) => 
      new Date(b.last_message_at) - new Date(a.last_message_at)
    );

    res.json(usersWithChats);
  } catch (err) {
    console.error('Error fetching users with chats:', err);
    res.status(500).json({ error: 'Failed to load user list' });
  }
};


// Updated getUserChatHistory
export const getUserChatHistory = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;
    const isAdmin = req.user.role === 'admin';

    if (!targetUserId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const { data: targetUser } = await supabase
      .from('profiles')
      .select('user_id, email, role')
      .eq('user_id', targetUserId)
      .single();

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (isAdmin) {
      query = query.or(
        `and(admin_id.eq.${currentUserId},user_id.eq.${targetUserId}),` +
        `and(recipient_id.eq.${currentUserId},user_id.eq.${targetUserId})`
      );
    } else {
      query = query.or(
        `and(user_id.eq.${currentUserId},recipient_id.eq.${targetUserId}),` +
        `and(user_id.eq.${targetUserId},recipient_id.eq.${currentUserId})`
      );
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      message: msg.message || '[No message content]',
      sender_id: msg.sender_id,
      sender_role: msg.sender_role,
      recipient_id: msg.recipient_id,
      created_at: msg.created_at,
      is_read: msg.is_read || false,
      user_id: msg.user_id,
      admin_id: msg.admin_id,
      direction: msg.sender_role === (isAdmin ? 'admin' : 'user') ? 'outgoing' : 'incoming'
    }));

    res.json({
      success: true,
      user: {
        user_id: targetUser.user_id,
        email: targetUser.email,
        role: targetUser.role
      },
      messages: formattedMessages
    });
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load chat history',
      details: err.message 
    });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { message_ids } = req.body;
    const readTimestamp = new Date().toISOString(); // UTC time
    
    const { error } = await supabase
      .from('messages')
      .update({ 
        is_read: true,
        read_at: readTimestamp
      })
      .in('id', message_ids);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

export const getUnreadCount = async (req, res) => {
  const userId = req.user.id;

  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    return res.json({
      success: true,
      unreadCount: count || 0
    });

  } catch (error) {
    console.error('[GET UNREAD COUNT ERROR]', error.message);
    return res.status(500).json({ 
      error: 'Failed to get unread count',
      details: error.message
    });
  }
};


// controllers/chat.ts
// Update the sendMessage function
export const sendMessage = async (req, res) => {
  try {
    const { message, recipient_id } = req.body;
    const sender_id = req.user.user_id;
    const isAdmin = req.user.role === 'admin';

    if (!message) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const newMessage = {
      message,
      sender_role: isAdmin ? 'admin' : 'user',
      is_read: false,
      created_at: new Date().toISOString(),
      read_at: null
    };

    if (isAdmin) {
      newMessage.admin_id = sender_id;
      newMessage.user_id = recipient_id;
      newMessage.recipient_id = recipient_id;
    } else {
      newMessage.user_id = sender_id;
      newMessage.admin_id = DEFAULT_ADMIN_ID;
      newMessage.recipient_id = DEFAULT_ADMIN_ID;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([newMessage])
      .select();

    if (error) throw error;

    if (req.io) {
      if (isAdmin) {
        // Send only to the specific user
        req.io.to(`user_${recipient_id}`).emit('new_message', data[0]);
      } else {
        // Send to admin room and specific admin
        req.io.to('admin-room').emit('new_message', data[0]);
        req.io.to(`admin_${DEFAULT_ADMIN_ID}`).emit('new_message', data[0]);
      }
    }

    res.json({ success: true, message: data[0] });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};


export const deleteChatHistory = async (req, res) => {
  const currentUserId = req.user.id;
  const { userId } = req.params;

  try {
    // Admin can delete conversation with a specific user
    const { error } = await supabase
      .from('messages')
      .delete()
      .or(
        `and(admin_id.eq.${currentUserId},user_id.eq.${userId}),` +
        `and(recipient_id.eq.${currentUserId},user_id.eq.${userId})`
      );

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Chat history deleted successfully'
    });

  } catch (error) {
    console.error('[DELETE CHAT HISTORY ERROR]', error.message);
    return res.status(500).json({ 
      error: 'Failed to delete chat history',
      details: error.message
    });
  }
};

export const getChatStats = async (req, res) => {
  try {
    const currentAdminId = req.user.id;

    // Get stats only for conversations this admin is involved in
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .or(
        `admin_id.eq.${currentAdminId},` +
        `recipient_id.eq.${currentAdminId}`
      );

    const { count: uniqueUsers } = await supabase
      .from('messages')
      .select('user_id', { count: 'exact', head: true })
      .not('user_id', 'is', null)
      .or(
        `admin_id.eq.${currentAdminId},` +
        `recipient_id.eq.${currentAdminId}`
      );

    const { count: unreadMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('recipient_id', currentAdminId);

    // Last 7 days messages
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentMessages } = await supabase
      .from('messages')
      .select('created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .or(
        `admin_id.eq.${currentAdminId},` +
        `recipient_id.eq.${currentAdminId}`
      );

    return res.json({
      success: true,
      stats: {
        totalMessages: totalMessages || 0,
        uniqueUsers: uniqueUsers || 0,
        unreadMessages: unreadMessages || 0,
        messagesLast7Days: recentMessages?.length || 0
      }
    });

  } catch (error) {
    console.error('[GET CHAT STATS ERROR]', error.message);
    return res.status(500).json({ 
      error: 'Failed to get chat statistics',
      details: error.message
    });
  }
};