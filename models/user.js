const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  mbti: String,
  gender: String,
  scores: { 
    type: [Number], 
    default: [0, 0, 0, 0] 
  },
  preference: [String],
  rooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);