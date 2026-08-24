const { Meeting, BookingLink } = require('../models/Meeting');
const { withBookingLock } = require('../models/BookingLock');
const { getGoogleCalendarConnection, googleCalendarApi } = require('../services/serviceClients/integration.client');
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
const { createOrFindLead, getLeadsBulk } = require('../services/serviceClients/lead.client');
const { validateCustomFields } = require('../utils/customFieldValidator');
const { resolveBookingHost } = require('../services/assignmentResolver.service');

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
    
    if (meetingData.customFields) {
        await validateCustomFields(scope.tenantId, 'Meeting', meetingData.customFields);
    }
    
    let conference = undefined;
    let calendar = undefined;
    
    if (meetingData.provider === 'google_meet') {
        const connection = await getGoogleCalendarConnection(scope.tenantId, userId);
        if (connection) {
            const userIds = (meetingData.attendees || []).map(a => String(a.userId));
            const users = userIds.length > 0 ? await getUsersBulk(scope.tenantId, userIds) : [];
            const userMap = new Map(users.map(u => [String(u._id), u.email]));
            
            const gAttendees = (meetingData.attendees || [])
                .filter(a => userMap.get(String(a.userId)))
                .map(a => ({ email: userMap.get(String(a.userId)) }));
                
            if (meetingData.guest?.email) {
                gAttendees.push({ email: meetingData.guest.email });
            }

            const scheduledAt = new Date(meetingData.meeting?.scheduledAt || new Date());
            const duration = meetingData.meeting?.duration || 30;
            const requestedEnd = new Date(scheduledAt.getTime() + duration * 60 * 1000);
            
            try {
                const calendarId = connection.configuration?.calendarId || 'primary';
                const gEvent = await googleCalendarApi.createEvent(scope.tenantId, connection.connectionId, calendarId, {
                    summary: meetingData.meeting?.title || 'Scheduled Meeting',
                    description: meetingData.meeting?.description || '',
                    start: { dateTime: scheduledAt.toISOString(), timeZone: 'UTC' },
                    end: { dateTime: requestedEnd.toISOString(), timeZone: 'UTC' },
                    attendees: gAttendees,
                    requestId: `manual-${new Date().getTime()}-${Math.random().toString(36).substring(7)}`
                });
                
                conference = {
                    provider: 'google_meet',
                    meetingUrl: gEvent.hangoutLink
                };
                calendar = {
                    provider: 'google',
                    eventId: gEvent.id
                };
                
                if (!meetingData.meeting) meetingData.meeting = {};
                meetingData.meeting.link = gEvent.hangoutLink;
            } catch (err) {
                const errorMessage = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Unknown error';
                console.error('Failed to create google calendar event:', errorMessage);
                throw ApiError.internal(`Failed to schedule meeting on Google Calendar: ${errorMessage}`);
            }
        } else {
            throw ApiError.badRequest('You must connect your Google Calendar in Settings first');
        }
    }

    const meeting = await Meeting.create({
        ...meetingData,
        conference,
        calendar,
        tenantId: scope.tenantId,
        branchId: scope.branchId || null,
        hostId: userId,
    });
    
    // Collect invitee emails for notifications
    const inviteeEmails = [];
    if (meeting.guest?.email) inviteeEmails.push(meeting.guest.email);
    if (meeting.attendees?.length > 0) {
        const userIds = meeting.attendees.map(a => String(a.userId));
        const users = await getUsersBulk(scope.tenantId, userIds);
        users.forEach(u => { if (u.email) inviteeEmails.push(u.email) });
    }

    await publishEvent(EVENTS.MEETING_BOOKED, { 
        tenantId: scope.tenantId, 
        meetingId: meeting._id, 
        hostId: userId, 
        leadId: meeting.leadId,
        attendeeIds: meeting.attendees?.map(a => String(a.userId)) || [],
        inviteeEmails,
        meetingTitle: meeting.meeting.title,
        scheduledAt: meeting.meeting.scheduledAt,
        duration: meeting.meeting.duration,
        meetingUrl: meeting.meeting.link || meeting.conference?.meetingUrl
    });
    ApiResponse.created(res, meeting, 'Meeting scheduled');
});

