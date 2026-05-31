const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/invite', require('../utils/auth'), authController.sendInvite);
router.post('/logout', require('../utils/auth'), authController.logout);
router.get('/invite/:inviteToken', authController.validateInvite);
router.get('/me', require('../utils/auth'), authController.getMe);

module.exports = router;
