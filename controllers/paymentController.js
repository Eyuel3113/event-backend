const Joi = require('joi');
const { Payment, Booking, AuditLog } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const PaymentService = require('../services/paymentService');
const logger = require('../utils/logger');

// Validation schemas
const processPaymentSchema = Joi.object({
  simulateSuccess: Joi.boolean().default(true),
});

const paymentController = {
  processPayment: async (req, res) => {
    try {
      const { error, value } = processPaymentSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { id } = req.params;
      const { simulateSuccess } = value;

      const payment = await PaymentService.processPayment(id, simulateSuccess);

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'process_payment',
        resourceType: 'payment',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { simulateSuccess, status: payment.status }
      });

      return successResponse(res, payment, 'Payment processed successfully');
    } catch (error) {
      logger.error('Process payment error:', error);
      return errorResponse(res, 'Failed to process payment', 500);
    }
  },

  getPayment: async (req, res) => {
    try {
      const { id } = req.params;

      const payment = await Payment.findByPk(id, {
        include: [{
          model: Booking,
          as: 'booking',
          attributes: ['id', 'customerName', 'customerEmail', 'eventType']
        }]
      });

      if (!payment) {
        return errorResponse(res, 'Payment not found', 404);
      }

      // Check permissions
      if (req.user.role !== 'admin') {
        const booking = await Booking.findByPk(payment.bookingId);
        if (booking.userId !== req.user.id) {
          return errorResponse(res, 'Access denied', 403);
        }
      }

      return successResponse(res, payment);
    } catch (error) {
      logger.error('Get payment error:', error);
      return errorResponse(res, 'Failed to get payment', 500);
    }
  },

  getAllPayments: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, paymentMethod } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (status) whereClause.status = status;
      if (paymentMethod) whereClause.paymentMethod = paymentMethod;

      const { count, rows: payments } = await Payment.findAndCountAll({
        where: whereClause,
        include: [{
          model: Booking,
          as: 'booking',
          attributes: ['id', 'customerName', 'customerEmail']
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        payments,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get all payments error:', error);
      return errorResponse(res, 'Failed to get payments', 500);
    }
  },

  getUserPayments: async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (status) whereClause.status = status;

      // Get user's bookings
      const userBookings = await Booking.findAll({
        where: { userId: req.user.id },
        attributes: ['id']
      });
      const bookingIds = userBookings.map(booking => booking.id);

      whereClause.bookingId = bookingIds;

      const { count, rows: payments } = await Payment.findAndCountAll({
        where: whereClause,
        include: [{
          model: Booking,
          as: 'booking',
          attributes: ['id', 'eventType', 'eventDate']
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        payments,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get user payments error:', error);
      return errorResponse(res, 'Failed to get payments', 500);
    }
  },

  handleWebhook: async (req, res) => {
    try {
      const webhookData = req.body;

      const result = await PaymentService.handlePaymentWebhook(webhookData);

      // Log audit
      await AuditLog.create({
        action: 'payment_webhook',
        resourceType: 'payment',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: webhookData
      });

      return successResponse(res, result, 'Webhook processed successfully');
    } catch (error) {
      logger.error('Payment webhook error:', error);
      return errorResponse(res, 'Webhook processing failed', 500);
    }
  }
};

module.exports = paymentController;