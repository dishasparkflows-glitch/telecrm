const express = require('express');
const { getConfigs, saveConfig, testConnection, getActiveMethods } = require('../controllers/paymentConfig.controller');
const { ApiError } = require('@sparkcrm/shared-utils');
const { requireTrustedGateway } = require('../middleware/serviceAuth.middleware');

const router = express.Router();

// Public / Tenant reachable route
router.get('/active-methods', getActiveMethods);
router.use(requireTrustedGateway);

// Middleware to ensure request passed through API Gateway auth (for /configs routes only)
const requireOwner = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (!userId || userRole !== 'owner') {
        return next(ApiError.unauthorized('Access denied. Owner only.'));
    }
    next();
};

// Owner-only routes below
router.route('/configs')
    .get(requireOwner, getConfigs)
    .post(requireOwner, saveConfig);

router.post('/configs/:provider/test', requireOwner, testConnection);

module.exports = router;
