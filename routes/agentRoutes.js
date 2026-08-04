const express = require('express');
const auth = require('../utils/auth');
const aiRateLimiter = require('../middleware/aiRateLimiter');
const agentController = require('../controllers/agentController');

const router = express.Router();

router.get('/capabilities', auth, aiRateLimiter, agentController.capabilities);
router.post('/chat', auth, aiRateLimiter, agentController.chat);

module.exports = router;