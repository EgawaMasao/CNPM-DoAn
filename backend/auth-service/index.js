require('dotenv').config();
const express = require('express');
const cors = require('cors');  
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');

const app = express();

// Cho phép cả localhost (dev) và service name (docker)
const allowedOrigins = [
  "http://localhost:3000",           // Browser gọi khi dev local
  "http://frontend:3000",            // Container gọi trong Docker
  "http://frontend-app:3000",        // Container name backup
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({ 
  origin: function(origin, callback) {
    // Cho phép requests không có origin (mobile apps, postman, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

app.use(express.json());

// Connect DB then start
connectDB().then(() => {
  app.use('/api/auth', authRoutes);

  app.get("/", (req, res) => {
    res.send("Auth Service is running 🚀");
  });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Auth Service running on port ${PORT}`);
  });
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err);
  process.exit(1);
});