// ...existing code...
import 'dotenv/config.js';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';

import restaurantRoutes from './routes/restaurantRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import foodItemRoutes from './routes/foodItemRoutes.js';
import cors from 'cors';
import { register, metricsMiddleware } from '../metrics.js';

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://frontend:3000",
  "http://frontend-app:3000",
  "http://food-delivery.local",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({ 
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

// Middleware to parse JSON data
app.use(express.json());
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/superAdmin', superAdminRoutes);
app.use('/api/food-items', foodItemRoutes);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Test route
app.get('/', (req, res) => {
  res.send('Restaurant Service Running...');
});

// Error handling middleware
app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    message: error.message,
    stack: error.stack,
  });
});

// Export app so tests can import it without starting the server
export default app;

// Only connect to MongoDB and start listening when NOT running tests
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5002; // giữ nguyên port 5002
  mongoose.connect(process.env.MONGO_URI, {})
    .then(() => {
      console.log('✅ MongoDB Connected');
      app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => console.log('MongoDB connection error:', err));
}
// ...existing code...

// import 'dotenv/config.js';
// import express from 'express';
// import mongoose from 'mongoose';
// import path from 'path';

// import restaurantRoutes from './routes/restaurantRoutes.js';
// import superAdminRoutes from './routes/superAdminRoutes.js';
// import foodItemRoutes from './routes/foodItemRoutes.js';
// import cors from 'cors';


// const app = express();

// app.use(cors());
// // Middleware to parse JSON data
// app.use(express.json());



// // Routes
// app.use('/api/restaurant', restaurantRoutes);
// app.use('/api/superAdmin', superAdminRoutes);
// app.use('/api/food-items', foodItemRoutes);
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// // Test route
// app.get('/', (req, res) => {
//   res.send('Restaurant Service Running...');
// });

// // MongoDB connection
// mongoose.connect(process.env.MONGO_URI, {})
//   .then(() => console.log('✅ MongoDB Connected'))
//   .catch(err => console.log('MongoDB connection error:', err));

// // Error handling middleware
// app.use((req, res, next) => {
//   const error = new Error('Not Found');
//   error.status = 404;
//   next(error);
// });

// app.use((error, req, res, next) => {
//   res.status(error.status || 500);
//   res.json({
//     message: error.message,
//     stack: error.stack,
//   });
// });

// // Start server
// const PORT = process.env.PORT || 5002;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
