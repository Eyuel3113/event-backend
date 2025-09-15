const User = require('./User');
const Booking = require('./Booking');
const Service = require('./Service');
const Gallery = require('./Gallery');
const Payment = require('./Payment');
const Notification = require('./Notification');
const AuditLog = require('./AuditLog');

// User Associations
User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

// Booking Associations
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Booking.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });
Booking.hasOne(Payment, { foreignKey: 'bookingId', as: 'payment' });

// Service Associations
Service.hasMany(Booking, { foreignKey: 'serviceId', as: 'bookings' });

// Payment Associations
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

// Notification Associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// AuditLog Associations
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  User,
  Booking,
  Service,
  Gallery,
  Payment,
  Notification,
  AuditLog,
};