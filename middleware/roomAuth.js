const Room = require('../models/room');

const roomAuth = async (req, res, next) => {
  try {
    const { code, password } = req.headers;
    
    if (!code || !password) {
      return res.status(401).json({ message: 'Room code and password required' });
    }

    const room = await Room.findOne({ code });
    if (!room || room.password !== password) {
      return res.status(401).json({ message: 'Invalid room credentials' });
    }

    req.room = room;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Room authentication failed' });
  }
};

module.exports = roomAuth; 