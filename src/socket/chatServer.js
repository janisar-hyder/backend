//Chatserver.js
import { Server } from 'socket.io';
import { supabase } from '../config/supabase.js';

const connectedUsers = new Map();
const connectedAdmins = new Map();
const DEFAULT_ADMIN_ID = 'b33e4c25-5f5d-484d-931f-e8914f889d98';

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) throw new Error('Missing authentication token');

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) throw new Error('Invalid user token');

      // Check admin first
      const { data: admin } = await supabase
        .from('admins')
        .select('id, email, role')
        .eq('id', user.id)
        .single();

      if (admin) {
        socket.user = {
          id: admin.id,
          user_id: admin.id,
          email: admin.email,
          role: admin.role || 'admin',
          is_admin: true
        };
        return next();
      }

      // Check user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, email, role')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      socket.user = {
        id: profile.user_id,
        user_id: profile.user_id,
        email: profile.email,
        role: profile.role || 'user',
        is_admin: false
      };

      next();
    } catch (err) {
      console.error('Authentication error:', err.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ ${socket.user.role.toUpperCase()} connected:`, socket.user.id, socket.user.email);

    // Handle connections
    if (socket.user.is_admin) {
      connectedAdmins.set(socket.user.id, socket);
      socket.join('admin-room');
    } else {
      connectedUsers.set(socket.user.id, socket);
      socket.join(`user_${socket.user.id}`);
    }

    // Message handler
    socket.on('send_message', async (data, callback) => {
      try {
        const messageText = data.message?.trim();
        if (!messageText) throw new Error('Message cannot be empty');

        const messageData = {
          message: messageText,
          sender_role: socket.user.is_admin ? 'admin' : 'user',
          is_read: false,
          created_at: new Date().toISOString(),
          user_id: socket.user.is_admin ? data.recipient_id : socket.user.id,
          admin_id: socket.user.is_admin ? socket.user.id : DEFAULT_ADMIN_ID,
          recipient_id: socket.user.is_admin ? data.recipient_id : DEFAULT_ADMIN_ID
        };

        console.log('Saving message:', messageData);

        const { data: savedMessage, error } = await supabase
          .from('messages')
          .insert(messageData)
          .select()
          .single();

        if (error) throw error;

        // Deliver message
        if (socket.user.is_admin) {
          io.to(`user_${data.recipient_id}`).emit('new_message', savedMessage);
        } else {
          io.to('admin-room').emit('new_message', savedMessage);
        }

        callback({ success: true, message: savedMessage });
      } catch (err) {
        console.error('Message send error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // Mark as read handler
    socket.on('mark_as_read', async (messageIds, callback) => {
      try {
        if (!socket.user?.id) throw new Error('Authentication required');
        if (!Array.isArray(messageIds)) throw new Error('Invalid message IDs');

        const { error } = await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', messageIds)
          .eq('recipient_id', socket.user.id);

        if (error) throw error;

        if (typeof callback === 'function') {
          callback({ success: true });
        }

        // Notify sender
        if (socket.user.is_admin) {
          const { data: messages } = await supabase
            .from('messages')
            .select('user_id')
            .in('id', messageIds);

          const userIds = [...new Set(messages.map(m => m.user_id))];
          userIds.forEach(userId => {
            io.to(`user_${userId}`).emit('messages_read', { messageIds });
          });
        } else {
          io.to('admin-room').emit('messages_read', {
            user_id: socket.user.id,
            messageIds
          });
        }
      } catch (err) {
        console.error('Mark as read error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    // Disconnection handler
    socket.on('disconnect', () => {
      if (socket.user.is_admin) {
        connectedAdmins.delete(socket.user.id);
      } else {
        connectedUsers.delete(socket.user.id);
      }
    });
  });

  return io;
};