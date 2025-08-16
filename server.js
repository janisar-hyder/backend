import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { initializeSocket } from './src/socket/chatServer.js';
import chatRoutes from './src/routes/chat.js';
import authRoutes from './src/routes/auth.js';
import planRoutes from './src/routes/plan.js';
import withdrawRoutes from './src/routes/withdraw.js';
import reviewRoutes from './src/routes/review.js';
import roiRoutes from './src/routes/roiHistory.js';
import infoRouter from './src/routes/info.js';
import profileRouter from './src/routes/profile.js';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const server = createServer(app);

// =============================================
// Enhanced Security Middleware
// =============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", process.env.FRONTEND_URL],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
      connectSrc: ["'self'", process.env.FRONTEND_URL, 'https://*.supabase.co'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cookieParser());

// =============================================
// Rate Limiting Configuration
// =============================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later'
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit auth endpoints more strictly
  message: 'Too many login attempts, please try again later'
});

// =============================================
// Enhanced CORS Configuration (Updated)
// =============================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  "https://thegoldinvest.netlify.app/",
  "https://thegoldinvest.netlify.app/admin",
].filter(Boolean); // Remove any undefined values

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept',
    'Cache-Control' // Explicitly allow Cache-Control header
  ],
  exposedHeaders: ['Authorization', 'X-Total-Count'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware with updated options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// =============================================
// Request Processing Middleware
// =============================================
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use(express.json({
  limit: '10kb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10kb',
  parameterLimit: 50
}));

// =============================================
// WebSocket Initialization
// =============================================
const io = initializeSocket(server);
app.set('io', io); // Make io instance available in routes

// =============================================
// Rate Limit Application
// =============================================
app.use('/api/', apiLimiter);
app.use('/auth', authLimiter);

// =============================================
// API Routes
// =============================================
app.use('/api/chat', chatRoutes);
app.use('/auth', authRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/roi', roiRoutes);
app.use('/api/info', infoRouter);
app.use('/api/kyc', profileRouter);

// =============================================
// Health Check Endpoints
// =============================================
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'Connected',
    websocket: io.engine.clientsCount !== undefined ? 'Active' : 'Inactive',
    memoryUsage: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    message: 'Investment Platform API',
    endpoints: {
      auth: '/auth',
      chat: '/api/chat',
      plans: '/api/plan',
      health: '/api/health'
    },
    version: process.env.npm_package_version || '1.0.0',
    documentation: process.env.API_DOCS_URL || 'Coming soon'
  });
});

// =============================================
// Error Handling Middleware
// =============================================
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log the error with request context
  console.error('🚨 Error:', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    error: err.message,
    stack: !isProduction ? err.stack : undefined,
    ...(err.code && { code: err.code }),
    ...(err.statusCode && { statusCode: err.statusCode })
  });

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: statusCode === 500 ? 'Internal Server Error' : err.message,
    ...(!isProduction && { 
      stack: err.stack,
      details: err.details 
    })
  };

  // Handle JWT errors specifically
  if (err.name === 'JsonWebTokenError') {
    response.message = 'Invalid token';
    response.code = 'INVALID_TOKEN';
  }

  res.status(statusCode).json(response);
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    requestedUrl: req.originalUrl,
    availableEndpoints: {
      auth: '/auth',
      chat: '/api/chat',
      plans: '/api/plan',
      health: '/api/health'
    }
  });
});

// =============================================
// Server Configuration
// =============================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Start Server
server.listen(PORT, HOST, () => {
  console.log(`
  🚀 Server running on port ${PORT}
  🌍 Environment: ${process.env.NODE_ENV || 'development'}
  📡 Allowed origins:
     ${allowedOrigins.join('\n     ')}
  🔌 WebSocket: ${io ? 'Enabled' : 'Disabled'}
  🔒 Security:
     - CORS: ${corsOptions ? 'Enabled' : 'Disabled'}
     - Rate Limiting: ${apiLimiter ? 'Enabled' : 'Disabled'}
     - Helmet: ${helmet ? 'Enabled' : 'Disabled'}
  `);

  // Event listeners for server events
  server.on('error', (error) => {
    console.error('💥 Server error:', error);
    process.exit(1);
  });

  server.on('listening', () => {
    console.log('👂 Server is listening for connections');
  });
});

// =============================================
// Graceful Shutdown
// =============================================
const shutdown = (signal) => {
  console.log(`🛑 ${signal} received. Shutting down gracefully...`);
  
  // Close WebSocket connections
  if (io) {
    io.close(() => {
      console.log('🔌 WebSocket server closed');
    });
  }

  // Close HTTP server
  server.close(() => {
    console.log('🔴 HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('🕑 Could not close connections in time, forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;