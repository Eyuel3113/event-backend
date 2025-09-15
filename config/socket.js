const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('./env');
const logger = require('../utils/logger');

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'role', 'status', 'emailVerified']
    });

    if (!user || user.status !== 'active' || !user.emailVerified) {
      return next(new Error('Authentication error: Invalid user'));
    }

    socket.userId = user.id;
    socket.userRole = user.role;
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

// Utility function to emit events to specific users or rooms
const emitToUser = (userId, event, data) => {
  const io = require('../server').io;
  io.to(`user_${userId}`).emit(event, data);
};

const emitToAdmins = (event, data) => {
  const io = require('../server').io;
  io.to('admin_room').emit(event, data);
};

const emitToBooking = (bookingId, event, data) => {
  const io = require('../server').io;
  io.to(`booking_${bookingId}`).emit(event, data);
};

module.exports = {
  authenticateSocket,
  emitToUser,
  emitToAdmins,
  emitToBooking,
};