const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/whatsappConfig.controller');

/**
 * Middleware: only tenant Super Admin can manage WhatsApp configuration.
 * Regular agents cannot change org-level WhatsApp settings.
 */
const requireSuperAdmin = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (role !== 'superadmin') {
        return res.status(403).json({
            success: false,
            message: 'Only the tenant Super Admin can manage WhatsApp configuration.',
            code: 'FORBIDDEN',
        });
    }
    next();
};

// ─── WhatsApp Config Routes ───────────────────────────────────────────────────

// GET    /whatsapp/config          → fetch current config (read: all users, credentials masked)
// PUT    /whatsapp/config          → save/update config (Super Admin only)
// POST   /whatsapp/config/test     → test Meta API connection (Super Admin only)
// DELETE /whatsapp/config          → remove config (Super Admin only)
// PUT    /whatsapp/config/phone-pool → manage per-agent number pool (Super Admin only)

router.get('/',            ctrl.getConfig);
router.put('/',            requireSuperAdmin, ctrl.saveConfig);
router.post('/test',       requireSuperAdmin, ctrl.testConfig);
router.delete('/',         requireSuperAdmin, ctrl.deleteConfig);
router.put('/phone-pool',  requireSuperAdmin, ctrl.managePhonePool);

module.exports = router;
