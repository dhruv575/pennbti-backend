const User = require('../models/user');
const Room = require('../models/room');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const userController = {
  // Create user (signup)
  createUser: async (req, res) => {
    try {
      const { name, email, password, gender, preference } = req.body;

      // Validate upenn.edu email
      if (!email.endsWith('upenn.edu')) {
        return res.status(400).json({ message: 'Must use upenn.edu email' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        gender,
        preference,
        mbti: null,
        rooms: []
      });

      const savedUser = await newUser.save();
      res.status(201).json(savedUser);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Create token that expires in 30 days
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(200).json({ user, token });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Update MBTI and scores
  updateMBTI: async (req, res) => {
    try {
      const { mbti, scores } = req.body;
      const userId = req.user.userId;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      user.mbti = mbti;
      user.scores = scores;
      await user.save();

      res.status(200).json(user);
    } catch (error) {
      console.error('Error in updateMBTI:', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Add room to user
  addRoom: async (req, res) => {
    try {
      const { roomId } = req.body;
      const userId = req.user.userId;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.rooms.includes(roomId)) {
        return res.status(400).json({ message: 'Room already added' });
      }

      user.rooms.push(roomId);
      await user.save();

      res.status(200).json(user);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Get matches from inactive rooms
  getMatches: async (req, res) => {
    try {
      const userId = req.user.userId;
      console.log('Fetching matches for user:', userId);

      // Find the user and populate the rooms
      const user = await User.findById(userId).populate({
        path: 'rooms',
        populate: {
          path: 'matches',
          populate: [
            { path: 'user1', select: 'name email' },
            { path: 'user2', select: 'name email' }
          ]
        }
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const matches = [];

      // Process each room
      for (const room of user.rooms) {
        if (!room.active) {  // Only look at inactive rooms
          // Find matches where the current user is either user1 or user2
          const userMatches = room.matches.filter(match => 
            match.user1._id.toString() === userId || 
            match.user2._id.toString() === userId
          );

          // For each match, add it to our results
          userMatches.forEach(match => {
            const matchedUser = match.user1._id.toString() === userId ? 
              match.user2 : match.user1;

            matches.push({
              room: {
                _id: room._id,
                name: room.name,
                code: room.code
              },
              matchedUser: {
                _id: matchedUser._id,
                name: matchedUser.name,
                email: matchedUser.email
              }
            });
          });
        }
      }

      console.log('Found matches:', matches);
      res.status(200).json(matches);
    } catch (error) {
      console.error('Error in getMatches:', error);
      res.status(400).json({ message: error.message });
    }
  },

  // Get current user's data
  getMe: async (req, res) => {
    try {
      const user = await User.findById(req.user.userId)
        .select('-password')
        .populate({
          path: 'rooms',
          select: 'name code active' // Only select the fields we need
        });
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      console.log('Sending user data with populated rooms:', user);
      res.status(200).json(user);
    } catch (error) {
      console.error('Error in getMe:', error);
      res.status(400).json({ message: error.message });
    }
  }
};

module.exports = userController; 