const getMeetings = asyncHandler(async (req, res) => {
    const { status, from, to } = req.query;
    const { page, limit, skip } = pagination(req.query, 25, 1000);
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

    if (status) {
        filter['meeting.status'] = { $in: status.split(',') };
    }
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
        Meeting.find(filter).select('-meta -calendar').sort({ 'meeting.scheduledAt': 1 }).skip(skip).limit(limit).lean(),
        Meeting.countDocuments(filter),
    ]);

    // Populate lead details using bulk endpoint
    const leadIds = Array.from(new Set(meetings.filter(m => m.leadId).map(m => String(m.leadId))));
    if (leadIds.length > 0) {
        const leads = await getLeadsBulk(tenantId, leadIds);
        const leadMap = new Map(leads.map(l => [String(l._id), {
            _id: l._id,
            name: `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim() || 'Unknown',
            company: l.contact?.company || '',
            phone: l.contact?.phone || ''
        }]));
        
        meetings.forEach(m => {
            if (m.leadId && leadMap.has(String(m.leadId))) {
                m.leadId = leadMap.get(String(m.leadId));
            }
        });
    }

    ApiResponse.paginated(res, meetings, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

const getCalendarMeetings = asyncHandler(async (req, res) => {
    const { from, to } = req.query;
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

    if (from || to) {
        filter['meeting.scheduledAt'] = {};
        if (from) {
            const fromDate = new Date(from);
            if (!Number.isNaN(fromDate.getTime())) {
                filter['meeting.scheduledAt'].$gte = fromDate;
            }
        }
        if (to) {
            const toDate = new Date(to);
            if (!Number.isNaN(toDate.getTime())) {
                filter['meeting.scheduledAt'].$lte = toDate;
            }
        }
    }

    // Explicitly select only necessary fields
    const meetings = await Meeting.find(filter)
        .select('_id meeting.scheduledAt meeting.duration meeting.title meeting.meetingType meeting.location meeting.description conference.meetingUrl meeting.link leadId hostId')
        .lean();

    // Populate lead details using bulk endpoint
    const leadIds = Array.from(new Set(meetings.filter(m => m.leadId).map(m => String(m.leadId))));
    if (leadIds.length > 0) {
        const leads = await getLeadsBulk(tenantId, leadIds);
        const leadMap = new Map(leads.map(l => [String(l._id), {
            _id: l._id,
            name: `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim() || 'Unknown'
        }]));
        
        meetings.forEach(m => {
            if (m.leadId && leadMap.has(String(m.leadId))) {
                m.leadId = leadMap.get(String(m.leadId));
            }
        });
    }

    // Populate host details
    const hostIds = Array.from(new Set(meetings.filter(m => m.hostId).map(m => String(m.hostId))));
    if (hostIds.length > 0) {
        const users = await getUsersBulk(tenantId, hostIds);
        const userMap = new Map(users.map(u => [String(u._id), {
            _id: u._id,
            name: u.contact?.name || 'Unknown User'
        }]));
        
        meetings.forEach(m => {
            if (m.hostId && userMap.has(String(m.hostId))) {
                m.hostId = userMap.get(String(m.hostId));
            }
        });
    }

    ApiResponse.success(res, meetings);
});

