# Plan Cancellation API Documentation

## Overview
This document describes the plan cancellation functionality that allows users to cancel their active investment plans before the duration ends, with a 10% penalty applied to the initial investment amount.

## Business Logic
- Users can cancel their plan at any time before the plan duration ends
- A 10% penalty is applied to the initial investment amount
- The remaining amount (90% of initial investment) is added to the user's account balance
- Any ROI earned so far is also added to the account balance
- The plan is completely removed from the user's profile

## API Endpoints

### 1. Cancel Plan
**POST** `/plan/cancel`

Cancels the user's active plan and processes the refund with penalty.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:** None required

**Response:**
```json
{
  "success": true,
  "message": "Plan cancelled successfully",
  "details": {
    "cancelledPlan": "Plan A",
    "monthsPassed": 3,
    "roiEarned": 30.00,
    "penaltyAmount": "10.00",
    "refundAmount": "90.00",
    "totalAddedToBalance": "120.00",
    "newAccountBalance": "220.00"
  }
}
```

**Error Responses:**
- `400` - No active plan to cancel
- `400` - Plan has already ended
- `500` - Server error

### 2. Get Cancellation History
**GET** `/plan-cancellation/history`

Retrieves the user's plan cancellation history.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "cancellations": [
    {
      "id": 1,
      "user_id": "uuid",
      "plan_type": "Plan A",
      "cancelled_at": "2024-01-15T10:30:00Z",
      "months_passed": 3,
      "roi_earned": 30.00,
      "penalty_amount": 10.00,
      "refund_amount": 90.00,
      "total_added_to_balance": 120.00
    }
  ]
}
```

### 3. Get Cancellation Statistics (Admin)
**GET** `/plan-cancellation/stats`

Retrieves cancellation statistics for admin purposes.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalCancellations": 25,
    "totalPenalty": "250.00",
    "totalRefund": "2250.00",
    "byPlanType": {
      "Plan A": {
        "count": 10,
        "totalPenalty": 100.00,
        "totalRefund": 900.00
      },
      "Plan B": {
        "count": 15,
        "totalPenalty": 150.00,
        "totalRefund": 1350.00
      }
    }
  }
}
```

## Database Schema

### New Table: `plan_cancellations`
```sql
CREATE TABLE plan_cancellations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  plan_type TEXT NOT NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  months_passed INTEGER NOT NULL,
  roi_earned NUMERIC(10,2) NOT NULL,
  penalty_amount NUMERIC(10,2) NOT NULL,
  refund_amount NUMERIC(10,2) NOT NULL,
  total_added_to_balance NUMERIC(10,2) NOT NULL
);

-- Index for better performance
CREATE INDEX idx_plan_cancellations_user_id ON plan_cancellations(user_id);
CREATE INDEX idx_plan_cancellations_cancelled_at ON plan_cancellations(cancelled_at);
```

## Example Usage

### Example 1: User cancels Plan A after 3 months
- Initial investment: $100
- Plan duration: 5 months
- Monthly ROI: 10%
- Months passed: 3
- ROI earned: $100 × 10% × 3 = $30
- Penalty: $100 × 10% = $10
- Refund: $100 - $10 = $90
- Total added to balance: $90 + $30 = $120

### Example 2: User cancels Plan B after 1 month
- Initial investment: $200
- Plan duration: 3 months
- Monthly ROI: 15%
- Months passed: 1
- ROI earned: $200 × 15% × 1 = $30
- Penalty: $200 × 10% = $20
- Refund: $200 - $20 = $180
- Total added to balance: $180 + $30 = $210

## Error Handling
- All endpoints include proper error handling
- Cancellation tracking errors don't affect the main cancellation process
- Detailed error messages are returned for debugging

## Security Considerations
- All endpoints require authentication via JWT token
- Admin statistics endpoint should be protected with admin middleware
- Input validation is performed on all endpoints
- Database operations are wrapped in try-catch blocks 