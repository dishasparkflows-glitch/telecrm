const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/meeting.controller');
const { requireVerifiedUser } = require('../middleware/security');

const requireGatewayUser = requireVerifiedUser('meeting-service');

router.get('/book/:slug', ctrl.getBookingLinkBySlug); // Public
router.post('/book/:slug', ctrl.bookMeeting); // Public
router.use(requireGatewayUser);
router.get('/', ctrl.getMeetings);
router.post('/schedule', ctrl.scheduleMeeting);
router.get('/booking-links', ctrl.getBookingLinks);
router.post('/booking-links', ctrl.createBookingLink);
router.delete('/booking-links/:id', ctrl.deleteBookingLink);

router.get('/:id', ctrl.getMeeting);
router.put('/:id', ctrl.updateMeeting);
router.delete('/:id', ctrl.deleteMeeting);
router.post('/:id/comments', ctrl.addMeetingComment);
router.post('/:id/attachments', ctrl.addMeetingAttachment);

module.exports = router;