const getMeetingStats = asyncHandler(async (req, res) => {
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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const weekEnd = new Date(todayEnd);
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));

    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0, 23, 59, 59, 999);

    const [todayCount, upcomingCount, completedCount, cancelledCount] = await Promise.all([
        Meeting.countDocuments({ ...filter, 'meeting.scheduledAt': { $gte: todayStart, $lte: todayEnd } }),
        Meeting.countDocuments({ ...filter, 'meeting.scheduledAt': { $gt: todayEnd, $lte: weekEnd } }),
        Meeting.countDocuments({ ...filter, 'meeting.status': 'completed', 'meeting.scheduledAt': { $gte: monthStart, $lte: monthEnd } }),
        Meeting.countDocuments({ ...filter, 'meeting.status': { $in: ['cancelled', 'no_show'] }, 'meeting.scheduledAt': { $gte: monthStart, $lte: monthEnd } }),
    ]);

    ApiResponse.success(res, {
        today: todayCount,
        upcoming: upcomingCount,
        completed: completedCount,
        cancelled: cancelledCount,
    });
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
    
    // Attach lead object
    if (meeting.leadId) {
        const leads = await getLeadsBulk(tenantId, [String(meeting.leadId)]);
        if (leads.length > 0) {
            const l = leads[0];
            meeting.leadId = {
                _id: l._id,
                name: `${l.contact?.firstName || ''} ${l.contact?.lastName || ''}`.trim() || 'Unknown',
                company: l.contact?.company || '',
                phone: l.contact?.phone || ''
            };
        }
    }

    ApiResponse.success(res, meeting, 'Success');
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

    if (changes.customFields) {
        await validateCustomFields(tenantId, 'Meeting', changes.customFields);
    }

    const oldStatus = meeting.meeting?.status;
    const oldScheduledAt = meeting.meeting?.scheduledAt ? new Date(meeting.meeting.scheduledAt).getTime() : null;
    
    Object.assign(meeting, changes);
    await meeting.save();

    const newStatus = meeting.meeting?.status;
    const newScheduledAt = meeting.meeting?.scheduledAt ? new Date(meeting.meeting.scheduledAt).getTime() : null;

    if (oldStatus !== newStatus) {
        if (newStatus === 'cancelled') {
            await publishEvent(EVENTS.MEETING_CANCELLED, { tenantId, meetingId, leadId: meeting.leadId });
        } else if (newStatus === 'no_show') {
            await publishEvent(EVENTS.MEETING_NO_SHOW, { tenantId, meetingId, leadId: meeting.leadId });
        }
    } else if (oldScheduledAt !== newScheduledAt && oldStatus !== 'cancelled') {
        await publishEvent(EVENTS.MEETING_RESCHEDULED, { tenantId, meetingId, leadId: meeting.leadId, scheduledAt: meeting.meeting.scheduledAt });
    }

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

    if (meeting.calendar?.provider === 'google_calendar' && meeting.calendar?.eventId) {
        try {
            const connection = await getGoogleCalendarConnection(tenantId, meeting.hostId);
            if (connection) {
                const calendarId = connection.configuration?.calendarId || 'primary';
                await googleCalendarApi.deleteEvent(tenantId, connection.connectionId, calendarId, meeting.calendar.eventId);
            }
        } catch (err) {
            console.error('Failed to delete Google Calendar event:', err.message);
        }
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

    const lock = await withBookingLock(`meeting-host:${link._id}`, async () => {
        const requestedEnd = new Date(scheduledAt.getTime() + duration * 60 * 1000);
        
        // 1. Find or Create Lead
        let lead = null;
        if (booking.guest?.email || booking.guest?.phone) {
            lead = await createOrFindLead(link.tenantId, {
                branchId: link.branchId,
                source: 'booking_link',
                sourceDetails: link.title,
                leadData: {
                    contact: {
                        firstName: booking.guest.name ? booking.guest.name.split(' ')[0] : 'Unknown',
                        lastName: booking.guest.name ? booking.guest.name.split(' ').slice(1).join(' ') : '',
                        email: booking.guest.email,
                        phone: booking.guest.phone,
                    },
                    assignedTo: link.assignmentType === 'specific_user' ? (link.assignedUserId || link.userId) : null
                }
            });
        }

        // 2. Resolve Host
        const resolvedHostId = await resolveBookingHost(link, lead, scheduledAt, requestedEnd, link.tenantId);

        // 3. Check Overlaps for resolved host
        const candidates = await Meeting.find({
            tenantId: link.tenantId,
            hostId: resolvedHostId,
            'meeting.status': { $in: ['scheduled', 'confirmed'] },
            'meeting.scheduledAt': { $lt: requestedEnd },
        }).select('meeting.scheduledAt meeting.duration');
        const overlaps = candidates.some((candidate) => (
            new Date(candidate.meeting.scheduledAt).getTime() + candidate.meeting.duration * 60 * 1000 > scheduledAt.getTime()
        ));
        if (overlaps) throw ApiError.conflict('The selected time is no longer available');

        const connection = await getGoogleCalendarConnection(link.tenantId, resolvedHostId);
        if (link.provider === 'google_meet' && connection) {
            try {
                const calendarId = connection.configuration?.calendarId || 'primary';
                const busySlots = await googleCalendarApi.getFreeBusy(link.tenantId, connection.connectionId, calendarId, scheduledAt, requestedEnd, link.availability.timezone);
                if (busySlots.length > 0) {
                    throw ApiError.conflict('The selected time is no longer available on the host\'s Google Calendar');
                }
            } catch (err) {
                console.error('Google FreeBusy error:', err);
                throw ApiError.internal('Failed to verify calendar availability');
            }
        }

        const meetingDoc = await Meeting.create({
            tenantId: link.tenantId,
            branchId: link.branchId || null,
            hostId: resolvedHostId,
            leadId: lead ? lead._id : null,
            bookingLinkId: link._id,
            meetingType: link.meetingType || 'online',
            provider: link.provider,
            source: 'booking_link',
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

        if (link.provider === 'google_meet' && connection) {
            try {
                const calendarId = connection.configuration?.calendarId || 'primary';
                const eventDetails = {
                    summary: meetingDoc.meeting.title,
                    description: `SparkCRM Meeting\n\nCustomer:\n${meetingDoc.guest.name}\n\nEmail:\n${meetingDoc.guest.email}\n\nPhone:\n${meetingDoc.guest.phone || 'N/A'}\n\nBooked via:\n${link.title}\n\nSparkCRM Meeting ID:\n${meetingDoc._id}`,
                    start: { dateTime: scheduledAt.toISOString(), timeZone: link.availability.timezone },
                    end: { dateTime: requestedEnd.toISOString(), timeZone: link.availability.timezone },
                    attendees: [{ email: meetingDoc.guest.email }],
                    requestId: String(meetingDoc._id)
                };
                const gEvent = await googleCalendarApi.createEvent(link.tenantId, connection.connectionId, calendarId, eventDetails);
                
                let meetingUrl = null;
                let conferenceId = null;
                if (gEvent.conferenceData && gEvent.conferenceData.entryPoints) {
                    const entryPoint = gEvent.conferenceData.entryPoints.find(e => e.entryPointType === 'video');
                    if (entryPoint) meetingUrl = entryPoint.uri;
                    conferenceId = gEvent.conferenceData.conferenceId;
                }

                meetingDoc.calendar = {
                    provider: 'google',
                    calendarId: tokens.calendarId,
                    eventId: gEvent.id,
                    eventHtmlLink: gEvent.htmlLink
                };
                meetingDoc.conference = {
                    provider: 'google_meet',
                    meetingUrl,
                    conferenceId,
                    status: 'success'
                };
                meetingDoc.meeting.link = meetingUrl;
                await meetingDoc.save();
            } catch (err) {
                console.error('Failed to create google event', err);
            }
        }

        return meetingDoc;
    });
    if (!lock.acquired) throw ApiError.conflict('Another booking is being processed; please retry');
    ApiResponse.created(res, lock.result, 'Meeting booked successfully');
});

const getBookingLinks = asyncHandler(async (req, res) => {
    const filter = buildScopeFilter(req, { ownerField: 'userId', module: 'meetings' });
    const links = await BookingLink.find(filter).sort({ 'meta.createdAt': -1 }).lean();
    
    const mappedLinks = links.map(link => ({
        ...link,
        defaultDuration: link.defaultDuration || link.durationOptions?.[0] || 30,
        slotInterval: link.slotInterval || 15
    }));
    
    ApiResponse.success(res, mappedLinks);
});

const getBookingLinkBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const link = await BookingLink.findOne({ slug, isActive: true })
        .select('title description durationOptions defaultDuration slotInterval provider meetingType bookingRules customerFields availability userId')
        .lean();
        
    if (!link) throw ApiError.notFound('Booking link not found or inactive');
    
    link.defaultDuration = link.defaultDuration || link.durationOptions?.[0] || 30;
    link.slotInterval = link.slotInterval || 15;
    
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

const googleAuthUrl = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const integrationType = req.query.integrationType || 'GOOGLE_CALENDAR';
    
    // Gateway URL to Integration Service OAuth
    const url = `${process.env.API_URL || 'http://localhost:8000'}/api/integrations/oauth/authorize?provider=GOOGLE&integrationType=${integrationType}&tenantId=${tenantId}&userId=${userId}`;
    ApiResponse.success(res, { url });
});

