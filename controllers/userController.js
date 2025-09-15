const Joi = require('joi');
const { User, AuditLog } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const { Sequelize } = require('sequelize');

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  address: Joi.string().max(255),
  city: Joi.string().max(100),
  dob: Joi.date().max('now'),
}).min(1);

const updateUserSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  email: Joi.string().email(),
  phone: Joi.string().min(10).max(15),
  role: Joi.string().valid('user', 'admin'),
  status: Joi.string().valid('active', 'inactive', 'pending', 'suspended'),
}).min(1);

const userController = {
  // This function was missing - added it
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
  },

  updateProfile: async (req, res) => {
    try {
      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const userId = req.user.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      await user.update(value);

      // Log audit
      await AuditLog.create({
        userId,
        action: 'update_profile',
        resourceType: 'user',
        resourceId: userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: value
      });

      return successResponse(res, {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        dob: user.dob
      }, 'Profile updated successfully');
    } catch (error) {
      logger.error('Update profile error:', error);
      return errorResponse(res, 'Failed to update profile', 500);
    }
  },

  // Admin only endpoints
  getAllUsers: async (req, res) => {
    try {
      const { page = 1, limit = 20, search, role, status } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause[Sequelize.Op.or] = [
          { firstName: { [Sequelize.Op.iLike]: `%${search}%` } },
          { lastName: { [Sequelize.Op.iLike]: `%${search}%` } },
          { email: { [Sequelize.Op.iLike]: `%${search}%` } },
          { phone: { [Sequelize.Op.iLike]: `%${search}%` } }
        ];
      }

      if (role) whereClause.role = role;
      if (status) whereClause.status = status;

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        attributes: { exclude: ['passwordHash', 'verificationTokenHash', 'resetPasswordTokenHash'] },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        users,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get all users error:', error);
      return errorResponse(res, 'Failed to get users', 500);
    }
  },

  getUserById: async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        attributes: { exclude: ['passwordHash', 'verificationTokenHash', 'resetPasswordTokenHash'] }
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      return successResponse(res, user);
    } catch (error) {
      logger.error('Get user by id error:', error);
      return errorResponse(res, 'Failed to get user', 500);
    }
  },

  updateUser: async (req, res) => {
    try {
      const { error, value } = updateUserSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { id } = req.params;
      const user = await User.findByPk(id);

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Check if email/phone already exists (excluding current user)
      if (value.email || value.phone) {
        const whereClause = {
          id: { [Sequelize.Op.ne]: id }
        };

        if (value.email && value.phone) {
          whereClause[Sequelize.Op.or] = [
            { email: value.email },
            { phone: value.phone }
          ];
        } else if (value.email) {
          whereClause.email = value.email;
        } else if (value.phone) {
          whereClause.phone = value.phone;
        }

        const existingUser = await User.findOne({ where: whereClause });
        if (existingUser) {
          return errorResponse(res, 'Email or phone already exists', 409);
        }
      }

      await user.update(value);

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'update_user',
        resourceType: 'user',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: value
      });

      return successResponse(res, {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      }, 'User updated successfully');
    } catch (error) {
      logger.error('Update user error:', error);
      return errorResponse(res, 'Failed to update user', 500);
    }
  },

  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;

      if (id === req.user.id) {
        return errorResponse(res, 'Cannot delete your own account', 400);
      }

      const user = await User.findByPk(id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      await user.destroy();

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'delete_user',
        resourceType: 'user',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'User deleted successfully');
    } catch (error) {
      logger.error('Delete user error:', error);
      return errorResponse(res, 'Failed to delete user', 500);
    }
  }
};

module.exports = userController;