# Review System API Documentation

## Overview
This document describes the review system that allows registered users to submit one review each, while both registered and non-registered users can view all approved reviews. The system includes admin moderation capabilities and comprehensive statistics.

## Features
- **One Review Per User:** Each registered user can only submit one review
- **Public Viewing:** All users (registered and non-registered) can view approved reviews
- **Admin Moderation:** Admins can approve, reject, and manage reviews
- **Review Management:** Users can update and delete their own reviews
- **Statistics:** Comprehensive review analytics and ratings
- **Pagination:** Efficient handling of large numbers of reviews
- **Sorting Options:** Multiple sorting methods for reviews

## Database Schema

### Table: `reviews`
```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  is_approved BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_is_approved ON reviews(is_approved);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Unique constraint to ensure one review per user
CREATE UNIQUE INDEX idx_reviews_user_unique ON reviews(user_id);
```

## Public API Endpoints

### 1. Get All Reviews (Public)
**GET** `/reviews/all`

Retrieves all approved reviews with pagination and sorting options.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Reviews per page (default: 10, max: 50)
- `sort` (optional): Sorting method
  - `newest` (default): Most recent first
  - `oldest`: Oldest first
  - `rating_high`: Highest rating first
  - `rating_low`: Lowest rating first

**Response:**
```json
{
  "success": true,
  "reviews": [
    {
      "id": 1,
      "user_id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "title": "Great Investment Platform",
      "comment": "This platform has exceeded my expectations. The ROI is consistent and the support team is very helpful.",
      "rating": 5,
      "is_approved": true,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalReviews": 50,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 2. Get Review Statistics (Public)
**GET** `/reviews/stats`

Retrieves public review statistics including average rating and distribution.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalReviews": 150,
    "averageRating": 4.2,
    "ratingDistribution": {
      "1": 5,
      "2": 8,
      "3": 15,
      "4": 45,
      "5": 77
    },
    "recentReviews": 25
  }
}
```

## User API Endpoints (Authentication Required)

### 3. Submit Review
**POST** `/reviews/submit`

