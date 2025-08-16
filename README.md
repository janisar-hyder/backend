# Crypto Site Backend

## Overview
This backend powers a crypto investment platform with the following features:

- User registration and OTP verification
- Unified login for both users and admins (with OTP)
- Password reset with OTP
- Admin authentication and management
- KYC verification via Sumsub
- Plan purchase and ROI tracking
- Payment webhook integration (NOWPayments)
- Review system for users and admins
- Referral system
- Real-time chat between users and admins (Socket.IO)
- Withdrawals

---

## Main Functionalities

### 1. **Authentication**
- User registration and OTP verification
- Unified login for both users and admins (with OTP)
- Password reset with OTP

### 2. **KYC Verification**
- Users can start KYC and are redirected to Sumsub
- Webhook endpoint to receive KYC status from Sumsub

### 3. **Plans**
- Users can buy and track investment plans
- ROI (Return on Investment) is tracked per user and plan

### 4. **Payment Webhook**
- Receives payment status from NOWPayments via webhook

### 5. **Review System**
- Users can submit, update, and delete reviews
- Admins can approve, reject, or delete reviews

### 6. **Referral System**
- Users can refer others and earn referral bonuses

### 7. **Chat System**
- Real-time chat between users and admins using Socket.IO
- Chat history and unread count endpoints

### 8. **Admin Management**
- Admins can view users, manage withdrawals, and review user activity

---

## Database Tables & SQL

### **Only the following tables are necessary for all backend functionalities:**
- admins
- profiles
- chat_messages
- reviews
- roi_history
- referral_earnings
- withdraw_request

**The following tables are NOT required and should be dropped for efficiency:**
- plan_purchase (plan purchases are tracked in `profiles` and `roi_history`)
- roi_earnings (ROI is tracked in `roi_history` and as a field in `profiles`)
- user_roi (ROI per user is handled by `roi_history`)
- plan_cancellations (plan cancellation is no longer supported)

---

### 1. **admins**
```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. **profiles**
```sql
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  firstname VARCHAR(100),
  lastname VARCHAR(100),
  kyc BOOLEAN DEFAULT FALSE,
  referral_code VARCHAR(20),
  referred_by UUID,
  referral_earnings NUMERIC DEFAULT 0,
  plan_bought VARCHAR(50),
  plan_start_date TIMESTAMP,
  plan_end_date TIMESTAMP,
  roi_earnings NUMERIC DEFAULT 0,
  account_balance NUMERIC DEFAULT 0,
  last_roi_calculation TIMESTAMP,
  current_monthly_roi NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. **chat_messages**
```sql
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID,
  recipient_id UUID,
  message TEXT NOT NULL,
  sender_role VARCHAR(10) NOT NULL, -- 'user' or 'admin'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. **reviews**
```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5. **roi_history**
```sql
CREATE TABLE roi_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type VARCHAR(50),
  roi_percentage NUMERIC NOT NULL,
  roi_amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 6. **referral_earnings**
```sql
CREATE TABLE referral_earnings (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7. **withdraw_request**
```sql
CREATE TABLE withdraw_request (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'declined'
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints (Key Flows)

### Registration
- `POST /auth/register-details` — Start registration, sends OTP
- `POST /auth/register-verify` — Verify OTP and create user

### Unified Login (User & Admin)
- `POST /auth/login-unified` — Request OTP for login
- `POST /auth/login-unified-verify` — Verify OTP and receive JWT

### Password Reset
- `POST /auth/request-password-reset` — Request OTP for password reset
- `POST /auth/verify-password-reset` — Verify OTP and set new password

### KYC
- `POST /profile/kyc/start` — Start KYC (redirect to Sumsub)
- `POST /profile/kyc/webhook` — Webhook for KYC status

### Plans
- `POST /plan/buy` — Buy a plan
- `POST /plan/confirm-payment` — Confirm payment (webhook)
- `GET /plan/my-plan` — Get current plan details
- `GET /plan/calculate-roi` — Admin: calculate ROI for all users

### Reviews
- `POST /reviews/submit` — Submit review
- `PUT /reviews/update` — Update review
- `DELETE /reviews/delete` — Delete review
- `GET /reviews/all` — Get all reviews
- `GET /reviews/my-review` — Get user's review

### Referrals
- `GET /referral/info` — Get referral info
- `GET /referral/earnings` — Get referral earnings

### Chat
- `GET /chat/history` — Get chat history
- `POST /chat/mark-read` — Mark messages as read
- `GET /chat/unread-count` — Get unread count
- (Socket.IO events for real-time messaging)

### Withdrawals
- `POST /admin/withdraws/:id/approve` — Approve withdrawal
- `POST /admin/withdraws/:id/decline` — Decline withdrawal
- `GET /admin/withdraws` — Get all withdrawal requests

---

## Webhook Endpoints
- `/plan/payment/webhook` — Receives payment status from NOWPayments
- `/profile/kyc/webhook` — Receives KYC status from Sumsub

---

## Real-time Chat
- Socket.IO events for sending/receiving messages between users and admins

---

## How to Run
- Install dependencies: `npm install`
- Start backend: `npm start`

---

## Environment Variables
- Configure your `.env` file for backend as needed (see code for required variables)

---

## Database Cleanup
To keep your database efficient, drop these tables if they exist:
```sql
DROP TABLE IF EXISTS plan_purchase;
DROP TABLE IF EXISTS roi_earnings;
DROP TABLE IF EXISTS user_roi;
DROP TABLE IF EXISTS plan_cancellations;
```

---

## License
MIT 

---

## How to Fix

### 1. **Check Where User Passwords Are Stored**
- If your user passwords are in the `user_profile` table, but your backend queries `profiles`, you need to:
  - Either migrate all users to the `profiles` table (recommended for consistency)
  - Or update your unified login code to check `user_profile` instead of `profiles`

### 2. **Recommended: Use Only One Table**
- For a clean backend, you should have only one user table (usually `profiles`).
- If you want to keep using `profiles`, migrate all users (and their password hashes) from `user_profile` to `profiles`.

---

## 3. **Quick Fix for Unified Login (if you want to support both for now)**

You can update your unified login code to check both tables:

```js
<code_block_to_apply_changes_from>
```

Then continue with the password check as before.

---

## 4. **Best Practice**
- **Migrate all users to the `profiles` table** and remove `user_profile` for a clean, maintainable backend.

---

## What Should You Do?
- **For a quick fix:** Update the unified login to check both tables as shown above.
- **For a long-term solution:** Migrate all users to the `profiles` table and drop `user_profile`.

---

Would you like me to:
- Update your unified login to check both tables?
- Provide a migration script to move users from `user_profile` to `profiles`?
- Or both?

Let me know how you want to proceed! 