const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  durationDays: { type: Number, default: 30 },
  description: { type: String },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Package', packageSchema);
