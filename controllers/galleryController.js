const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { Gallery, AuditLog } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// Validation schemas
const createGalleryItemSchema = Joi.object({
  title: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(1000).optional(),
  category: Joi.string().valid(
    'wedding', 'birthday', 'corporate', 'decoration', 'catering', 'other'
  ).required(),
  location: Joi.string().max(100).optional(),
  date: Joi.date().max('now').optional(),
});

const updateGalleryItemSchema = Joi.object({
  title: Joi.string().min(2).max(100),
  description: Joi.string().max(1000),
  category: Joi.string().valid(
    'wedding', 'birthday', 'corporate', 'decoration', 'catering', 'other'
  ),
  location: Joi.string().max(100),
  date: Joi.date().max('now'),
}).min(1);

const galleryController = {
  createGalleryItem: async (req, res) => {
    try {
      const { error, value } = createGalleryItemSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      if (!req.file) {
        return errorResponse(res, 'Image file is required', 400);
      }

      const galleryItem = await Gallery.create({
        ...value,
        imageFilename: req.file.filename,
        imageUrl: `/uploads/gallery/${req.file.filename}`,
      });

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'create_gallery_item',
        resourceType: 'gallery',
        resourceId: galleryItem.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { title: galleryItem.title, category: galleryItem.category }
      });

      return successResponse(res, galleryItem, 'Gallery item created successfully', 201);
    } catch (error) {
      logger.error('Create gallery item error:', error);
      return errorResponse(res, 'Failed to create gallery item', 500);
    }
  },

  getAllGalleryItems: async (req, res) => {
    try {
      const { page = 1, limit = 20, category, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (category) whereClause.category = category;

      if (search) {
        whereClause[require('sequelize').Op.or] = [
          { title: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { description: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { location: { [require('sequelize').Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: galleryItems } = await Gallery.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        galleryItems,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get all gallery items error:', error);
      return errorResponse(res, 'Failed to get gallery items', 500);
    }
  },

  getGalleryItem: async (req, res) => {
    try {
      const { id } = req.params;

      const galleryItem = await Gallery.findByPk(id);
      if (!galleryItem) {
        return errorResponse(res, 'Gallery item not found', 404);
      }

      return successResponse(res, galleryItem);
    } catch (error) {
      logger.error('Get gallery item error:', error);
      return errorResponse(res, 'Failed to get gallery item', 500);
    }
  },

  updateGalleryItem: async (req, res) => {
    try {
      const { error, value } = updateGalleryItemSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { id } = req.params;
      const galleryItem = await Gallery.findByPk(id);

      if (!galleryItem) {
        return errorResponse(res, 'Gallery item not found', 404);
      }

      await galleryItem.update(value);

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'update_gallery_item',
        resourceType: 'gallery',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: value
      });

      return successResponse(res, galleryItem, 'Gallery item updated successfully');
    } catch (error) {
      logger.error('Update gallery item error:', error);
      return errorResponse(res, 'Failed to update gallery item', 500);
    }
  },

  deleteGalleryItem: async (req, res) => {
    try {
      const { id } = req.params;

      const galleryItem = await Gallery.findByPk(id);
      if (!galleryItem) {
        return errorResponse(res, 'Gallery item not found', 404);
      }

      // Delete image file
      const imagePath = path.join(__dirname, '..', galleryItem.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      await galleryItem.destroy();

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'delete_gallery_item',
        resourceType: 'gallery',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'Gallery item deleted successfully');
    } catch (error) {
      logger.error('Delete gallery item error:', error);
      return errorResponse(res, 'Failed to delete gallery item', 500);
    }
  }
};

module.exports = galleryController;