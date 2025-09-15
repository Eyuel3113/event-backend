const Joi = require('joi');
const { Booking, Service, Payment, User, AuditLog } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const PaymentService = require('../services/paymentService');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// Validation schemas
const calculatePriceSchema = Joi.object({
  serviceId: Joi.string().uuid().optional(),
  eventType: Joi.string().valid('wedding', 'birthday', 'corporate', 'other').required(),
  guestCount: Joi.number().integer().min(1).max(1000).required(),
  eventDate: Joi.date().min('now').required(),
  eventTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
});

const createBookingSchema = Joi.object({
  serviceId: Joi.string().uuid().optional(),
  customerName: Joi.string().min(2).max(100).required(),
  customerEmail: Joi.string().email().required(),
  customerPhone: Joi.string().min(10).max(15).required(),
  eventType: Joi.string().valid('wedding', 'birthday', 'corporate', 'other').required(),
  eventDate: Joi.date().min('now').required(),
  eventTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  guestCount: Joi.number().integer().min(1).max(1000).required(),
  message: Joi.string().max(1000).optional(),
});

const proceedPaymentSchema = Joi.object({
  paymentMethod: Joi.string().valid('telebirr', 'cbe', 'abisiniya', 'commercial').required(),
  phoneNumber: Joi.string().min(10).max(15).optional(),
});

