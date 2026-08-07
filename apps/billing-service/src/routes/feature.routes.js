const express = require('express');
const router = express.Router();
const featureCtrl = require('../controllers/feature.controller');

router.get('/store', featureCtrl.getFeatureStore);
router.get('/purchased', featureCtrl.getPurchasedFeatures);
router.post('/purchase', featureCtrl.purchaseFeature);
router.post('/activate', featureCtrl.activateFeature);
router.post('/cancel', featureCtrl.cancelFeature);

module.exports = router;
