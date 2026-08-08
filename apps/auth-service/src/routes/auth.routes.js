const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const { requireServiceIdentity } = require('@sparkcrm/shared-middleware');

const requireGatewayUser = requireServiceIdentity('auth-service', {
    requireUser: true,
    allowedIssuers: ['api-gateway'],
});

// Public routes
router.post('/send-otp', authCtrl.sendOtp);
router.post('/verify-otp', authCtrl.verifyOtp);
router.post('/register-tenant', authCtrl.registerTenant);
router.post('/login', authCtrl.login);
router.post('/refresh-token', authCtrl.refreshToken);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/reset-password', authCtrl.resetPassword);
router.post('/owner-login', authCtrl.ownerLogin);
router.post('/login-2fa', authCtrl.login2FA);

// Protected routes
router.use(requireGatewayUser);
router.post('/logout', authCtrl.logout);
router.get('/me', authCtrl.getMe);
router.put('/active-branch', authCtrl.switchBranch);
router.put('/update-password', authCtrl.updatePassword);

// 2FA Routes
router.post('/2fa/generate', authCtrl.generate2FA);
router.post('/2fa/verify', authCtrl.verify2FA);
router.post('/2fa/disable', authCtrl.disable2FA);

// Trusted Devices Routes
router.get('/trusted-devices', authCtrl.getTrustedDevices);
router.post('/trusted-devices/revoke-all', authCtrl.revokeAllTrustedDevices);
router.delete('/trusted-devices/:id', authCtrl.revokeTrustedDevice);

module.exports = router;
