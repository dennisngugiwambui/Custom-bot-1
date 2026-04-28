const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
  name: { type: String, required: true },
  version: { type: String, required: true },
  description: { type: String },
  downloadUrl: { type: String, required: true },
  iconUrl: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bot', botSchema);
