const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { User, AuditLog } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const { generateToken, hashToken, verifyToken, generateExpiryTime, isTokenExpired } = require('../utils/otp');
const EmailService = require('../services/emailService');
const logger = require('../utils/logger');
const config = require('../config/env');
const { Sequelize } = require('sequelize');
const sendMail = require("../utils/email");

// Validation schemas
const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(10).max(15).required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  identifier: Joi.string().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

// Generate JWT tokens
const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpires }
  );

  const refreshToken = jwt.sign(
    { userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpires }
  );

  return { accessToken, refreshToken };
};

const authController = {
  register: async (req, res) => {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { firstName, lastName, email, phone, password } = value;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Sequelize.Op.or]: [{ email }, { phone }]
        }
      });

      if (existingUser) {
        return errorResponse(res, 'User with this email or phone already exists', 409);
      }

      const transaction = await require('../config/database').sequelize.transaction();

      try {
        // Create user with email automatically verified
        const user = await User.create({
          firstName,
          lastName,
          email,
          phone,
          passwordHash: password,
          status: 'active',
          emailVerified: true,  // Auto-verify email
          verificationTokenHash: null,
          verificationTokenExpires: null
        }, { transaction });

        await transaction.commit();

        // Log audit
        await AuditLog.create({
          action: 'register',
          resourceType: 'user',
          resourceId: user.id,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          data: { email, phone }
        });


      
// send email 
          await sendMail(
            user.email,
            "Registered Successfully",
            `Hello ${user.firstName}, your booking is confirmed!`,
            `<h1>Registered Confirmed</h1><p>Thank you for register our System.</p>`
          );



        return successResponse(res, {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified
        }, 'Registration successful. You can now login.', 201);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('Registration error:', error);
      return errorResponse(res, 'Registration failed', 500);
    }
  },

  verifyEmail: async (req, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return errorResponse(res, 'Verification token required', 400);
      }

      // Find all users with verification tokens and check each one
      const users = await User.findAll({
        where: {
          verificationTokenHash: { [Sequelize.Op.ne]: null }
        }
      });

      let user = null;
      for (const u of users) {
        if (u.verificationTokenHash) {
          const isValid = await verifyToken(token, u.verificationTokenHash);
          const isExpired = isTokenExpired(u.verificationTokenExpires);
          
          if (isValid && !isExpired) {
            user = u;
            break;
          }
        }
      }

      if (!user) {
        return errorResponse(res, 'Invalid or expired verification token', 400);
      }

      await user.update({
        emailVerified: true,
        status: 'active',
        verificationTokenHash: null,
        verificationTokenExpires: null
      });

      // Log audit
      await AuditLog.create({
        userId: user.id,
        action: 'email_verified',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'Email verified successfully.');
    } catch (error) {
      logger.error('Email verification error:', error);
      return errorResponse(res, 'Email verification failed', 500);
    }
  },

  login: async (req, res) => {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { identifier, password } = value;

      // Find user by email or phone
      const user = await User.findOne({
        where: {
          [Sequelize.Op.or]: [
            { email: identifier },
            { phone: identifier }
          ]
        }
      });

      if (!user) {
        return errorResponse(res, 'Invalid credentials', 401);
      }

      if (user.status === 'suspended') {
        return errorResponse(res, 'Account suspended. Please contact support.', 403);
      }

      // REMOVED: Email verification check - users can login without verification
      // if (!user.emailVerified) {
      //   return errorResponse(res, 'Please verify your email before logging in', 403);
      // }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return errorResponse(res, 'Invalid credentials', 401);
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user.id, user.role);

      // Store refresh token hash in database
      const refreshTokenHash = await hashToken(refreshToken);
      await user.update({ refreshTokenHash });

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Log audit
      await AuditLog.create({
        userId: user.id,
        action: 'login',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, {
        accessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified
        }
      }, 'Login successful');
    } catch (error) {
      logger.error('Login error:', error);
      return errorResponse(res, 'Login failed', 500);
    }
  },

  refreshToken: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return errorResponse(res, 'Refresh token required', 401);
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      const user = await User.findByPk(decoded.userId);

      if (!user || !user.refreshTokenHash) {
        return errorResponse(res, 'Invalid refresh token', 401);
      }

      // Verify stored hash
      const isValid = await verifyToken(refreshToken, user.refreshTokenHash);
      if (!isValid) {
        return errorResponse(res, 'Invalid refresh token', 401);
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);

      // Update refresh token hash
      const newRefreshTokenHash = await hashToken(newRefreshToken);
      await user.update({ refreshTokenHash: newRefreshTokenHash });

      // Set new refresh token cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return successResponse(res, {
        accessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      }, 'Token refreshed successfully');
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return errorResponse(res, 'Refresh token expired', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        return errorResponse(res, 'Invalid refresh token', 401);
      }
      logger.error('Token refresh error:', error);
      return errorResponse(res, 'Token refresh failed', 500);
    }
  },

  logout: async (req, res) => {
    try {
      const userId = req.user.id;

      // Clear refresh token from database
      await User.update({ refreshTokenHash: null }, { where: { id: userId } });

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      // Log audit
      await AuditLog.create({
        userId,
        action: 'logout',
        resourceType: 'user',
        resourceId: userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'Logout successful');
    } catch (error) {
      logger.error('Logout error:', error);
      return errorResponse(res, 'Logout failed', 500);
    }
  },

forgotPassword: async (req, res) => {
  try {
    // Validate request body
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      return validationErrorResponse(res, error);
    }

    const { email } = value;

    // Find user by email
    const user = await User.findOne({ where: { email } });

    // If user doesn't exist, don't reveal it
    if (!user) {
      return successResponse(res, null, 'If the email exists, a reset link has been sent');
    }

    // Check if user is active
    if (user.status !== 'active') {
      return errorResponse(res, 'Account is not active', 403);
    }

    // Generate reset token and hash it
    const resetToken = generateToken();
    const resetTokenHash = await hashToken(resetToken);

    // Set token expiry (1 hour from now)
    const resetTokenExpires = generateExpiryTime(60); // 60 minutes

    // Update user with hashed reset token and expiry
    await user.update({
      resetPasswordTokenHash: resetTokenHash,
      resetPasswordExpires: resetTokenExpires
    });

    // Build reset password link
    const link = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;

    // Send reset password email
    await sendMail(
      user.email,
      "Password Reset Request",
      `Hello ${user.firstName}, please use the link below to reset your password:`,
      `<h1>Password Reset Request</h1><p>Click the link below to reset your password:</p><a href="${link}">Reset Password</a>`
    );

    // Log audit event
    await AuditLog.create({
      userId: user.id,
      action: 'forgot_password',
      resourceType: 'user',
      resourceId: user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "If the email exists, a reset link has been sent",
      link // optional: remove in production
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    return errorResponse(res, 'Password reset request failed', 500);
  }
},


  resetPassword: async (req, res) => {
    try {
      const { error, value } = resetPasswordSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { token, newPassword } = value;

      // Find all users with reset tokens and check each one
      const users = await User.findAll({
        where: {
          resetPasswordTokenHash: { [Sequelize.Op.ne]: null }
        }
      });

      let user = null;
      for (const u of users) {
        if (u.resetPasswordTokenHash) {
          const isValid = await verifyToken(token, u.resetPasswordTokenHash);
          const isExpired = isTokenExpired(u.resetPasswordExpires);
          
          if (isValid && !isExpired) {
            user = u;
            break;
          }
        }
      }

      if (!user) {
        return errorResponse(res, 'Invalid or expired reset token', 400);
      }

      // Update password and clear reset token
      await user.update({
        passwordHash: newPassword,
        resetPasswordTokenHash: null,
        resetPasswordExpires: null,
        loginAttempts: 0,
        lockUntil: null
      });

      // Log audit
      await AuditLog.create({
        userId: user.id,
        action: 'password_reset',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
// send email 
          await sendMail(
            user.email,
            "Password reset Successfully",
            `Hello ${user.firstName}, your password reset is confirmed!`,
            `<h1>Password Reset</h1><p>Your password reset successfully</p>`
          );
      return successResponse(res, null, 'Password reset successfully. You can now login with your new password.');
    } catch (error) {
      logger.error('Reset password error:', error);
      return errorResponse(res, 'Password reset failed', 500);
    }
  },

  getMe: async (req, res) => {
    try {
      const user = req.user;
      return successResponse(res, {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        dob: user.dob,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } catch (error) {
      logger.error('Get me error:', error);
      return errorResponse(res, 'Failed to get user data', 500);
    }
  }
};

module.exports = authController;