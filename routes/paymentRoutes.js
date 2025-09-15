const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Protected routes
router.get('/my-payments', authenticateToken, paymentController.getUserPayments);
router.get('/:id', authenticateToken, paymentController.getPayment);
router.post('/:id/process', authenticateToken, requireAdmin, paymentController.processPayment);

// Admin only routes
router.get('/admin/payments', authenticateToken, requireAdmin, paymentController.getAllPayments);

// Webhook route (no auth required for payment providers)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;