// packages/api-server/src/index.js (FIX - remove duplicate listen)

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import projectsRouter from './routes/projects.js';
import discoveryRouter from './routes/discovery.js';
import configRoutes from './routes/config.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/discovery', discoveryRouter);
app.use('/api/config', configRoutes);

// Error handling
app.use(errorHandler);

// ❌ REMOVE THIS ONE - it's a duplicate
// app.listen(PORT, () => {
//   console.log(`🚀 API Server running on http://localhost:${PORT}`);
// });

// ✅ KEEP ONLY THIS ONE
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Discovery API: http://localhost:${PORT}/api/discovery`);
  console.log(`⚙️  Config API: http://localhost:${PORT}/api/config`);
});