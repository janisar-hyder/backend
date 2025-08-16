# Random ROI System API Documentation

## Overview
This document describes the random ROI (Return on Investment) system that generates variable monthly returns within specified ranges for each investment plan, making the returns more realistic and unpredictable.

## Business Logic
- Each plan has a specific ROI range instead of a fixed percentage
- ROI is calculated randomly within the range each month
- Historical ROI data is tracked for transparency and analytics
- Users can view their ROI history and statistics

## Plan ROI Ranges

### Plan A
- **Duration:** 5 months
- **ROI Range:** 4.0% to 4.5% monthly
- **Investment:** $100

### Plan B
- **Duration:** 3 months
- **ROI Range:** 4.8% to 5.2% monthly
- **Investment:** $200

### Plan C
- **Duration:** 1 month
- **ROI Range:** 5.0% to 5.5% monthly
- **Investment:** $500

## API Endpoints

### 1. Get Plan Details (Updated)
**GET** `/plan/my-plan`

Returns current plan details including ROI range and current monthly ROI.

**Response:**
```json
{
  "hasPlan": true,
  "currentPlan": {
    "type": "Plan A",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-06-01T00:00:00Z",
    "monthsRemaining": 3,
    "currentMonthlyROI": 4.23,
    "roiRange": {
      "min": 4.0,
      "max": 4.5
    },
    "totalEarned": 12.45,
    "principalReturn": 0
  },
  "planDetails": {
    "durationMonths": 5,
    "roiRange": {
      "min": 4.0,
      "max": 4.5
    },
    "price": 100
  }
}
```

### 2. Get ROI History
**GET** `/roi-history/my-history`

Retrieves user's complete ROI history across all plans.

**Response:**
```json
{
  "success": true,
  "roiHistory": [
    {
      "id": 1,
      "user_id": "uuid",
      "plan_type": "Plan A",
      "month_number": 1,
      "roi_percentage": 4.23,
      "roi_amount": 4.23,
      "calculated_at": "2024-02-01T00:00:00Z"
    },
    {
      "id": 2,
      "user_id": "uuid",
      "plan_type": "Plan A",
      "month_number": 2,
      "roi_percentage": 4.17,
      "roi_amount": 4.17,
      "calculated_at": "2024-03-01T00:00:00Z"
    }
  ]
}
```

### 3. Get Plan-Specific ROI History
**GET** `/roi-history/plan/:planType`

Retrieves ROI history for a specific plan with statistics.

**Response:**
```json
{
  "success": true,
  "planType": "Plan A",
  "roiHistory": [
    {
      "id": 1,
      "user_id": "uuid",
      "plan_type": "Plan A",
      "month_number": 1,
      "roi_percentage": 4.23,
      "roi_amount": 4.23,
      "calculated_at": "2024-02-01T00:00:00Z"
    }
  ],
  "statistics": {
    "totalMonths": 1,
    "totalEarned": "4.23",
    "averageROI": "4.23",
    "highestROI": "4.23",
    "lowestROI": "4.23"
  }
}
```

### 4. Get ROI Statistics (Admin)
**GET** `/roi-history/stats`

Retrieves overall ROI statistics for admin purposes.

**Response:**
```json
{
  "success": true,
  "overallStats": {
    "totalROI": "1250.45",
    "averageROI": "4.67",
    "totalMonths": 268
  },
  "planStats": {
    "Plan A": {
      "totalEarned": "450.23",
      "totalMonths": 100,
      "averageROI": "4.25"
    },
    "Plan B": {
      "totalEarned": "500.12",
      "totalMonths": 100,
      "averageROI": "5.00"
    },
    "Plan C": {
      "totalEarned": "300.10",
      "totalMonths": 68,
      "averageROI": "5.25"
    }
  }
}
```

## Database Schema

### Updated Table: `profiles`
```sql
-- Add new column for current monthly ROI
ALTER TABLE profiles ADD COLUMN current_monthly_roi NUMERIC(5,2);
```

### New Table: `roi_history`
```sql
CREATE TABLE roi_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  plan_type TEXT NOT NULL,
  month_number INTEGER NOT NULL,
  roi_percentage NUMERIC(5,2) NOT NULL,
  roi_amount NUMERIC(10,2) NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_roi_history_user_id ON roi_history(user_id);
CREATE INDEX idx_roi_history_plan_type ON roi_history(plan_type);
CREATE INDEX idx_roi_history_calculated_at ON roi_history(calculated_at);
```

## ROI Calculation Process

### Monthly Calculation
1. **Generate Random ROI:** Each month, a random percentage is generated within the plan's range
2. **Calculate Earnings:** `monthly_earnings = investment_amount × (roi_percentage / 100)`
3. **Store History:** ROI data is stored in `roi_history` table
4. **Update Profile:** User's total earnings and current monthly ROI are updated

### Example Calculation
**Plan A - Month 1:**
- Investment: $100
- Random ROI: 4.23% (generated between 4.0% and 4.5%)
- Monthly Earnings: $100 × (4.23 / 100) = $4.23

**Plan A - Month 2:**
- Investment: $100
- Random ROI: 4.17% (generated between 4.0% and 4.5%)
- Monthly Earnings: $100 × (4.17 / 100) = $4.17
- Total Earnings: $4.23 + $4.17 = $8.40

## Random Number Generation
The system uses JavaScript's `Math.random()` function to generate random ROI percentages:
```javascript
const generateRandomROI = (roiRange) => {
  const min = roiRange.min
  const max = roiRange.max
  return Math.random() * (max - min) + min
}
```

## Benefits of Random ROI System
1. **Realistic Returns:** Mimics real-world investment volatility
2. **User Engagement:** Creates anticipation for monthly returns
3. **Risk Management:** Predictable ranges while maintaining uncertainty
4. **Transparency:** Complete history tracking for users
5. **Analytics:** Rich data for business intelligence

## Error Handling
- All ROI calculations are wrapped in try-catch blocks
- Database errors are logged and handled gracefully
- Invalid ROI ranges are validated before calculation
- Historical data integrity is maintained

## Security Considerations
- ROI history is user-specific and protected by authentication
- Admin statistics require proper authorization
- Random number generation is server-side only
- All financial calculations use precise decimal arithmetic 