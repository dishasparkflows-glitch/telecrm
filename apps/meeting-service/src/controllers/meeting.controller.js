const { Meeting, BookingLink } = require('../models/Meeting');
const { withBookingLock } = require('../models/BookingLock');
const {
    pickMeetingCreateInput,
    pickMeetingUpdateInput,
    pickBookingLinkInput,
    pickPublicBookingInput,
    requireObjectId,
    pagination,
} = require('../utils/meetingDto');
const { ApiResponse, ApiError, asyncHandler, buildScopeFilter, canAccessRecord, getPresignedDownloadUrl } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { getUsersBulk } = require('../services/serviceClients/user.client');

const zonedSlot = (date, timezone) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type).value;

    return {
        day: part('weekday').toLowerCase(),
        time: `${part('hour')}:${part('minute')}`,
    };
};

const isWithinAvailability = (start, duration, availability) => {
    const startSlot = zonedSlot(start, availability.timezone);
    if (!availability.days.includes(startSlot.day)) return false;

    const endSlot = zonedSlot(new Date(start.getTime() + duration * 60 * 1000), availability.timezone);
    return endSlot.day === startSlot.day
        && startSlot.time >= availability.startTime
        && endSlot.time <= availability.endTime;
};

const canAccessMeeting = (req, meeting, { allowAttendee = false } = {}) => {
    if (canAccessRecord(req, meeting, { ownerField: 'hostId', module: 'meetings' })) return true;
    if (!allowAttendee) return false;

    const userId = req.headers['x-user-id'];
    const isAttendee = meeting.attendees?.some((attendee) => String(attendee.userId) === String(userId));
    if (!isAttendee) return false;

    return canAccessRecord(req, {
        tenantId: meeting.tenantId,
        branchId: meeting.branchId,
        hostId: userId,
    }, { ownerField: 'hostId', module: 'meetings' });
};

const scheduleMeeting = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    const scope = buildScopeFilter(req, { ownerField: 'hostId', module: 'meetings' });
    const meetingData = pickMeetingCreateInput(req.body);
    const meeting = await Meeting.create({
        ...meetingData,
        tenantId: scope.tenantId,
        branchId: scope.branchId || null,
        hostId: userId,
    });
    await publishEvent(EVENTS.MEETING_BOOKED, { tenantId: scope.tenantId, meetingId: meeting._id, hostId: userId, leadId: meeting.leadId });
    ApiResponse.created(res, meeting, 'Meeting scheduled');
});

