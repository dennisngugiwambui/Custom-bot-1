const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// License Verification
router.get('/verify', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ active: false, message: 'No license token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ active: false, message: 'User not found' });
    }

    const now = new Date();
    const isSubscribed = user.subscriptionExpiry && user.subscriptionExpiry > now;

    res.json({
      active: isSubscribed,
      expiry: user.subscriptionExpiry,
      message: isSubscribed ? 'License active' : 'License expired'
    });
  } catch (err) {
    res.status(401).json({ active: false, message: 'Invalid license' });
  }
});

module.exports = router;
