const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const developerSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: () => crypto.randomUUID() },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  company: { type: String, trim: true },
  verified: { type: Boolean, default: true }, // auto-verify for simplicity
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

developerSchema.pre('save', async function(next) {
  if (this.isModified('passwordHash') && !this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

developerSchema.methods.verifyPassword = function(pw) {
  return bcrypt.compare(pw, this.passwordHash);
};

developerSchema.methods.toPublic = function() {
  return { id: this.id, name: this.name, email: this.email, company: this.company, plan: this.plan };
};

module.exports = mongoose.model('Developer', developerSchema);
