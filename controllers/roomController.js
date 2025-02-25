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

      // Fetch all users with their complete data
      const users = await User.find({ _id: { $in: room.users } });
      
      // Calculate matches based on room type
      let matches = [];
      
      if (room.type === 'platonic') {
        matches = createPlatonicMatches(users);
      } else if (room.type === 'romantic') {
        matches = createRomanticMatches(users);
      } else {
        return res.status(400).json({ message: 'Invalid room type' });
      }

      // Save matches to room
      room.matches = matches;
      room.active = false;  // Deactivate room after matching
      await room.save();

      // Return populated matches data
      const populatedMatches = await Promise.all(matches.map(async match => {
        const user1 = await User.findById(match.user1, 'name email mbti scores');
        const user2 = await User.findById(match.user2, 'name email mbti scores');
        return { user1, user2 };
      }));

      res.status(200).json({
        room,
        matches: populatedMatches
      });
    } catch (error) {
      console.error('Error in createMatches:', error);
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

  // Calculate preference lists based on score similarity
  calculatePreferenceLists: function calculatePreferenceLists(users) {
    const preferenceLists = {};
    
    users.forEach(user => {
      // Calculate distance to all other users
      const distances = users
        .filter(otherUser => otherUser._id.toString() !== user._id.toString())
        .map(otherUser => {
          // Calculate root squared distance between scores
          const distance = Math.sqrt(
            user.scores.reduce((sum, score, index) => {
              const diff = score - otherUser.scores[index];
              return sum + diff * diff;
            }, 0)
          );
          
          return {
            userId: otherUser._id.toString(),
            distance
          };
        });
      
      // Sort by distance (ascending)
      distances.sort((a, b) => a.distance - b.distance);
      
      // Create preference list (just the user IDs in order)
      preferenceLists[user._id.toString()] = distances.map(d => d.userId);
    });
    
    return preferenceLists;
  },

  // Filter preference lists based on gender and preference
  filterPreferencesByOrientation: function filterPreferencesByOrientation(users, preferenceLists) {
    const filteredLists = {};
    
    users.forEach(user => {
      const userId = user._id.toString();
      const userPreference = user.preference || ['any'];
      
      // Filter the preference list to only include compatible users
      filteredLists[userId] = preferenceLists[userId].filter(otherUserId => {
        const otherUser = users.find(u => u._id.toString() === otherUserId);
        
        // If user prefers 'any', they're compatible with everyone
        if (userPreference.includes('any')) {
          return true;
        }
        
        // Otherwise, check if the other user's gender matches this user's preference
        return userPreference.includes(otherUser.gender);
      });
    });
    
    return filteredLists;
  },

  // Implement the "Everyone Proposes" Gale-Shapley algorithm
  everyoneProposes: function everyoneProposes(users, preferenceLists) {
    // Initialize all users as unmatched
    const matches = {};
    const unmatchedUsers = users.map(user => user._id.toString());
    
    // Create a copy of preference lists to modify during algorithm
    const remainingPreferences = {};
    users.forEach(user => {
      remainingPreferences[user._id.toString()] = [...preferenceLists[user._id.toString()]];
    });
    
    // Create a reverse lookup for preference rankings
    const preferenceRanks = {};
    users.forEach(user => {
      const userId = user._id.toString();
      preferenceRanks[userId] = {};
      
      preferenceLists[userId].forEach((prefId, index) => {
        preferenceRanks[userId][prefId] = index;
      });
    });
    
    // Run the algorithm until no more proposals can be made
    while (unmatchedUsers.length > 0) {
      const currentUserId = unmatchedUsers[0];
      
      // If this user has no more preferences, remove from unmatched and continue
      if (remainingPreferences[currentUserId].length === 0) {
        unmatchedUsers.shift();
        continue;
      }
      
      // Get the highest-ranked remaining preference
      const preferredUserId = remainingPreferences[currentUserId].shift();
      
      // If the preferred user is unmatched, create a match
      if (!matches[preferredUserId]) {
        matches[currentUserId] = preferredUserId;
        matches[preferredUserId] = currentUserId;
        unmatchedUsers.shift(); // Remove the proposer from unmatched
      } 
      // If the preferred user is already matched, they decide who they prefer
      else {
        const currentMatchId = matches[preferredUserId];
        
        // Check if they prefer the new proposer over their current match
        if (preferenceRanks[preferredUserId][currentUserId] < 
            preferenceRanks[preferredUserId][currentMatchId]) {
          
          // They prefer the new proposer, so update matches
          delete matches[currentMatchId];
          matches[currentUserId] = preferredUserId;
          matches[preferredUserId] = currentUserId;
          
          // Add the previous match back to unmatched users
          unmatchedUsers.shift(); // Remove current proposer
          unmatchedUsers.push(currentMatchId); // Add previous match
        }
        // If they prefer their current match, the proposer stays unmatched
        // and will try their next preference in the next iteration
      }
    }
    
    // Convert matches to the required format
    const result = [];
    const matchedUsers = new Set();
    
    for (const [user1Id, user2Id] of Object.entries(matches)) {
      // Only add each pair once
      if (!matchedUsers.has(user1Id) && !matchedUsers.has(user2Id)) {
        result.push({
          user1: user1Id,
          user2: user2Id
        });
        
        matchedUsers.add(user1Id);
        matchedUsers.add(user2Id);
      }
    }
    
    return result;
  },

  // Create platonic matches
  createPlatonicMatches: function createPlatonicMatches(users) {
    // For platonic matching, everyone can match with everyone
    const preferenceLists = calculatePreferenceLists(users);
    
    // Run the matching algorithm
    let matches = everyoneProposes(users, preferenceLists);
    
    // Handle odd number of users - match the last person with themselves
    if (users.length % 2 !== 0) {
      // Find the unmatched user
      const matchedUserIds = new Set();
      matches.forEach(match => {
        matchedUserIds.add(match.user1.toString());
        matchedUserIds.add(match.user2.toString());
      });
      
      const unmatchedUser = users.find(user => 
        !matchedUserIds.has(user._id.toString())
      );
      
      if (unmatchedUser) {
        matches.push({
          user1: unmatchedUser._id,
          user2: unmatchedUser._id
        });
      }
    }
    
    return matches;
  },

  // Create romantic matches
  createRomanticMatches: function createRomanticMatches(users) {
    // Calculate base preference lists
    const basePreferenceLists = calculatePreferenceLists(users);
    
    // Filter by orientation for first round
    const orientationFilteredLists = filterPreferencesByOrientation(users, basePreferenceLists);
    
    // First round of matching with orientation preferences
    let matches = everyoneProposes(users, orientationFilteredLists);
    
    // Find unmatched users after first round
    const matchedUserIds = new Set();
    matches.forEach(match => {
      matchedUserIds.add(match.user1.toString());
      matchedUserIds.add(match.user2.toString());
    });
    
    const unmatchedUsers = users.filter(user => 
      !matchedUserIds.has(user._id.toString())
    );
    
    // If there are unmatched users, do a second round with relaxed preferences
    if (unmatchedUsers.length > 1) {
      const unmatchedIds = unmatchedUsers.map(user => user._id.toString());
      
      // Create preference lists for unmatched users (only including other unmatched users)
      const secondRoundLists = {};
      unmatchedUsers.forEach(user => {
        const userId = user._id.toString();
        
        // Filter to only include other unmatched users, sorted by score similarity
        secondRoundLists[userId] = basePreferenceLists[userId]
          .filter(prefId => unmatchedIds.includes(prefId));
      });
      
      // Run second round of matching
      const secondRoundMatches = everyoneProposes(unmatchedUsers, secondRoundLists);
      
      // Combine matches from both rounds
      matches = [...matches, ...secondRoundMatches];
    }
    
    // Handle odd number of users - match the last person with themselves
    if (users.length % 2 !== 0) {
      // Recalculate matched users after both rounds
      const finalMatchedIds = new Set();
      matches.forEach(match => {
        finalMatchedIds.add(match.user1.toString());
        finalMatchedIds.add(match.user2.toString());
      });
      
      const finalUnmatched = users.find(user => 
        !finalMatchedIds.has(user._id.toString())
      );
      
      if (finalUnmatched) {
        matches.push({
          user1: finalUnmatched._id,
          user2: finalUnmatched._id
        });
      }
    }
    
    return matches;
  },
};

module.exports = roomController; 