const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const Package = require('../models/Package');
const { initiateStkPush } = require('../utils/mpesa');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Initiate STK Push
router.post('/stkpush', auth, async (req, res) => {
  try {
    const { packageId, phoneNumber } = req.body;
    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: 'Package not found' });

    const response = await initiateStkPush(phoneNumber, pkg.price, 'Bot Subscription', `Payment for ${pkg.name}`);
    
    // Save pending payment
    const payment = new Payment({
      userId: req.user.id,
      amount: pkg.price,
      phoneNumber: phoneNumber,
      checkoutRequestID: response.CheckoutRequestID,
      merchantRequestID: response.MerchantRequestID,
      status: 'pending'
    });
    await payment.save();

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// M-Pesa Callback
router.post('/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = stkCallback;

    const payment = await Payment.findOne({ checkoutRequestID: CheckoutRequestID });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    if (ResultCode === 0) {
      payment.status = 'completed';
      payment.resultDesc = ResultDesc;
      
      const metadata = CallbackMetadata.Item;
      const receipt = metadata.find(item => item.Name === 'MpesaReceiptNumber');
      if (receipt) payment.mpesaReceiptNumber = receipt.Value;

      await payment.save();

      // Update user subscription
      const user = await User.findById(payment.userId);
      if (user) {
        const now = new Date();
        const currentExpiry = user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
        user.subscriptionExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000); // Add 30 days
        await user.save();
      }
    } else {
      payment.status = 'failed';
      payment.resultDesc = ResultDesc;
      await payment.save();
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
