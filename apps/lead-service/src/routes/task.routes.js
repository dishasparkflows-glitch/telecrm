const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');

router.get('/', taskController.getTasks);
router.get('/calendar', taskController.getCalendarTasks);
router.get('/stats', taskController.getTaskStats);

router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.patch('/:id/status', taskController.updateTask); // Reuse update
router.delete('/:id', taskController.deleteTask);

module.exports = router;