const bookingController = {
  calculatePrice: async (req, res) => {
    try {
      const { error, value } = calculatePriceSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { serviceId, eventType, guestCount } = value;

      let basePrice = 0;
      let serviceDetails = null;

      if (serviceId) {
        const service = await Service.findByPk(serviceId);
        if (!service || service.status !== 'active') {
          return errorResponse(res, 'Service not found or inactive', 404);
        }
        basePrice = service.price;
        serviceDetails = {
          id: service.id,
          name: service.name,
          price: service.price,
          category: service.category,
        };
      } else {
        // Default pricing based on event type
        const eventTypePrices = {
          wedding: 20000,
          birthday: 10000,
          corporate: 15000,
          other: 12000,
        };
        basePrice = eventTypePrices[eventType] || 12000;
      }

      // Calculate total price (base price * guest factor + extras)
      const guestFactor = Math.max(1, guestCount / 50); // Every 50 guests increases price
      const totalPrice = Math.round(basePrice * guestFactor);

      return successResponse(res, {
        basePrice,
        guestCount,
        guestFactor: guestFactor.toFixed(2),
        totalPrice,
        currency: 'ETB',
        service: serviceDetails,
        eventType,
      });
    } catch (error) {
      logger.error('Calculate price error:', error);
      return errorResponse(res, 'Failed to calculate price', 500);
    }
  },

  createBooking: async (req, res) => {
    const transaction = await require('../config/database').sequelize.transaction();
    
    try {
      const { error, value } = createBookingSchema.validate(req.body);
      if (error) {
        await transaction.rollback();
        return validationErrorResponse(res, error);
      }

      const {
        serviceId,
        customerName,
        customerEmail,
        customerPhone,
        eventType,
        eventDate,
        eventTime,
        guestCount,
        message,
      } = value;

      let serviceSnapshot = null;
      let basePrice = 0;

      if (serviceId) {
        const service = await Service.findByPk(serviceId, { transaction });
        if (!service || service.status !== 'active') {
          await transaction.rollback();
          return errorResponse(res, 'Service not found or inactive', 404);
        }
        
        serviceSnapshot = {
          id: service.id,
          name: service.name,
          price: service.price,
          category: service.category,
        };
        basePrice = service.price;
      } else {
        // Default pricing
        const eventTypePrices = {
          wedding: 20000,
          birthday: 10000,
          corporate: 15000,
          other: 12000,
        };
        basePrice = eventTypePrices[eventType] || 12000;
      }

      const guestFactor = Math.max(1, guestCount / 50);
      const priceCalculated = Math.round(basePrice * guestFactor);

      const booking = await Booking.create({
        userId: req.user?.id || null,
        customerName,
        customerEmail,
        customerPhone,
        serviceId,
        serviceSnapshot,
        eventType,
        eventDate,
        eventTime,
        guestCount,
        message,
        priceCalculated,
        status: 'pending',
        paymentStatus: 'unpaid',
      }, { transaction });

      // Log audit
      await AuditLog.create({
        userId: req.user?.id || null,
        action: 'create_booking',
        resourceType: 'booking',
        resourceId: booking.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { customerEmail, eventType, priceCalculated }
      }, { transaction });

      // Notify admins
      await NotificationService.notifyAdmins(
        'booking_created',
        `New booking created by ${customerName}`,
        { bookingId: booking.id, customerName, customerEmail }
      );

      // Send confirmation email
      await EmailService.sendBookingConfirmation(booking, req.user);

      await transaction.commit();

      return successResponse(res, booking, 'Booking created successfully', 201);
    } catch (error) {
      await transaction.rollback();
      logger.error('Create booking error:', error);
      return errorResponse(res, 'Failed to create booking', 500);
    }
  },

  proceedPayment: async (req, res) => {
    try {
      const { error, value } = proceedPaymentSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { id } = req.params;
      const { paymentMethod, phoneNumber } = value;

      const booking = await Booking.findByPk(id);
      if (!booking) {
        return errorResponse(res, 'Booking not found', 404);
      }

      if (booking.paymentStatus !== 'unpaid') {
        return errorResponse(res, 'Payment already processed for this booking', 400);
      }

      const payment = await PaymentService.createPayment(id, {
        paymentMethod,
        phoneNumber,
      });

      const instructions = await PaymentService.getPaymentInstructions(
        paymentMethod,
        payment.amount,
        phoneNumber
      );

      return successResponse(res, {
        payment,
        instructions,
      }, 'Payment initiated successfully');
    } catch (error) {
      logger.error('Proceed payment error:', error);
      return errorResponse(res, 'Failed to initiate payment', 500);
    }
  },

  getBooking: async (req, res) => {
    try {
      const { id } = req.params;

      const booking = await Booking.findByPk(id, {
        include: [
          {
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'category', 'price']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
          },
          {
            model: Payment,
            as: 'payment',
            attributes: { exclude: ['metadata'] }
          }
        ]
      });

      if (!booking) {
        return errorResponse(res, 'Booking not found', 404);
      }

      // Check permissions
      if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
        return errorResponse(res, 'Access denied', 403);
      }

      return successResponse(res, booking);
    } catch (error) {
      logger.error('Get booking error:', error);
      return errorResponse(res, 'Failed to get booking', 500);
    }
  },

  getUserBookings: async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = { userId: req.user.id };
      if (status) whereClause.status = status;

      const { count, rows: bookings } = await Booking.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'category']
          },
          {
            model: Payment,
            as: 'payment',
            attributes: ['id', 'status', 'amount', 'paymentMethod']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        bookings,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get user bookings error:', error);
      return errorResponse(res, 'Failed to get bookings', 500);
    }
  },

  getAllBookings: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, paymentStatus, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (status) whereClause.status = status;
      if (paymentStatus) whereClause.paymentStatus = paymentStatus;

      if (search) {
        whereClause[require('sequelize').Op.or] = [
          { customerName: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { customerEmail: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { customerPhone: { [require('sequelize').Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: bookings } = await Booking.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'category']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName']
          },
          {
            model: Payment,
            as: 'payment',
            attributes: ['id', 'status', 'amount']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        bookings,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get all bookings error:', error);
      return errorResponse(res, 'Failed to get bookings', 500);
    }
  },

  updateBookingStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
        return errorResponse(res, 'Invalid status', 400);
      }

      const booking = await Booking.findByPk(id);
      if (!booking) {
        return errorResponse(res, 'Booking not found', 404);
      }

      await booking.update({ status });

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'update_booking_status',
        resourceType: 'booking',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { oldStatus: booking.status, newStatus: status }
      });

      // Notify user if status changed to confirmed or cancelled
      if (status === 'confirmed' || status === 'cancelled') {
        await NotificationService.createNotification(
          booking.userId,
          `booking_${status}`,
          `Your booking has been ${status}`,
          { bookingId: id, status }
        );
      }

      return successResponse(res, booking, 'Booking status updated successfully');
    } catch (error) {
      logger.error('Update booking status error:', error);
      return errorResponse(res, 'Failed to update booking status', 500);
    }
  },

  getQRCode: async (req, res) => {
    try {
      const { id } = req.params;

      const booking = await Booking.findByPk(id, {
        include: [{
          model: Payment,
          as: 'payment',
          where: { status: 'completed' }
        }]
      });

      if (!booking) {
        return errorResponse(res, 'Booking not found or payment not completed', 404);
      }

      if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
        return errorResponse(res, 'Access denied', 403);
      }

      if (!booking.qrCodeUrl) {
        return errorResponse(res, 'QR code not available', 404);
      }

      // Serve the QR code file
      const qrPath = require('path').join(__dirname, '..', booking.qrCodeUrl);
      return res.sendFile(qrPath);
    } catch (error) {
      logger.error('Get QR code error:', error);
      return errorResponse(res, 'Failed to get QR code', 500);
    }
  }
};

module.exports = bookingController;