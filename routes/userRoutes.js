const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Protected routes - User profile
router.get('/me', authenticateToken, userController.getMe);
router.put('/me', authenticateToken, userController.updateProfile);

// Admin only routes
router.get('/admin/users', authenticateToken, requireAdmin, userController.getAllUsers);
router.get('/admin/users/:id', authenticateToken, requireAdmin, userController.getUserById);
router.put('/admin/users/:id', authenticateToken, requireAdmin, userController.updateUser);
router.delete('/admin/users/:id', authenticateToken, requireAdmin, userController.deleteUser);

module.exports = router;


