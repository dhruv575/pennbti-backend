const Room = require('../models/room');
const User = require('../models/user');

const roomController = {
  // Create a new room
  createRoom: async (req, res) => {
    try {
      const { name, code, password, type } = req.body;
      
      // Validate code format
      if (!roomController.validateCode(code)) {
        return res.status(400).json({ 
          message: 'Code must be max 8 characters, lowercase letters and numbers only' 
        });
      }

      // Check if code already exists
      const existingRoom = await Room.findOne({ code });
      if (existingRoom) {
        return res.status(400).json({ message: 'Room code already exists' });
      }

      const newRoom = new Room({
        name,
        code,
        password,
        type,
        active: true,  // default to true
        users: [],     // empty array to start
        matches: []    // empty array to start
      });

      const savedRoom = await newRoom.save();
      res.status(201).json(savedRoom);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Add a user to an active room
  addUser: async (req, res) => {
    try {
      console.log('Incoming request to add user:', req.body);
      const { roomId } = req.body;
      const userId = req.user.userId;
      
      console.log('Room ID:', roomId);
      console.log('User ID:', userId);

      // Find the room
      const room = await Room.findById(roomId);
      if (!room) {
        console.log('Room not found for ID:', roomId);
        return res.status(404).json({ message: 'Room not found' });
      }

      // Check if user is already in the room
      if (room.users.includes(userId)) {
        console.log('User already in room:', userId);
        return res.status(400).json({ message: 'User already in room' });
      }

      // Add user to room
      room.users.push(userId);
      await room.save();

      // Find the user and add the room to their rooms array
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if room is already in user's rooms
      if (!user.rooms.includes(roomId)) {
        user.rooms.push(roomId);
        await user.save();
      }

      console.log('User added to room successfully:', userId);
      res.status(200).json({ message: 'Successfully joined room' });
    } catch (error) {
      console.error('Error in addUser:', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Create matches and deactivate room
  createMatches: async (req, res) => {
    try {
      const { code } = req.params;
      
      const room = await Room.findOne({ code });
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }
      
      if (!room.active) {
        return res.status(400).json({ message: 'Room is already inactive' });
      }

      // Shuffle users array for random matching
      const shuffledUsers = [...room.users].sort(() => Math.random() - 0.5);
      
      const matches = [];
      
      // Create pairs, handling odd number of users
      for (let i = 0; i < shuffledUsers.length; i += 2) {
        if (i + 1 >= shuffledUsers.length) {
          // If this is the last person and no one is left to pair with
          matches.push({
            user1: shuffledUsers[i],
            user2: shuffledUsers[i] // Match with self if odd number
          });
        } else {
          matches.push({
            user1: shuffledUsers[i],
            user2: shuffledUsers[i + 1]
          });
        }
      }

      room.matches = matches;
      room.active = false;  // Deactivate room after matching
      await room.save();

      // Return populated matches data
      const populatedMatches = await Promise.all(matches.map(async match => {
        const user1 = await User.findById(match.user1, 'name email mbti');
        const user2 = await User.findById(match.user2, 'name email mbti');
        return { user1, user2 };
      }));

      res.status(200).json({
        room,
        matches: populatedMatches
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Validate room code format
  validateCode: (code) => {
    const codeRegex = /^[a-z0-9]{1,8}$/;
    return codeRegex.test(code);
  },

  // Room login
  loginRoom: async (req, res) => {
    try {
      const { code, password } = req.body;

      const room = await Room.findOne({ code });
      if (!room || room.password !== password) {
        return res.status(401).json({ message: 'Invalid room credentials' });
      }

      res.status(200).json({ 
        message: 'Login successful',
        roomId: room._id,
        active: room.active
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Get room data
  getRoomData: async (req, res) => {
    try {
      const { code } = req.params;
      
      const room = await Room.findOne({ code });
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      // Populate users with necessary fields
      const users = await User.find(
        { _id: { $in: room.users } },
        'name email mbti'
      );

      // If room is inactive, include matches
      let matches = [];
      if (!room.active && room.matches) {
        matches = await Promise.all(room.matches.map(async match => {
          const user1 = await User.findById(match.user1, 'name email mbti');
          const user2 = await User.findById(match.user2, 'name email mbti');
          return { user1, user2 };
        }));
      }

      res.status(200).json({
        room,
        users,
        matches
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Verify room exists and get its ID
  verifyRoom: async (req, res) => {
    try {
      const { code } = req.body;
      
      const room = await Room.findOne({ code });
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      // Check if room is still active
      if (!room.active) {
        return res.status(400).json({ message: 'Room is no longer active' });
      }

      res.status(200).json({ 
        roomId: room._id,
        code: room.code,
        name: room.name
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Add this new method
  getRoomById: async (req, res) => {
    try {
      const roomId = req.params.id;
      const userId = req.user.userId;

      console.log('getRoomById called with:', {
        roomId,
        userId,
        headers: req.headers,
        user: req.user
      });

      const room = await Room.findById(roomId);
      
      if (!room) {
        console.log('Room not found:', roomId);
        return res.status(404).json({ message: 'Room not found' });
      }

      console.log('Found room:', {
        roomId: room._id,
        name: room.name,
        users: room.users,
        requestingUser: userId
      });

      // Check if user is in room.users array
      const userInRoom = room.users.some(id => id.toString() === userId);
      console.log('User authorization check:', {
        userInRoom,
        roomUsers: room.users.map(id => id.toString()),
        requestingUser: userId
      });

      if (!userInRoom) {
        console.log('User not authorized:', userId);
        return res.status(403).json({ message: 'Not authorized to access this room' });
      }

      const roomData = {
        _id: room._id,
        name: room.name,
        code: room.code,
        active: room.active
      };

      console.log('Sending room data:', roomData);
      res.status(200).json(roomData);
    } catch (error) {
      console.error('Error in getRoomById:', {
        error: error.message,
        stack: error.stack
      });
      res.status(400).json({ message: error.message });
    }
  },
};

module.exports = roomController; 