const googleAuthCallback = asyncHandler(async (req, res) => {
    // Deprecated: Handled by integration-service now
    res.status(400).json({ success: false, message: 'Deprecated. Use Integration Service.' });
});



const googleAuthStatus = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const connection = await getGoogleCalendarConnection(tenantId, userId);
    
    if (connection) {
        ApiResponse.success(res, {
            connected: true,
            email: connection.configuration?.email,
            calendarId: connection.configuration?.calendarId
        });
    } else {
        ApiResponse.success(res, { connected: false });
    }
});

const googleDisconnect = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const connection = await getGoogleCalendarConnection(tenantId, userId);
    if (connection) {
        const { apiClient } = require('../services/serviceClients/integration.client');
        await apiClient.delete(`/connections/${connection.connectionId}`, { data: { tenantId } });
    }
    ApiResponse.success(res, null, 'Google Calendar disconnected');
});

const googleGetCalendars = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const connection = await getGoogleCalendarConnection(tenantId, userId);
    if (!connection) throw ApiError.unauthorized('Google Calendar not connected');
    
    const calendars = await googleCalendarApi.getCalendars(tenantId, connection.connectionId);
    ApiResponse.success(res, calendars);
});

const getBookingAvailability = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { date, duration } = req.query; // date format YYYY-MM-DD
    
    if (!date) throw ApiError.badRequest('date query parameter is required');

    const link = await BookingLink.findOne({ slug, isActive: true }).lean();
    if (!link) throw ApiError.notFound('Booking link not found or inactive');

    const durationNum = parseInt(duration) || link.durationOptions[0];
    const targetDate = new Date(`${date}T00:00:00.000Z`); // parse date in UTC

    // 1. Get existing SparkCRM meetings for that day
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Determine which user's calendar to check for availability
    let userToCheck = link.userId;
    if (link.assignmentType === 'specific_user' && link.assignedUserId) {
        userToCheck = link.assignedUserId;
    } else if (link.assignmentType === 'round_robin' && link.assignedUserIds?.length > 0) {
        // For round robin, check the first user as a baseline for availability UI.
        // The backend booking logic will properly check all users and pick an available one.
        userToCheck = link.assignedUserIds[0];
    }

    const existingMeetings = await Meeting.find({
        tenantId: link.tenantId,
        hostId: userToCheck,
        'meeting.status': { $in: ['scheduled', 'confirmed'] },
        'meeting.scheduledAt': { $gte: startOfDay, $lt: endOfDay },
    }).select('meeting.scheduledAt meeting.duration').lean();

    let googleBusySlots = [];
    const connection = await getGoogleCalendarConnection(link.tenantId, userToCheck);
    if (link.provider === 'google_meet' && connection) {
        try {
            const calendarId = connection.configuration?.calendarId || 'primary';
            googleBusySlots = await googleCalendarApi.getFreeBusy(link.tenantId, connection.connectionId, calendarId, startOfDay, endOfDay, link.availability.timezone);
        } catch (err) {
            console.error('Failed to fetch google freebusy', err);
        }
    }

    ApiResponse.success(res, {
        existingMeetings: existingMeetings.map(m => ({
            scheduledAt: m.meeting.scheduledAt,
            duration: m.meeting.duration
        })),
        googleBusySlots
    });
});

