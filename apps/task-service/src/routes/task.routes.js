const express = require('express');
const taskController = require('../controllers/task.controller');

const router = express.Router();

router.get('/', taskController.getTasks);
router.get('/calendar', taskController.getCalendarTasks);
router.get('/stats', taskController.getTaskStats);
router.post('/', taskController.createTask);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
