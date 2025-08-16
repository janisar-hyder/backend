import { supabase } from '../config/supabase.js'

// Submit a review (registered users only)
export const submitReview = async (req, res) => {
  const userId = req.user.id;
  const { rating, comment } = req.body;

  try {
    // First check if user already has a review
    const { data: existingReview, error: checkError } = await supabase
      .from('reviews')
      .select('id, comment, rating, username, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('[REVIEW CHECK ERROR]', checkError);
      throw new Error('Failed to check existing reviews');
    }

    // If review exists, return error with existing review
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'Already review exists',
        review: {
          id: existingReview.id,
          comment: existingReview.comment,
          rating: existingReview.rating,
          username: existingReview.username,
          created_at: existingReview.created_at
        }
      });
    }

    // Validate input for new reviews
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid rating',
        details: 'Rating must be a number between 1 and 5'
      });
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length < 10) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid comment',
        details: 'Comment must be at least 10 characters long'
      });
    }

    // Get user profile data for new review
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('firstname, lastname')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('[PROFILE FETCH ERROR]', profileError);
      throw new Error('Failed to fetch user profile');
    }

    const fullName = `${profile.firstname || ''} ${profile.lastname || ''}`.trim() || 'Anonymous';

    // Submit new review
    const { data: newReview, error: insertError } = await supabase
      .from('reviews')
      .insert({
        user_id: userId,
        username: fullName,
        comment: comment.trim(),
        rating: Math.floor(rating),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, username, comment, rating, created_at')
      .single();

    if (insertError) {
      console.error('[REVIEW INSERT ERROR]', insertError);
      throw new Error('Failed to submit review');
    }

    return res.json({
      success: true,
      message: 'Thank you for your review!',
      review: {
        ...newReview,
        created_at: newReview.created_at
      }
    });

  } catch (error) {
    console.error('[SUBMIT REVIEW ERROR]', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to process review',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
};


// Get all approved reviews (public endpoint - no auth required)
export const getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'newest' } = req.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('reviews')
      .select('*') // Removed `.eq('is_approved', true)`

    // Apply sorting
    if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true })
    } else if (sort === 'rating_high') {
      query = query.order('rating', { ascending: false })
    } else if (sort === 'rating_low') {
      query = query.order('rating', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false }) // Default: newest first
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: reviews, error } = await query
    if (error) throw error

    // Get total count for pagination (removed .eq for is_approved)
    const { count: totalCount, error: countError } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    return res.json({
      success: true,
      reviews: reviews || [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalReviews: totalCount,
        hasNextPage: offset + limit < totalCount,
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('[GET ALL REVIEWS ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to get reviews',
      details: error.message
    })
  }
}


// Get user's own review (if exists)
export const getUserReview = async (req, res) => {
  const userId = req.user.id

  try {
    const { data: review, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No review found
      return res.json({
        success: true,
        hasReview: false,
        review: null
      })
    }

    if (error) throw error

    return res.json({
      success: true,
      hasReview: true,
      review: {
        id: review.id,
        title: review.title,
        comment: review.comment,
        rating: review.rating,
        username: review.username,
        is_approved: review.is_approved,
        created_at: review.created_at
      }
    })

  } catch (error) {
    console.error('[GET USER REVIEW ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to get user review',
      details: error.message
    })
  }
}

// Update user's review
export const updateReview = async (req, res) => {
  const userId = req.user.id
  const { rating, comment, title } = req.body

  try {
    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' })
    }

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({ error: 'Comment must be at least 10 characters long' })
    }

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ error: 'Title must be at least 3 characters long' })
    }

    // Check if user has a review
    const { data: existingReview, error: checkError } = await supabase
      .from('reviews')
      .select('id, is_approved')
      .eq('user_id', userId)
      .single()

    if (checkError && checkError.code === 'PGRST116') {
      return res.status(404).json({ error: 'No review found to update' })
    }

    if (checkError) throw checkError

    // Update the review
    const { data: review, error } = await supabase
      .from('reviews')
      .update({
        title: title.trim(),
        comment: comment.trim(),
        rating: parseInt(rating),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return res.json({
      success: true,
      message: 'Review updated successfully',
      review: {
        id: review.id,
        title: review.title,
        comment: review.comment,
        rating: review.rating,
        username: review.username,
        is_approved: review.is_approved,
        created_at: review.created_at,
        updated_at: review.updated_at
      }
    })

  } catch (error) {
    console.error('[UPDATE REVIEW ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to update review',
      details: error.message
    })
  }
}

// Delete user's review
export const deleteReview = async (req, res) => {
  const userId = req.user.id

  try {
    // Check if user has a review
    const { data: existingReview, error: checkError } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (checkError && checkError.code === 'PGRST116') {
      return res.status(404).json({ error: 'No review found to delete' })
    }

    if (checkError) throw checkError

    // Delete the review
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('user_id', userId)

    if (error) throw error

    return res.json({
      success: true,
      message: 'Review deleted successfully'
    })

  } catch (error) {
    console.error('[DELETE REVIEW ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to delete review',
      details: error.message
    })
  }
}

// Get review statistics
export const getReviewStats = async (req, res) => {
  try {
    // Get total reviews
    const { count: totalReviews, error: totalError } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('is_approved', true)

    if (totalError) throw totalError

    // Get average rating
    const { data: avgRating, error: avgError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('is_approved', true)

    if (avgError) throw avgError

    const averageRating = avgRating.length > 0 
      ? avgRating.reduce((sum, review) => sum + review.rating, 0) / avgRating.length 
      : 0

    // Get rating distribution
    const ratingDistribution = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    }

    avgRating.forEach(review => {
      ratingDistribution[review.rating]++
    })

    // Get recent reviews (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentReviews, error: recentError } = await supabase
      .from('reviews')
      .select('created_at')
      .eq('is_approved', true)
      .gte('created_at', thirtyDaysAgo.toISOString())

    if (recentError) throw recentError

    return res.json({
      success: true,
      stats: {
        totalReviews: totalReviews || 0,
        averageRating: parseFloat(averageRating.toFixed(1)),
        ratingDistribution,
        recentReviews: recentReviews?.length || 0
      }
    })

  } catch (error) {
    console.error('[GET REVIEW STATS ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to get review statistics',
      details: error.message
    })
  }
} 