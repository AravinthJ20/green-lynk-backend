require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const createRateLimiter = require('./middleware/rateLimiter');
const { corsOrigins, port, statusFeatureEnabled, agentFeatureEnabled, apiRateLimitWindowMs, apiRateLimitMaxRequests } = require('./config/env');
const socketManager = require('./socket/socketManager');
const { setIO } = require('./utils/realtime');
const { startRequestReminderCron } = require('./utils/requestReminderCron');
const { startAgentReminderCron } = require('./utils/agentReminderCron');

const app = express();
const corsOptions = {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
};
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions
});

connectDB();

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

setIO(io);
socketManager(io);
startRequestReminderCron();
if (agentFeatureEnabled) {
  startAgentReminderCron();
}

app.get('/', (req, res) => {
res.json({ message: 'Green Lynk backend is running' });
});

server.listen(port, () => console.log(`Backend listening on port ${port}`));
