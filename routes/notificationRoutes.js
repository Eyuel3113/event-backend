const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Protected routes
router.get('/', authenticateToken, notificationController.getUserNotifications);
router.get('/unread-count', authenticateToken, notificationController.getUnreadCount);
router.patch('/:id/read', authenticateToken, notificationController.markAsRead);
router.patch('/read-all', authenticateToken, notificationController.markAllAsRead);
router.delete('/:id', authenticateToken, notificationController.deleteNotification);

module.exports = router;