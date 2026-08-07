const express = require('express');
const router = express.Router();
const ownerCtrl = require('../controllers/owner.controller');

// ─── Dashboard ───
router.get('/dashboard', ownerCtrl.getDashboard);

// ─── Tenant Management ───
router.get('/tenants', ownerCtrl.listTenants);
router.get('/tenants/:id', ownerCtrl.getTenantDetail);
router.put('/tenants/:id/plan', ownerCtrl.updateTenantPlan);
router.put('/tenants/:id/status', ownerCtrl.updateTenantStatus);
router.put('/tenants/:id/features', ownerCtrl.updateTenantFeatures);
router.put('/tenants/:id/payment-methods', ownerCtrl.updateTenantPaymentMethods);
// Assign Exotel virtual number + toggle calling for a tenant
router.put('/tenants/:id/calling', ownerCtrl.updateTenantCalling);

// ─── Communication Config (Global) ───
router.get('/communication-configs', ownerCtrl.getCommunicationConfigs);
router.put('/communication-configs/:type', ownerCtrl.updateCommunicationConfig);
router.post('/communication-configs/:type/test', ownerCtrl.testCommunicationConfig);

// ─── User Management ───
router.put('/users/:id/status', ownerCtrl.updateUserStatus);

// ─── Plan Management ───
router.get('/plans', ownerCtrl.listPlans);
router.post('/plans', ownerCtrl.createPlan);
router.put('/plans/:id', ownerCtrl.updatePlan);
router.delete('/plans/:id', ownerCtrl.deletePlan);

// ─── Revenue ───
router.get('/revenue', ownerCtrl.getRevenue);

// ─── Impersonation ───
router.post('/impersonate/:tenantId', ownerCtrl.impersonateTenant);

module.exports = router;
