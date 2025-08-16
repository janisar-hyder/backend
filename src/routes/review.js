import express from 'express'
import { 
  submitReview,
  getAllReviews,
  getUserReview,
  updateReview,
  deleteReview,
  getReviewStats
} from '../controllers/review.js'
import { verifyToken } from '../middlewares/auth.js'

const router = express.Router()

// Public routes (no authentication required)
router.get('/all', getAllReviews)
// router.get('/stats', getReviewStats)

// Protected routes (require authentication)
router.post('/submit', verifyToken, submitReview)
// router.p, submitReview)
// router.get('/my-review', veut('/update', verifyToken, updateReview)
// router.delete('/delete', verifyToken, deleteReview)

export default router 