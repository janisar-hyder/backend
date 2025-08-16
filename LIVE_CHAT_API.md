# Live Chat System API Documentation

## Overview
This document describes the real-time live chat system between users and admin using Socket.IO. The system provides instant messaging, typing indicators, read receipts, and chat history management.

## Features
- **Real-time messaging** between users and admin
- **Typing indicators** to show when someone is typing
- **Read receipts** to track message status
- **Chat history** persistence in database
- **User authentication** via JWT tokens
- **Admin dashboard** for managing multiple user chats
- **Unread message counters**
- **Chat statistics** for admin

## Database Schema

### Table: `chat_messages`
```sql
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  admin_id UUID REFERENCES auth.users(id),
  recipient_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_admin_id ON chat_messages(admin_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_is_read ON chat_messages(is_read);
```

## Socket.IO Events

### Client to Server Events

#### 1. Connection
```javascript
// Connect with authentication token
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});
```

#### 2. Send Message
```javascript
// User sending message to admin
socket.emit('send_message', {
  message: 'Hello, I need help with my investment plan',
  recipient_id: null // null for user->admin messages
});

// Admin sending message to specific user
socket.emit('send_message', {
  message: 'Hello! How can I help you today?',
  recipient_id: 'user_uuid_here'
});
```

#### 3. Typing Indicators
```javascript
// Start typing
socket.emit('typing', {
  recipient_id: 'user_uuid_here' // or null for user->admin
});

// Stop typing
socket.emit('stop_typing', {
  recipient_id: 'user_uuid_here' // or null for user->admin
});
```

#### 4. Mark Messages as Read
```javascript
socket.emit('mark_read', {
  message_ids: [1, 2, 3] // Array of message IDs to mark as read
});
```

#### 5. Join Chat (User)
```javascript
// Emitted when user logs in and wants to join chat
socket.emit('join_chat');
```

### Server to Client Events

#### 1. Chat History
```javascript
socket.on('chat_history', (data) => {
  console.log('Chat history loaded:', data.messages);
  // data.messages: Array of message objects
});
```

#### 2. New Message
```javascript
socket.on('new_message', (data) => {
  console.log('New message received:', data.message);
  // data.message: Message object
  // data.user_id: User ID (for admin)
  // data.admin_id: Admin ID (for user)
});
```

#### 3. Message Sent Confirmation
```javascript
socket.on('message_sent', (data) => {
  console.log('Message sent successfully:', data.message);
});
```

#### 4. Typing Indicators
```javascript
// User typing (for admin)
socket.on('user_typing', (data) => {
  console.log('User is typing:', data.user_id);
});

// Admin typing (for user)
socket.on('admin_typing', (data) => {
  console.log('Admin is typing:', data.admin_id);
});

// Stop typing events
socket.on('user_stop_typing', (data) => {
  console.log('User stopped typing:', data.user_id);
});

socket.on('admin_stop_typing', (data) => {
  console.log('Admin stopped typing:', data.admin_id);
});
```

#### 5. Read Receipts
```javascript
socket.on('messages_read', (data) => {
  console.log('Messages marked as read:', data.message_ids);
});
```

#### 6. User Join Chat (Admin)
```javascript
socket.on('user_joined_chat', (data) => {
  console.log('User joined chat:', {
    user_id: data.user_id,
    username: data.username,
    email: data.email
  });
});
```

#### 7. Welcome Message (User)
```javascript
socket.on('welcome_message', (data) => {
  console.log('Welcome message:', data.message);
});
```

#### 8. Notifications
```javascript
socket.on('notification', (data) => {
  console.log('Notification received:', data);
});
```

#### 9. Error Handling
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});
```

## REST API Endpoints

### User Endpoints

#### 1. Get Chat History
**GET** `/chat/history`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": 1,
      "user_id": "uuid",
      "admin_id": null,
      "recipient_id": null,
      "message": "Hello, I need help",
      "sender_role": "user",
      "is_read": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 2. Get Unread Count
**GET** `/chat/unread-count`

**Response:**
```json
{
  "success": true,
  "unreadCount": 3
}
```

#### 3. Mark Messages as Read
**POST** `/chat/mark-read`

**Body:**
```json
{
  "message_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Messages marked as read"
}
```

### Admin Endpoints

#### 1. Get Users with Chats
**GET** `/chat/users`

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "user_id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "last_message_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 2. Get User Chat History
**GET** `/chat/user/:userId`

**Response:**
```json
{
  "success": true,
  "user": {
    "username": "john_doe",
    "email": "john@example.com"
  },
  "messages": [
    {
      "id": 1,
      "user_id": "uuid",
      "admin_id": null,
      "recipient_id": null,
      "message": "Hello, I need help",
      "sender_role": "user",
      "is_read": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 3. Delete Chat History
**DELETE** `/chat/user/:userId`

**Response:**
```json
{
  "success": true,
  "message": "Chat history deleted successfully"
}
```

#### 4. Get Chat Statistics
**GET** `/chat/stats`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalMessages": 150,
    "uniqueUsers": 25,
    "unreadMessages": 12,
    "messagesLast7Days": 45
  }
}
```

## Frontend Implementation Example

### React Component Example
```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const ChatComponent = ({ token, userRole }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Connect to Socket.IO
    const newSocket = io('http://localhost:3000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
      if (userRole === 'user') {
        newSocket.emit('join_chat');
      }
    });

    newSocket.on('chat_history', (data) => {
      setMessages(data.messages);
    });

    newSocket.on('new_message', (data) => {
      setMessages(prev => [...prev, data.message]);
    });

    newSocket.on('user_typing', () => {
      setIsTyping(true);
    });

    newSocket.on('user_stop_typing', () => {
      setIsTyping(false);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [token, userRole]);

  const sendMessage = () => {
    if (newMessage.trim() && socket) {
      socket.emit('send_message', {
        message: newMessage,
        recipient_id: userRole === 'admin' ? selectedUserId : null
      });
      setNewMessage('');
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing', {
        recipient_id: userRole === 'admin' ? selectedUserId : null
      });
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender_role}`}>
            <p>{msg.message}</p>
            <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
          </div>
        ))}
        {isTyping && <div className="typing-indicator">Someone is typing...</div>}
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleTyping}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};
```

## Security Considerations

1. **Authentication:** All Socket.IO connections require valid JWT tokens
2. **Authorization:** Users can only access their own chat history
3. **Input Validation:** Messages are validated before saving
4. **Rate Limiting:** Consider implementing rate limiting for message sending
5. **CORS:** Configure CORS properly for your frontend domain

## Error Handling

- All Socket.IO events include error handling
- Database errors are logged and handled gracefully
- Invalid tokens result in connection rejection
- Network errors are handled with reconnection logic

## Performance Considerations

1. **Message Pagination:** Implement pagination for large chat histories
2. **Connection Pooling:** Monitor Socket.IO connection limits
3. **Database Indexing:** Proper indexes for fast queries
4. **Message Cleanup:** Consider archiving old messages
5. **Real-time Updates:** Use efficient event emission

## Deployment Notes

1. **Environment Variables:**
   ```
   JWT_SECRET=your_jwt_secret
   FRONTEND_URL=http://your-frontend-domain.com
   ```

2. **Socket.IO Configuration:**
   - Configure CORS for production
   - Set up proper SSL certificates
   - Configure load balancers for Socket.IO

3. **Database:**
   - Run the SQL schema creation
   - Set up proper backups
   - Monitor performance 