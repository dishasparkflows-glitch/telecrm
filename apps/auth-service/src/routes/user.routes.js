const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/user.controller');

router.post('/invite', userCtrl.inviteUser);
router.get('/all', userCtrl.getAllUsersList);
router.get('/', userCtrl.getUsers);
router.get('/:id', userCtrl.getUserById);
router.put('/:id', userCtrl.updateUser);
router.put('/:id/role', userCtrl.updateUserRole);
router.put('/:id/status', userCtrl.updateUserStatus);
router.delete('/:id', userCtrl.deleteUser);

module.exports = router;
