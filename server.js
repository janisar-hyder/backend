import express from 'express'
import dotenv from 'dotenv'
dotenv.config()

import authRoutes from './src/routes/auth.js'
import profileRoutes from './src/routes/profile.js' // ⬅️ Import new route

const app = express()
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/api/profile', profileRoutes) // ⬅️ Protected route

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`))
