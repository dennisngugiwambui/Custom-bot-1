const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  phoneNumber: { type: String, required: true },
  checkoutRequestID: { type: String, required: true, unique: true },
  merchantRequestID: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  mpesaReceiptNumber: { type: String },
  resultDesc: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
