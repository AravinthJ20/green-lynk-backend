require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const createRateLimiter = require('./middleware/rateLimiter');
const { corsOrigins, statusFeatureEnabled, agentFeatureEnabled, apiRateLimitWindowMs, apiRateLimitMaxRequests } = require('./config/env');

const app = express();
const corsOptions = {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
};

app.use(express.json({ limit: '25mb' }));
app.use(cors(corsOptions));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', createRateLimiter({ windowMs: apiRateLimitWindowMs, maxRequests: apiRateLimitMaxRequests }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/groups', require('./routes/group'));
if (statusFeatureEnabled) {
  app.use('/api/status', require('./routes/status'));
}
if (agentFeatureEnabled) {
  app.use('/api/agent', require('./routes/agent'));
}

app.get('/', (req, res) => {
  res.json({ message: 'Green Lynk backend is running' });
});

module.exports = app;
