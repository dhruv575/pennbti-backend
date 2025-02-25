const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// Public routes
router.post('/signup', userController.createUser);
router.post('/login', userController.login);

// Protected routes
router.put('/mbti', auth, userController.updateMBTI);
router.post('/addRoom', auth, userController.addRoom);
router.get('/matches', auth, userController.getMatches);
router.get('/me', auth, userController.getMe);

module.exports = router; 