const { Payment, Booking, Notification, AuditLog } = require('../models');
const { generateQRCode, generatePaymentQRData } = require('../utils/qrCodeUtil');
const { generateToken } = require('../utils/otp');
const EmailService = require('./emailService');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

class PaymentService {
  static async createPayment(bookingId, paymentData) {
    const transaction = await require('../config/database').sequelize.transaction();
    
    try {
      const booking = await Booking.findByPk(bookingId, { transaction });
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.paymentStatus === 'paid') {
        throw new Error('Booking already paid');
      }

      const payment = await Payment.create({
        bookingId,
        amount: booking.priceCalculated,
        currency: 'ETB',
        paymentMethod: paymentData.paymentMethod,
        phoneNumber: paymentData.phoneNumber,
        status: 'pending',
        transactionId: generateToken(8).toUpperCase(),
      }, { transaction });

      await booking.update({ paymentStatus: 'processing' }, { transaction });

      await transaction.commit();

      // Notify admin about new payment
      await NotificationService.notifyAdmins(
        'payment_created',
        `New payment created for booking ${bookingId}`,
        { bookingId, paymentId: payment.id, amount: payment.amount }
      );

      return payment;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error creating payment:', error);
      throw error;
    }
  }

  static async processPayment(paymentId, simulateSuccess = true) {
    const transaction = await require('../config/database').sequelize.transaction();
    
    try {
      const payment = await Payment.findByPk(paymentId, {
        include: [{ model: Booking, as: 'booking' }],
        transaction
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'pending') {
        throw new Error('Payment already processed');
      }

      // Simulate payment processing
      if (simulateSuccess) {
        payment.status = 'completed';
        payment.booking.paymentStatus = 'paid';
        payment.booking.status = 'confirmed';

        // Generate QR code
        const qrData = generatePaymentQRData({
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          phoneNumber: payment.phoneNumber,
          transactionId: payment.transactionId,
          date: new Date().toLocaleDateString(),
        });

        const qrResult = await generateQRCode(qrData, {
          saveToFile: true,
          fileName: `payment_${payment.id}.png`
        });

        if (qrResult.success) {
          payment.qrCodeUrl = qrResult.url;
          payment.booking.qrCodeUrl = qrResult.url;
          payment.booking.transactionId = payment.transactionId;
        }

        await payment.save({ transaction });
        await payment.booking.save({ transaction });

        // Send notifications and emails
        await NotificationService.createNotification(
          payment.booking.userId,
          'payment_completed',
          'Payment completed successfully',
          { paymentId: payment.id, bookingId: payment.booking.id }
        );

        await EmailService.sendPaymentReceipt(payment, payment.booking);

        logger.info(`Payment ${paymentId} processed successfully`);
      } else {
        payment.status = 'failed';
        payment.booking.paymentStatus = 'failed';
        
        await payment.save({ transaction });
        await payment.booking.save({ transaction });

        await NotificationService.createNotification(
          payment.booking.userId,
          'payment_failed',
          'Payment failed. Please try again.',
          { paymentId: payment.id }
        );
      }

      await transaction.commit();
      return payment;
    } catch (error) {
      await transaction.rollback();
      logger.error('Error processing payment:', error);
      throw error;
    }
  }

  static async getPaymentInstructions(paymentMethod, amount, phoneNumber = null) {
    const instructions = {
      telebirr: {
        title: 'Telebirr Payment Instructions',
        steps: [
          'Open your Telebirr app',
          'Go to "Send Money"',
          `Enter amount: ${amount} ETB`,
          phoneNumber ? `Enter phone number: ${phoneNumber}` : 'Enter recipient number',
          'Add note: "Event Booking Payment"',
          'Confirm and complete payment'
        ],
        note: 'Payment will be verified automatically within 2-3 minutes.'
      },
      cbe: {
        title: 'CBE Birr Payment Instructions',
        steps: [
          'Dial *847# on your phone',
          'Select "Send Money"',
          `Enter amount: ${amount} ETB`,
          phoneNumber ? `Enter phone number: ${phoneNumber}` : 'Enter recipient number',
          'Confirm transaction with your PIN'
        ],
        note: 'Keep the transaction reference for verification.'
      },
      abisiniya: {
        title: 'Abyssinia Bank Payment Instructions',
        steps: [
          'Visit Abyssinia Bank branch or use internet banking',
          'Make deposit to account: 1234567890',
          `Amount: ${amount} ETB`,
          'Use your phone number as reference'
        ],
        note: 'Email the deposit slip to payments@eventbooking.com'
      },
      commercial: {
        title: 'Commercial Bank Payment Instructions',
        steps: [
          'Visit Commercial Bank branch or use internet banking',
          'Make deposit to account: 0987654321',
          `Amount: ${amount} ETB`,
          'Use your phone number as reference'
        ],
        note: 'Email the deposit slip to payments@eventbooking.com'
      }
    };

    return instructions[paymentMethod] || {
      title: 'Payment Instructions',
      steps: ['Contact support for payment instructions'],
      note: 'Payment method not recognized'
    };
  }

  static async handlePaymentWebhook(webhookData) {
    // This would be implemented based on the specific payment provider's webhook format
    // For now, it's a placeholder for actual payment gateway integration
    logger.info('Payment webhook received:', webhookData);
    
    // Example implementation for Telebirr webhook
    if (webhookData.provider === 'telebirr') {
      const { transactionId, status, amount } = webhookData;
      
      const payment = await Payment.findOne({ where: { transactionId } });
      if (payment) {
        if (status === 'success' && payment.amount === amount) {
          await this.processPayment(payment.id, true);
        } else {
          await this.processPayment(payment.id, false);
        }
      }
    }
    
    return { success: true, message: 'Webhook processed' };
  }
}

module.exports = PaymentService;