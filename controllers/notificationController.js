const { Notification } = require('../models');
const NotificationService = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const notificationController = {
  getUserNotifications: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await NotificationService.getUserNotifications(
        req.user.id,
        parseInt(page),
        parseInt(limit)
      );

      return successResponse(res, result);
    } catch (error) {
      logger.error('Get user notifications error:', error);
      return errorResponse(res, 'Failed to get notifications', 500);
    }
  },

  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await NotificationService.markAsRead(id, req.user.id);

      return successResponse(res, notification, 'Notification marked as read');
    } catch (error) {
      logger.error('Mark notification as read error:', error);
      return errorResponse(res, 'Failed to mark notification as read', 500);
    }
  },

  markAllAsRead: async (req, res) => {
    try {
      const count = await NotificationService.markAllAsRead(req.user.id);

      return successResponse(res, { count }, 'All notifications marked as read');
    } catch (error) {
      logger.error('Mark all notifications as read error:', error);
      return errorResponse(res, 'Failed to mark notifications as read', 500);
    }
  },

  getUnreadCount: async (req, res) => {
    try {
      const count = await NotificationService.getUnreadCount(req.user.id);

      return successResponse(res, { count });
    } catch (error) {
      logger.error('Get unread count error:', error);
      return errorResponse(res, 'Failed to get unread count', 500);
    }
  },

  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await Notification.findOne({
        where: { id, userId: req.user.id }
      });

      if (!notification) {
        return errorResponse(res, 'Notification not found', 404);
      }

      await notification.destroy();

      return successResponse(res, null, 'Notification deleted successfully');
    } catch (error) {
      logger.error('Delete notification error:', error);
      return errorResponse(res, 'Failed to delete notification', 500);
    }
  }
};

module.exports = notificationController;