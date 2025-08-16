# Admin API Documentation

## Overview
This document describes the admin API endpoints for user management, withdrawal requests, and admin authentication.

## Admin Authentication

### 1. Admin Login (Step 1: Request OTP)
**POST** `/admin/login`

Request OTP for admin login.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin_password"
}
```

**Response:**
```json
{
  "message": "OTP sent to admin email"
}
```

### 2. Verify Admin OTP (Step 2: Complete Login)
**POST** `/admin/verify-otp`

Verify OTP and get admin access token.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "message": "Admin verified",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## User Management

### 3. Get All Users
**GET** `/admin/users`

Retrieve all registered users.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "users": [
    {
      "user_id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "created_at": "2024-01-15T10:30:00Z",
      "plan_bought": "Plan A",
      "account_balance": 100.00
    }
  ]
}
```

## Withdrawal Management

### 4. Get Withdrawal Requests
**GET** `/admin/withdraws`

Get all withdrawal requests.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "withdraws": [
    {
      "id": 1,
      "user_id": "uuid",
      "amount": 50.00,
      "status": "pending",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 5. Approve Withdrawal
**POST** `/admin/withdraws/:id/approve`

Approve a withdrawal request.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "withdraw": {
    "id": 1,
    "user_id": "uuid",
    "amount": 50.00,
    "status": "approved",
    "updated_at": "2024-01-15T12:00:00Z"
  }
}
```

### 6. Decline Withdrawal
**POST** `/admin/withdraws/:id/decline`

Decline a withdrawal request.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "withdraw": {
    "id": 1,
    "user_id": "uuid",
    "amount": 50.00,
    "status": "declined",
    "updated_at": "2024-01-15T12:00:00Z"
  }
}
```

## Database Schema

### Table: `admins`
```sql
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Table: `withdraw_requests`
```sql
CREATE TABLE withdraw_requests (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_withdraw_requests_user_id ON withdraw_requests(user_id);
CREATE INDEX idx_withdraw_requests_status ON withdraw_requests(status);
CREATE INDEX idx_withdraw_requests_created_at ON withdraw_requests(created_at);
```

## Security Considerations

1. **Admin Authentication:** Two-factor authentication with OTP
2. **JWT Tokens:** Secure admin access tokens
3. **Password Hashing:** Bcrypt for admin passwords
4. **Authorization:** Admin-only endpoints
5. **Input Validation:** Validate all admin inputs

## Error Handling

### Common Error Responses
- `400` - Missing required fields
- `401` - Invalid credentials or unauthorized
- `404` - Resource not found
- `500` - Server error

### Authentication Errors
- "Email and password required"
- "Invalid credentials"
- "Invalid or expired OTP"
- "Admin not found"

## Usage Example

### Admin Login Flow
```javascript
// Step 1: Request OTP
const loginResponse = await fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'admin_password'
  })
});

// Step 2: Verify OTP
const otpResponse = await fetch('/api/admin/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    otp: '123456'
  })
});

const { token } = await otpResponse.json();

// Use token for admin operations
const usersResponse = await fetch('/api/admin/users', {
  headers: { Authorization: `Bearer ${token}` }
});
```

## Environment Variables

```env
ADMIN_JWT_SECRET=your_admin_jwt_secret_here
```

## Notes

- Admin OTP is logged to console for development
- Implement proper email/SMS for OTP in production
- Add rate limiting for admin login attempts
- Consider implementing admin session management
- Add audit logging for admin actions 