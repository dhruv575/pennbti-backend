const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const roomAuth = require('../middleware/roomAuth');
const auth = require('../middleware/auth');

// Public routes
router.post('/create', roomController.createRoom);
router.post('/login', roomController.loginRoom);

// Protected routes that require user authentication
router.post('/verify', auth, roomController.verifyRoom);
router.post('/addUser', auth, roomController.addUser);

// Protected routes that require room authentication
router.get('/:code', roomAuth, roomController.getRoomData);
router.post('/:code/matches', roomAuth, roomController.createMatches);

// Add this new route
router.get('/:id', auth, roomController.getRoomById);

module.exports = router; 