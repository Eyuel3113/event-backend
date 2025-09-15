const getVerificationEmailTemplate = (name, verificationUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #4F46E5; 
          color: white; 
          text-decoration: none; 
          border-radius: 4px; 
          margin: 20px 0;
        }
        .footer { 
          text-align: center; 
          margin-top: 20px; 
          color: #666; 
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Thank you for registering with our Event Booking Platform. To complete your registration, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
          <p>${verificationUrl}</p>
          
          <p>This verification link will expire in 24 hours.</p>
          
          <p>If you didn't create an account with us, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Event Booking Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getPasswordResetTemplate = (name, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #4F46E5; 
          color: white; 
          text-decoration: none; 
          border-radius: 4px; 
          margin: 20px 0;
        }
        .footer { 
          text-align: center; 
          margin-top: 20px; 
          color: #666; 
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>We received a request to reset your password for your Event Booking Platform account. Click the button below to reset your password:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
          <p>${resetUrl}</p>
          
          <p>This password reset link will expire in 1 hour.</p>
          
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Event Booking Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getBookingConfirmationTemplate = (booking) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; }
        .details { background-color: white; padding: 20px; border-radius: 4px; border: 1px solid #ddd; }
        .footer { 
          text-align: center; 
          margin-top: 20px; 
          color: #666; 
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmation</h1>
        </div>
        <div class="content">
          <h2>Thank you for your booking!</h2>
          <p>Your booking has been confirmed. Here are your booking details:</p>
          
          <div class="details">
            <h3>Booking #${booking.id}</h3>
            <p><strong>Event:</strong> ${booking.eventName}</p>
            <p><strong>Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${booking.eventTime}</p>
            <p><strong>Location:</strong> ${booking.eventLocation}</p>
            <p><strong>Number of Tickets:</strong> ${booking.ticketCount}</p>
            <p><strong>Total Amount:</strong> $${booking.totalAmount}</p>
          </div>
          
          <p>We look forward to seeing you at the event!</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Event Booking Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getPaymentReceiptTemplate = (payment, booking) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; }
        .details { background-color: white; padding: 20px; border-radius: 4px; border: 1px solid #ddd; }
        .footer { 
          text-align: center; 
          margin-top: 20px; 
          color: #666; 
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Receipt</h1>
        </div>
        <div class="content">
          <h2>Thank you for your payment!</h2>
          <p>Your payment has been processed successfully. Here is your receipt:</p>
          
          <div class="details">
            <h3>Payment #${payment.id}</h3>
            <p><strong>Booking Reference:</strong> ${booking.id}</p>
            <p><strong>Event:</strong> ${booking.eventName}</p>
            <p><strong>Payment Date:</strong> ${new Date(payment.paymentDate).toLocaleDateString()}</p>
            <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
            <p><strong>Amount Paid:</strong> $${payment.amount}</p>
            <p><strong>Status:</strong> ${payment.status}</p>
          </div>
          
          <p>This receipt confirms your payment for the above booking.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Event Booking Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  getVerificationEmailTemplate,
  getPasswordResetTemplate,
  getBookingConfirmationTemplate,
  getPaymentReceiptTemplate,
};