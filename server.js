import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import authRoutes from './src/routes/auth.js'
import profileRoutes from './src/routes/profile.js'
import planRoutes from './src/routes/plan.js' // ✅ Import
import referralRoutes from './src/routes/referral.js' // ✅ Import

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Routes
app.use('/auth', authRoutes)
app.use('/profile', profileRoutes)
app.use('/plan', planRoutes) // ✅ Use plan route
app.use('/referral', referralRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
})
