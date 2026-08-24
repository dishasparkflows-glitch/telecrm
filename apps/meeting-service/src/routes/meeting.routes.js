const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/meeting.controller');
const { requireVerifiedUser } = require('../middleware/security');

const requireGatewayUser = requireVerifiedUser('meeting-service');

router.get('/book/:slug', ctrl.getBookingLinkBySlug); // Public
router.get('/book/:slug/availability', ctrl.getBookingAvailability); // Public
router.post('/book/:slug', ctrl.bookMeeting); // Public
router.get('/google/callback', ctrl.googleAuthCallback); // Public for Google redirect

router.use(requireGatewayUser);

// Google Integration Routes
router.get('/google/auth', ctrl.googleAuthUrl);
router.get('/google/status', ctrl.googleAuthStatus);
router.post('/google/disconnect', ctrl.googleDisconnect);
router.get('/google/calendars', ctrl.googleGetCalendars);

router.get('/', ctrl.getMeetings);
router.get('/calendar', ctrl.getCalendarMeetings);
router.get('/stats', ctrl.getMeetingStats);
router.post('/schedule', ctrl.scheduleMeeting);
router.post('/check-availability', ctrl.checkAvailability);
router.get('/booking-links', ctrl.getBookingLinks);
router.post('/booking-links', ctrl.createBookingLink);
router.delete('/booking-links/:id', ctrl.deleteBookingLink);

router.get('/:id', ctrl.getMeeting);
router.put('/:id', ctrl.updateMeeting);
router.delete('/:id', ctrl.deleteMeeting);
router.post('/:id/complete', ctrl.completeMeeting);
router.post('/:id/comments', ctrl.addMeetingComment);
router.post('/:id/attachments', ctrl.addMeetingAttachment);

module.exports = router;
