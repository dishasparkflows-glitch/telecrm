const express = require('express');
const router = express.Router();
const branchCtrl = require('../controllers/branch.controller');

router.get('/', branchCtrl.getBranches);
router.post('/', branchCtrl.createBranch);
router.get('/:id', branchCtrl.getBranch);
router.put('/:id', branchCtrl.updateBranch);
router.delete('/:id', branchCtrl.deleteBranch);

module.exports = router;