const getMeetings = asyncHandler(async (req, res) => {
    const { status, from, to } = req.query;
    const { page, limit, skip } = pagination(req.query);
    const tenantId = req.headers['x-tenant-id'];
    const filter = buildScopeFilter(req, { ownerField: 'hostId', module: 'meetings' });

    if (filter.hostId) {
        const ownerId = filter.hostId;
        delete filter.hostId;
        filter.$or = [
            { hostId: ownerId },
            { 'attendees.userId': ownerId },
        ];
    }

    if (status) filter['meeting.status'] = status;
    if (from || to) {
        filter['meeting.scheduledAt'] = {};
        if (from) {
            const fromDate = new Date(from);
            if (Number.isNaN(fromDate.getTime())) throw ApiError.badRequest('from must be a valid date');
            filter['meeting.scheduledAt'].$gte = fromDate;
        }
        if (to) {
            const toDate = new Date(to);
            if (Number.isNaN(toDate.getTime())) throw ApiError.badRequest('to must be a valid date');
            filter['meeting.scheduledAt'].$lte = toDate;
        }
    }
    const [meetings, total] = await Promise.all([
        Meeting.find(filter).sort({ 'meeting.scheduledAt': 1 }).skip(skip).limit(limit).lean(),
        Meeting.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, meetings, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

const getMeeting = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const meetingId = requireObjectId(req.params.id, 'meeting ID');
    
    let meeting = await Meeting.findOne({ _id: meetingId, tenantId }).lean();
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (!canAccessMeeting(req, meeting, { allowAttendee: true })) {
        throw ApiError.forbidden('You do not have access to this meeting');
    }
    
    // Extract unique user IDs
    const userIds = new Set();
    if (meeting.hostId) userIds.add(String(meeting.hostId));
    meeting.comments?.forEach(c => c.userId && userIds.add(String(c.userId)));
    meeting.attendees?.forEach(a => a.userId && userIds.add(String(a.userId)));
    meeting.attachments?.forEach(a => a.uploadedBy && userIds.add(String(a.uploadedBy)));
    
    // Fetch users in bulk
    const users = await getUsersBulk(tenantId, Array.from(userIds));
    const userMap = new Map(users.map(u => [String(u._id), u]));
    
    // Attach user objects
    if (meeting.hostId) {
        meeting.hostId = userMap.get(String(meeting.hostId)) || meeting.hostId;
    }
    if (meeting.comments) {
        meeting.comments = meeting.comments.map(c => ({
            ...c,
            userId: userMap.get(String(c.userId)) || c.userId
        }));
    }
    if (meeting.attendees) {
        meeting.attendees = meeting.attendees.map(a => ({
            ...a,
            userId: userMap.get(String(a.userId)) || a.userId
        }));
    }
    if (meeting.attachments) {
        meeting.attachments = await Promise.all(meeting.attachments.map(async a => {
            let playbackUrl = null;
            if (a.media) {
                try { playbackUrl = await getPresignedDownloadUrl(a.media); } catch {}
            }
            return {
                ...a,
                url: playbackUrl,
                uploadedBy: userMap.get(String(a.uploadedBy)) || a.uploadedBy
            };
        }));
    }

    ApiResponse.success(res, meeting);
});

const addMeetingComment = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const meetingId = requireObjectId(req.params.id, 'meeting ID');
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const userName = typeof req.body?.userName === 'string' ? req.body.userName.trim() : '';
    if (!text) throw ApiError.badRequest('Comment text is required');

    const meeting = await Meeting.findOne({ _id: meetingId, tenantId });
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (!canAccessMeeting(req, meeting, { allowAttendee: true })) {
        throw ApiError.forbidden('You do not have access to this meeting');
    }

    meeting.comments.push({ userId, userName, text, createdAt: new Date() });
    await meeting.save();
    ApiResponse.success(res, meeting, 'Comment added');
});

const addMeetingAttachment = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const meetingId = requireObjectId(req.params.id, 'meeting ID');
    const { name, media, fileType } = req.body || {};
    if (![name, media, fileType].every((value) => typeof value === 'string' && value.trim())) {
        throw ApiError.badRequest('Attachment name, media, and fileType are required');
    }

    const meeting = await Meeting.findOne({ _id: meetingId, tenantId });
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (!canAccessMeeting(req, meeting, { allowAttendee: true })) {
        throw ApiError.forbidden('You do not have access to this meeting');
    }

    meeting.attachments.push({
        name: name.trim(),
        media: media.trim(),
        fileType: fileType.trim(),
        uploadedBy: userId,
        uploadedAt: new Date(),
    });
    await meeting.save();
    
    const obj = meeting.toObject();
    if (obj.attachments) {
        obj.attachments = await Promise.all(obj.attachments.map(async a => {
            let playbackUrl = null;
            if (a.media) {
                try { playbackUrl = await getPresignedDownloadUrl(a.media); } catch {}
            }
            return { ...a, url: playbackUrl };
        }));
    }

    ApiResponse.success(res, obj, 'Attachment added');
});

const updateMeeting = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const meetingId = requireObjectId(req.params.id, 'meeting ID');
    const changes = pickMeetingUpdateInput(req.body);
    const meeting = await Meeting.findOne({ _id: meetingId, tenantId });
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (!canAccessMeeting(req, meeting)) {
        throw ApiError.forbidden('You do not have access to this meeting');
    }

    Object.assign(meeting, changes);
    await meeting.save();
    ApiResponse.success(res, meeting, 'Meeting updated');
});

