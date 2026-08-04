const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'green-lynk-secret';

const authMiddleware = async (req, res, next) => {
  try {
    const authorization = req.header('Authorization');
    if (!authorization) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authorization.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });
    if (!user) {
      return res.status(401).json({ error: 'Please authenticate' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

module.exports = authMiddleware;