const checkAvailability = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { date, duration, participants } = req.body;
    
    if (!date) throw ApiError.badRequest('date is required');
    if (!duration) throw ApiError.badRequest('duration is required');
    if (!Array.isArray(participants)) throw ApiError.badRequest('participants must be an array of user IDs');

    const targetDate = new Date(`${date}T00:00:00.000Z`); // parse date in UTC
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const existingMeetings = await Meeting.find({
        tenantId,
        $or: [
            { hostId: { $in: participants } },
            { 'attendees.userId': { $in: participants } }
        ],
        'meeting.status': { $in: ['scheduled', 'confirmed'] },
        'meeting.scheduledAt': { $gte: startOfDay, $lt: endOfDay },
    }).select('meeting.scheduledAt meeting.duration hostId attendees meeting.title').lean();

    ApiResponse.success(res, { existingMeetings });
});

const completeMeeting = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const meetingId = requireObjectId(req.params.id, 'meeting ID');
    const { outcome, notes, nextFollowUpAt, followUpNotes } = req.body;

    const meeting = await Meeting.findOne({ _id: meetingId, tenantId });
    if (!meeting) throw ApiError.notFound('Meeting not found');
    if (!canAccessMeeting(req, meeting)) {
        throw ApiError.forbidden('You do not have access to this meeting');
    }

    meeting.meeting.status = 'completed';
    if (outcome !== undefined) meeting.meeting.outcome = outcome;
    if (notes !== undefined) meeting.meeting.notes = notes;
    if (nextFollowUpAt !== undefined) meeting.meeting.nextFollowUpAt = nextFollowUpAt;
    if (followUpNotes !== undefined) meeting.meeting.followUpNotes = followUpNotes;

    await meeting.save();

    await publishEvent(EVENTS.MEETING_COMPLETED, {
        tenantId,
        meetingId: meeting._id,
        leadId: meeting.leadId,
        outcome: meeting.meeting.outcome
    });

    ApiResponse.success(res, meeting, 'Meeting marked as completed');
});

module.exports = {
    scheduleMeeting,
    getMeetings,
    getCalendarMeetings,
    getMeetingStats,
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
    isWithinAvailability,
    googleAuthUrl,
    googleAuthCallback,
    googleAuthStatus,
    googleDisconnect,
    googleGetCalendars,
    getBookingAvailability,
    checkAvailability,
    completeMeeting
};