Submit a new review (one per user).

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Amazing Platform",
  "comment": "I have been using this platform for 6 months and the returns are fantastic. Highly recommended!",
  "rating": 5
}
```

**Validation Rules:**
- `title`: Minimum 3 characters
- `comment`: Minimum 10 characters
- `rating`: Must be between 1 and 5
- User can only submit one review

**Response:**
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "review": {
    "id": 1,
    "title": "Amazing Platform",
    "comment": "I have been using this platform for 6 months and the returns are fantastic. Highly recommended!",
    "rating": 5,
    "username": "john_doe",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**
- `400` - You have already submitted a review
- `400` - Validation errors (title, comment, rating)
- `401` - Unauthorized

### 4. Get User's Review
**GET** `/reviews/my-review`

Get the current user's review (if exists).

**Response:**
```json
{
  "success": true,
  "hasReview": true,
  "review": {
    "id": 1,
    "title": "Amazing Platform",
    "comment": "I have been using this platform for 6 months...",
    "rating": 5,
    "username": "john_doe",
    "is_approved": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### 5. Update Review
**PUT** `/reviews/update`

Update the user's existing review.

**Request Body:**
```json
{
  "title": "Updated Title",
  "comment": "Updated comment with more details about my experience.",
  "rating": 4
}
```

**Response:**
```json
{
  "success": true,
  "message": "Review updated successfully",
  "review": {
    "id": 1,
    "title": "Updated Title",
    "comment": "Updated comment with more details about my experience.",
    "rating": 4,
    "username": "john_doe",
    "is_approved": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:30:00Z"
  }
}
```

### 6. Delete Review
**DELETE** `/reviews/delete`

Delete the user's review.

**Response:**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

## Admin API Endpoints

### 7. Get All Reviews (Admin)
**GET** `/admin/reviews/all`

Get all reviews with admin filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Reviews per page (default: 20)
- `status` (optional): Filter by status
  - `all` (default): All reviews
  - `approved`: Only approved reviews
  - `pending`: Only pending reviews

**Response:**
```json
{
  "success": true,
  "reviews": [
    {
      "id": 1,
      "user_id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "title": "Great Platform",
      "comment": "Excellent experience...",
      "rating": 5,
      "is_approved": true,
      "rejection_reason": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalReviews": 60,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 8. Approve Review
**POST** `/admin/reviews/:reviewId/approve`

Approve a pending review.

**Response:**
```json
{
  "success": true,
  "message": "Review approved successfully",
  "review": {
    "id": 1,
    "is_approved": true,
    "updated_at": "2024-01-15T12:00:00Z"
  }
}
```

### 9. Reject Review
**POST** `/admin/reviews/:reviewId/reject`

Reject a review with optional reason.

**Request Body:**
```json
{
  "reason": "Review contains inappropriate content"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Review rejected successfully",
  "review": {
    "id": 1,
    "is_approved": false,
    "rejection_reason": "Review contains inappropriate content",
    "updated_at": "2024-01-15T12:00:00Z"
  }
}
```

### 10. Delete Review (Admin)
**DELETE** `/admin/reviews/:reviewId`

Delete a review permanently.

**Response:**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

### 11. Get Review by ID
**GET** `/admin/reviews/:reviewId`

Get a specific review by ID.

**Response:**
```json
{
  "success": true,
  "review": {
    "id": 1,
    "user_id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "title": "Great Platform",
    "comment": "Excellent experience...",
    "rating": 5,
    "is_approved": true,
    "rejection_reason": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### 12. Get Review Statistics (Admin)
**GET** `/admin/reviews/stats`

Get comprehensive review statistics for admin dashboard.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalReviews": 150,
    "approvedReviews": 120,
    "pendingReviews": 30,
    "averageRating": 4.2,
    "ratingDistribution": {
      "1": 5,
      "2": 8,
      "3": 15,
      "4": 45,
      "5": 77
    },
    "recentStats": {
      "total": 25,
      "approved": 20,
      "pending": 5
    }
  }
}
```

### 13. Bulk Approve Reviews
**POST** `/admin/reviews/bulk-approve`

Approve multiple reviews at once.

**Request Body:**
```json
{
  "reviewIds": [1, 2, 3, 4, 5]
}
```

**Response:**
```json
{
  "success": true,
  "message": "5 reviews approved successfully",
  "approvedCount": 5
}
```

### 14. Bulk Delete Reviews
**POST** `/admin/reviews/bulk-delete`

Delete multiple reviews at once.

**Request Body:**
```json
{
  "reviewIds": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "message": "3 reviews deleted successfully",
  "deletedCount": 3
}
```

## Business Rules

### User Review Constraints
1. **One Review Per User:** Each registered user can only submit one review
2. **Review Ownership:** Users can only update/delete their own reviews
3. **Approval Required:** Reviews must be approved by admin before public display
4. **Validation:** Title (min 3 chars), comment (min 10 chars), rating (1-5)

### Admin Moderation
1. **Approval Process:** Admins can approve or reject reviews
2. **Rejection Reasons:** Optional reason for rejection
3. **Bulk Operations:** Admins can approve/delete multiple reviews
4. **Statistics:** Comprehensive analytics for decision making

### Public Access
1. **View Only:** Non-registered users can view approved reviews
2. **No Submission:** Only registered users can submit reviews
3. **Statistics:** Public statistics available to all users

## Error Handling

### Common Error Responses
- `400` - Validation errors (missing fields, invalid data)
- `401` - Unauthorized (missing or invalid token)
- `404` - Review not found
- `409` - User already has a review
- `500` - Server error

### Validation Messages
- "Rating must be between 1 and 5"
- "Comment must be at least 10 characters long"
- "Title must be at least 3 characters long"
- "You have already submitted a review"

## Frontend Integration Example

### React Component for Review Submission
```javascript
import { useState, useEffect } from 'react';

const ReviewForm = ({ token }) => {
  const [formData, setFormData] = useState({
    title: '',
    comment: '',
    rating: 5
  });
  const [userReview, setUserReview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user already has a review
    fetchUserReview();
  }, []);

  const fetchUserReview = async () => {
    try {
      const response = await fetch('/api/reviews/my-review', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.hasReview) {
        setUserReview(data.review);
      }
    } catch (error) {
      console.error('Error fetching user review:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        setUserReview(data.review);
        alert('Review submitted successfully!');
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Error submitting review');
    } finally {
      setLoading(false);
    }
  };

  if (userReview) {
    return (
      <div className="review-exists">
        <h3>Your Review</h3>
        <div className="review-card">
          <h4>{userReview.title}</h4>
          <p>{userReview.comment}</p>
          <div className="rating">Rating: {userReview.rating}/5</div>
          <div className="status">
            Status: {userReview.is_approved ? 'Approved' : 'Pending'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="review-form">
      <h3>Submit Your Review</h3>
      
      <div className="form-group">
        <label>Title:</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          minLength={3}
          required
        />
      </div>

      <div className="form-group">
        <label>Rating:</label>
        <select
          value={formData.rating}
          onChange={(e) => setFormData({...formData, rating: parseInt(e.target.value)})}
        >
          <option value={5}>5 - Excellent</option>
          <option value={4}>4 - Very Good</option>
          <option value={3}>3 - Good</option>
          <option value={2}>2 - Fair</option>
          <option value={1}>1 - Poor</option>
        </select>
      </div>

      <div className="form-group">
        <label>Comment:</label>
        <textarea
          value={formData.comment}
          onChange={(e) => setFormData({...formData, comment: e.target.value})}
          minLength={10}
          required
          rows={4}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
};
```

## Security Considerations

1. **Authentication:** All user endpoints require valid JWT tokens
2. **Authorization:** Users can only manage their own reviews
3. **Input Validation:** Comprehensive validation on all inputs
4. **Rate Limiting:** Consider implementing rate limiting for review submission
5. **Content Moderation:** Admin approval system for content control

## Performance Considerations

1. **Pagination:** Efficient handling of large review datasets
2. **Indexing:** Proper database indexes for fast queries
3. **Caching:** Consider caching public review data
4. **Optimization:** Efficient queries for statistics calculation 