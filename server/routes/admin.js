const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Package = require('../models/Package');
const Bot = require('../models/Bot');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');

// Admin Middleware
const adminAuth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Access denied. Admin only.' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user subscription manually
router.post('/user/:id/subscription', adminAuth, async (req, res) => {
  try {
    const { expiry } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.subscriptionExpiry = new Date(expiry);
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Package management
router.post('/package', adminAuth, async (req, res) => {
  try {
    const pkg = new Package(req.body);
    await pkg.save();
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/packages', async (req, res) => {
    try {
      const pkgs = await Package.find({ isActive: true });
      res.json(pkgs);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

// Bot management
router.post('/bot', adminAuth, async (req, res) => {
  try {
    const bot = new Bot(req.body);
    await bot.save();
    res.json(bot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/bots', async (req, res) => {
    try {
      const bots = await Bot.find({ isActive: true });
      res.json(bots);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

// Payment logs
router.get('/payments', adminAuth, async (req, res) => {
    try {
      const payments = await Payment.find().populate('userId', 'name email').sort({ createdAt: -1 });
      res.json(payments);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

module.exports = router;
