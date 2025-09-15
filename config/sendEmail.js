const nodemailer = require('nodemailer');
const config = require('./env');
const logger = require('../utils/logger');

// Create a development transporter that doesn't actually send emails
const createDevelopmentTransporter = () => {
  return {
    sendMail: (mailOptions) => {
      return new Promise((resolve) => {
        // Simulate email sending in development
        const info = {
          messageId: `<development-${Date.now()}@event-booking.local>`,
          envelope: {
            from: mailOptions.from,
            to: mailOptions.to
          }
        };
        resolve(info);
      });
    },
    verify: (callback) => {
      callback(null, true);
    }
  };
};

// Create production transporter
const createProductionTransporter = () => {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465, // true for 465, false for other ports
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  // Verify transporter connection
  transporter.verify((error, success) => {
    if (error) {
      logger.error('SMTP connection error:', error);
    } else {
      logger.info('SMTP server is ready to take messages');
    }
  });

  return transporter;
};

// Use appropriate transporter based on environment
const transporter = config.nodeEnv === 'production' 
  ? createProductionTransporter() 
  : createDevelopmentTransporter();

const sendEmail = async (to, subject, html) => {
  try {
    if (config.nodeEnv === 'development') {
      // In development, log email instead of sending through SMTP
      logger.info(`Email would be sent to: ${to}`);
      logger.info(`Subject: ${subject}`);
      logger.info(`HTML content length: ${html.length} characters`);
      
      // Also log to console for easier debugging
      console.log('=== EMAIL SIMULATION (Development Mode) ===');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('Content:', html.substring(0, 200) + '...');
      console.log('==========================================');
      
      // Use the development transporter to simulate sending
      const info = await transporter.sendMail({
        from: `"Event Booking Platform" <${config.smtp.user || 'noreply@event-booking.local'}>`,
        to,
        subject,
        html,
      });

      return { success: true, messageId: info.messageId, development: true };
    }

    // In production, use real SMTP
    const info = await transporter.sendMail({
      from: `"Event Booking Platform" <${config.smtp.user}>`,
      to,
      subject,
      html,
    });

    logger.info(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending email:', error);
    return { 
      success: false, 
      error: error.message,
      stack: error.stack 
    };
  }
};

module.exports = sendEmail;