const { Booking, Payment, Service, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const { Sequelize } = require('sequelize');

const reportController = {
  getDashboardMetrics: async (req, res) => {
    try {
      const [
        totalUsers,
        totalBookings,
        totalRevenue,
        pendingBookings,
        activeUsers,
        serviceDistribution,
        recentBookings
      ] = await Promise.all([
        User.count(),
        Booking.count(),
        Payment.sum('amount', { where: { status: 'completed' } }),
        Booking.count({ where: { status: 'pending' } }),
        User.count({ where: { status: 'active' } }),
        Booking.findAll({
          attributes: [
            'eventType',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
          ],
          group: ['eventType'],
          raw: true
        }),
        Booking.findAll({
          include: [{
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName']
          }],
          order: [['createdAt', 'DESC']],
          limit: 10
        })
      ]);

      const metrics = {
        totals: {
          users: totalUsers || 0,
          bookings: totalBookings || 0,
          revenue: totalRevenue || 0,
          pendingBookings: pendingBookings || 0,
          activeUsers: activeUsers || 0
        },
        serviceDistribution: serviceDistribution.reduce((acc, item) => {
          acc[item.eventType] = parseInt(item.count);
          return acc;
        }, {}),
        recentActivity: recentBookings
      };

      return successResponse(res, metrics);
    } catch (error) {
      logger.error('Get dashboard metrics error:', error);
      return errorResponse(res, 'Failed to get dashboard metrics', 500);
    }
  },

  getBookingsOverTime: async (req, res) => {
    try {
      const { from, to, groupBy = 'day' } = req.query;

      let whereClause = {};
      if (from && to) {
        whereClause.createdAt = {
          [Sequelize.Op.between]: [new Date(from), new Date(to)]
        };
      }

      let groupFormat;
      switch (groupBy) {
        case 'hour':
          groupFormat = '%Y-%m-%d %H:00';
          break;
        case 'week':
          groupFormat = '%Y-%U';
          break;
        case 'month':
          groupFormat = '%Y-%m';
          break;
        default:
          groupFormat = '%Y-%m-%d';
      }

      const bookingsOverTime = await Booking.findAll({
        attributes: [
          [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), groupFormat), 'period'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        where: whereClause,
        group: ['period'],
        order: [[Sequelize.col('period'), 'ASC']],
        raw: true
      });

      return successResponse(res, bookingsOverTime);
    } catch (error) {
      logger.error('Get bookings over time error:', error);
      return errorResponse(res, 'Failed to get bookings over time', 500);
    }
  },

  getRevenueOverTime: async (req, res) => {
    try {
      const { from, to, groupBy = 'day' } = req.query;

      let whereClause = { status: 'completed' };
      if (from && to) {
        whereClause.createdAt = {
          [Sequelize.Op.between]: [new Date(from), new Date(to)]
        };
      }
      let groupFormat;
      switch (groupBy) {
        case 'hour':
          groupFormat = '%Y-%m-%d %H:00';
          break;
        case 'week':
          groupFormat = '%Y-%U';
          break;
        case 'month':
          groupFormat = '%Y-%m';
          break;
        default:
          groupFormat = '%Y-%m-%d';
      }

      const revenueOverTime = await Payment.findAll({
        attributes: [
          [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), groupFormat), 'period'],
          [Sequelize.fn('SUM', Sequelize.col('amount')), 'revenue'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'transactions']
        ],
        where: whereClause,
        group: ['period'],
        order: [[Sequelize.col('period'), 'ASC']],
        raw: true
      });

      return successResponse(res, revenueOverTime);
    } catch (error) {
      logger.error('Get revenue over time error:', error);
      return errorResponse(res, 'Failed to get revenue over time', 500);
    }
  },

  getServiceDistribution: async (req, res) => {
    try {
      const serviceDistribution = await Booking.findAll({
        attributes: [
          'eventType',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'bookings'],
          [Sequelize.fn('SUM', Sequelize.col('priceCalculated')), 'revenue']
        ],
        group: ['eventType'],
        order: [[Sequelize.col('bookings'), 'DESC']],
        raw: true
      });

      return successResponse(res, serviceDistribution);
    } catch (error) {
      logger.error('Get service distribution error:', error);
      return errorResponse(res, 'Failed to get service distribution', 500);
    }
  },

  getTrafficSource: async (req, res) => {
    try {
      // This would typically come from analytics data
      // For now, we'll return mock data
      const trafficSources = [
        { source: 'Direct', visitors: 45, conversions: 12 },
        { source: 'Google', visitors: 120, conversions: 34 },
        { source: 'Facebook', visitors: 78, conversions: 23 },
        { source: 'Instagram', visitors: 56, conversions: 18 },
        { source: 'Referral', visitors: 34, conversions: 9 }
      ];

      return successResponse(res, trafficSources);
    } catch (error) {
      logger.error('Get traffic source error:', error);
      return errorResponse(res, 'Failed to get traffic source data', 500);
    }
  }
};

module.exports = reportController;