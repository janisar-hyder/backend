import dotenv from 'dotenv'
import express from 'express'

dotenv.config()

import authRoutes from './src/routes/auth.js'

const app = express()
app.use(express.json())

// Ping test
app.get('/ping', (req, res) => res.send('pong'))

// Routes
app.use('/auth', authRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
})
