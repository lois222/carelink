import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/database.js';
import userRoutes from './routes/userRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import credentialRoutes from './routes/credentialRoutes.js';
import matchingRoutes from './routes/matchingRoutes.js';
import blockchainRoutes from './routes/blockchainRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { paymentWebhook } from './controllers/paymentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(helmet());

// Basic rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
});
app.use(limiter);

// Paystack webhook needs raw body for signature verification
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentWebhook);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err.message);

  // Multer-specific errors often mean invalid file or too large
  if (err.name === 'MulterError' || err.message === 'Invalid file type') {
    // choose 400 Bad Request for client-side issues
    return res.status(400).json({ message: err.message });
  }

  // if the controller set a status earlier, use it (for example res.status(400).send())
  const statusCode = err.status || 500;
  res.status(statusCode).json({ message: err.message || 'Something went wrong!' });
});

export default app;

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server (attach socket.io)
const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB connection established');

    const server = http.createServer(app);
    const io = new IOServer(server, {
      cors: {
        origin: '*',
      },
    });

    // expose io to controllers via app
    app.set('io', io);

    io.on('connection', (socket) => {
      console.log('Socket connected:', socket.id);

      socket.on('joinBooking', (bookingId) => {
        const room = `booking_${bookingId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
      });

      // allow clients to join a user-specific room for personal notifications
      socket.on('joinUser', (userId) => {
        const room = `user_${userId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined user room ${room}`);
      });

      socket.on('joinUserRoom', (roomName) => {
        // support a more explicit room name if client sends it
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room ${roomName}`);
      });

      socket.on('leaveBooking', (bookingId) => {
        const room = `booking_${bookingId}`;
        socket.leave(room);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
      });
    });

    server.listen(PORT, () => {
      console.log(`Server (with sockets) is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