const deleteMeeting = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const meetingId = requireObjectId(req.params.id, 'meeting ID');
    const meeting = await Meeting.findOne({ _id: meetingId, tenantId });
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (!canAccessMeeting(req, meeting)) {
        throw ApiError.forbidden('You do not have access to this meeting');
    }

    await meeting.deleteOne();
    ApiResponse.success(res, null, 'Meeting deleted');
});

const bookMeeting = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const link = await BookingLink.findOne({ slug, isActive: true });
    if (!link) throw ApiError.notFound('Booking link not found or inactive');

    const booking = pickPublicBookingInput(req.body);
    const scheduledAt = new Date(booking.meeting?.scheduledAt);
    const duration = booking.meeting?.duration;
    if (!link.durationOptions.includes(duration)) {
        throw ApiError.badRequest('Selected duration is not available for this booking link');
    }
    if (!isWithinAvailability(scheduledAt, duration, link.availability)) {
        throw ApiError.badRequest('Selected time is outside booking availability');
    }

    const lock = await withBookingLock(`meeting-host:${link.userId}`, async () => {
        const requestedEnd = new Date(scheduledAt.getTime() + duration * 60 * 1000);
        const candidates = await Meeting.find({
            tenantId: link.tenantId,
            hostId: link.userId,
            'meeting.status': { $in: ['scheduled', 'confirmed'] },
            'meeting.scheduledAt': { $lt: requestedEnd },
        }).select('meeting.scheduledAt meeting.duration');
        const overlaps = candidates.some((candidate) => (
            new Date(candidate.meeting.scheduledAt).getTime() + candidate.meeting.duration * 60 * 1000 > scheduledAt.getTime()
        ));
        if (overlaps) throw ApiError.conflict('The selected time is no longer available');

        return Meeting.create({
            tenantId: link.tenantId,
            branchId: link.branchId || null,
            hostId: link.userId,
            meeting: {
                title: booking.meeting?.title,
                scheduledAt,
                duration,
                status: 'scheduled',
            },
            guest: {
                name: booking.guest?.name,
                email: booking.guest?.email,
                phone: booking.guest?.phone,
            }
        });
    });
    if (!lock.acquired) throw ApiError.conflict('Another booking is being processed; please retry');
    ApiResponse.created(res, lock.result, 'Meeting booked successfully');
});

const getBookingLinks = asyncHandler(async (req, res) => {
    const filter = buildScopeFilter(req, { ownerField: 'userId', module: 'meetings' });
    const links = await BookingLink.find(filter).sort({ 'meta.createdAt': -1 });
    ApiResponse.success(res, links);
});

const getBookingLinkBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const link = await BookingLink.findOne({ slug, isActive: true })
        .select('title description durationOptions availability userId')
        .lean();
        
    if (!link) throw ApiError.notFound('Booking link not found or inactive');
    ApiResponse.success(res, link);
});

const createBookingLink = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    const scope = buildScopeFilter(req, { ownerField: 'userId', module: 'meetings' });
    const linkData = pickBookingLinkInput(req.body);
    const link = await BookingLink.create({
        ...linkData,
        tenantId: scope.tenantId,
        branchId: scope.branchId || null,
        userId,
        slug: linkData.slug || `book-${Date.now()}`,
    });
    ApiResponse.created(res, link, 'Booking link created');
});

const deleteBookingLink = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const linkId = requireObjectId(req.params.id, 'booking link ID');
    const link = await BookingLink.findOne({ _id: linkId, tenantId });
    if (!link) throw ApiError.notFound('Booking link not found');
    if (!canAccessRecord(req, link, { ownerField: 'userId', module: 'meetings' })) {
        throw ApiError.forbidden('You do not have access to this booking link');
    }

    await link.deleteOne();
    ApiResponse.success(res, null, 'Booking link deleted');
});

module.exports = {
    scheduleMeeting,
    getMeetings,
    getMeeting,
    updateMeeting,
    deleteMeeting,
    bookMeeting,
    createBookingLink,
    getBookingLinks,
    getBookingLinkBySlug,
    deleteBookingLink,
    addMeetingComment,
    addMeetingAttachment,
    zonedSlot,
    isWithinAvailability
};
