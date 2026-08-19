const { Meeting, BookingLink } = require('../models/Meeting');
const { withBookingLock } = require('../models/BookingLock');
const { IntegrationCredential, encrypt, decrypt } = require('../../../tenant-service/src/models/IntegrationCredential');
const googleCalendarService = require('../services/googleCalendar.service');
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
const { createOrFindLead } = require('../services/serviceClients/lead.client');
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
        const tokens = await getGoogleTokens(scope.tenantId, userId);
        if (tokens && tokens.refresh_token) {
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
                const gEvent = await googleCalendarService.createCalendarEvent(tokens, tokens.calendarId, {
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
                console.error('Failed to create google calendar event:', err);
                throw ApiError.internal('Failed to schedule meeting on Google Calendar');
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
        Meeting.find(filter).select('-meta -calendar').sort({ 'meeting.scheduledAt': 1 }).skip(skip).limit(limit).lean(),
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

    if (changes.customFields) {
        await validateCustomFields(tenantId, 'Meeting', changes.customFields);
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

    if (meeting.calendar?.provider === 'google_calendar' && meeting.calendar?.eventId) {
        try {
            const tokens = await getGoogleTokens(tenantId, meeting.hostId);
            if (tokens && tokens.refresh_token) {
                await googleCalendarService.cancelCalendarEvent(tokens, tokens.calendarId, meeting.calendar.eventId);
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

        const tokens = await getGoogleTokens(link.tenantId, resolvedHostId);
        if (link.provider === 'google_meet' && tokens && tokens.refresh_token) {
            try {
                const busySlots = await googleCalendarService.getFreeBusy(tokens, tokens.calendarId, scheduledAt, requestedEnd, link.availability.timezone);
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

        if (link.provider === 'google_meet' && tokens && tokens.refresh_token) {
            try {
                const eventDetails = {
                    summary: meetingDoc.meeting.title,
                    description: `SparkCRM Meeting\n\nCustomer:\n${meetingDoc.guest.name}\n\nEmail:\n${meetingDoc.guest.email}\n\nPhone:\n${meetingDoc.guest.phone || 'N/A'}\n\nBooked via:\n${link.title}\n\nSparkCRM Meeting ID:\n${meetingDoc._id}`,
                    start: { dateTime: scheduledAt.toISOString(), timeZone: link.availability.timezone },
                    end: { dateTime: requestedEnd.toISOString(), timeZone: link.availability.timezone },
                    attendees: [{ email: meetingDoc.guest.email }],
                    requestId: String(meetingDoc._id)
                };
                const gEvent = await googleCalendarService.createCalendarEvent(tokens, tokens.calendarId, eventDetails);
                
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
    const url = googleCalendarService.getAuthorizationUrl(tenantId, userId);
    ApiResponse.success(res, { url });
});

const googleAuthCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) throw ApiError.badRequest('Missing code or state');

    const stateStr = Buffer.from(state, 'base64').toString('utf8');
    const { tenantId, userId } = JSON.parse(stateStr);

    const tokens = await googleCalendarService.getTokensFromCode(code);
    if (!tokens.refresh_token) {
        // We need an offline token. If not provided, the user might need to revoke access and reconnect.
        // For phase 1, we will store what we get and handle appropriately. 
        // If they already authorized, Google only sends access_token unless prompt=consent is used.
    }

    const calendars = await googleCalendarService.getCalendars(tokens);
    const primaryCal = calendars.find(c => c.primary) || calendars[0];
    const calendarId = primaryCal ? primaryCal.id : 'primary';
    const email = primaryCal ? primaryCal.id : 'unknown'; // primary id is usually email

    const credentialData = {
        refresh_token: tokens.refresh_token,
        calendarId,
        email,
        connected: 'true'
    };
    
    // Convert to map of encrypted strings
    const encryptedCredentials = {};
    for (const [key, value] of Object.entries(credentialData)) {
        if (value) encryptedCredentials[key] = encrypt(String(value));
    }

    await IntegrationCredential.findOneAndUpdate(
        { tenantId, userId, provider: 'google_calendar' },
        {
            $set: {
                credentials: encryptedCredentials,
                isActive: true,
                configuredBy: userId,
            }
        },
        { upsert: true, new: true }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings`);
});

const getGoogleTokens = async (tenantId, userId) => {
    const cred = await IntegrationCredential.findOne({ tenantId, userId, provider: 'google_calendar', isActive: true });
    if (!cred || !cred.credentials) return null;
    const tokens = {};
    for (const [key, value] of cred.credentials.entries()) {
        tokens[key] = decrypt(value);
    }
    return tokens;
};

const googleAuthStatus = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const tokens = await getGoogleTokens(tenantId, userId);
    
    if (tokens && tokens.connected === 'true') {
        ApiResponse.success(res, {
            connected: true,
            email: tokens.email,
            calendarId: tokens.calendarId
        });
    } else {
        ApiResponse.success(res, { connected: false });
    }
});

const googleDisconnect = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    await IntegrationCredential.findOneAndDelete({ tenantId, userId, provider: 'google_calendar' });
    ApiResponse.success(res, null, 'Google Calendar disconnected');
});

const googleGetCalendars = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const tokens = await getGoogleTokens(tenantId, userId);
    if (!tokens || !tokens.refresh_token) throw ApiError.unauthorized('Google Calendar not connected');
    
    const calendars = await googleCalendarService.getCalendars({ refresh_token: tokens.refresh_token });
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
    const tokens = await getGoogleTokens(link.tenantId, userToCheck);
    if (link.provider === 'google_meet' && tokens && tokens.refresh_token) {
        try {
            googleBusySlots = await googleCalendarService.getFreeBusy(tokens, tokens.calendarId, startOfDay, endOfDay, link.availability.timezone);
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
    isWithinAvailability,
    googleAuthUrl,
    googleAuthCallback,
    googleAuthStatus,
    googleDisconnect,
    googleGetCalendars,
    getBookingAvailability
};
