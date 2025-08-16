//routes/chat.js

import express from 'express';
import {
  getChatHistory,
  getUsersWithChats,
  getUserChatHistory,
  markMessagesAsRead,
  getUnreadCount,
  deleteChatHistory,
  getChatStats,
  sendMessage
} from '../controllers/chat.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// User routes
router.get('/messages', verifyToken, getChatHistory); // Get all messages for current user
router.post('/messages', verifyToken, sendMessage); // Send new message
router.get('/unread-count', verifyToken, getUnreadCount); // Get unread message count
router.patch('/messages/mark-read', verifyToken, markMessagesAsRead); // Mark messages as read

// Admin-specific routes
router.get('/admin/users', verifyToken, verifyAdmin, getUsersWithChats); // List all users with conversations
router.get('/admin/conversations/:userId', verifyToken, verifyAdmin, getUserChatHistory); // Get specific conversation
router.delete('/admin/conversations/:userId', verifyToken, verifyAdmin, deleteChatHistory); // Delete conversation
router.get('/admin/stats', verifyToken, verifyAdmin, getChatStats); // Get chat statistics

// Additional endpoints for better message management
router.get('/admin/messages', verifyToken, verifyAdmin, getChatHistory); // Admin view of their messages
router.post('/admin/messages', verifyToken, verifyAdmin, sendMessage); // Admin sending messages

export default router;