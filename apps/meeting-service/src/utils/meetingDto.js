const mongoose = require('mongoose');
const { ApiError } = require('@sparkcrm/shared-utils');

const MEETING_CREATE_FIELDS = Object.freeze([
    'leadId', 'meeting', 'guest', 'attendees', 'customFields',
    'provider', 'category'
]);
const MEETING_UPDATE_FIELDS = Object.freeze([...MEETING_CREATE_FIELDS, 'status']);
const ATTENDEE_FIELDS = Object.freeze(['userId', 'role', 'status']);
const BOOKING_LINK_FIELDS = Object.freeze([
    'slug', 'title', 'description', 'durationOptions', 'defaultDuration', 'slotInterval', 'availability', 'isActive', 'provider', 'meetingType'
]);
const AVAILABILITY_FIELDS = Object.freeze(['days', 'startTime', 'endTime', 'timezone']);
const PUBLIC_BOOKING_FIELDS = Object.freeze([
    'meeting', 'guest',
]);

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function pickStrictObject(value, allowedFields, label) {
    if (!isPlainObject(value)) throw ApiError.badRequest(`${label} must be an object`);
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field)).sort();
    if (unknown.length) throw ApiError.badRequest(`Unsupported ${label} fields: ${unknown.join(', ')}`);
    return Object.fromEntries(
        allowedFields.filter((field) => value[field] !== undefined).map((field) => [field, value[field]])
    );
}

function sanitizeMeeting(input, allowedFields) {
    const meeting = pickStrictObject(input, allowedFields, 'meeting');
    if (meeting.attendees !== undefined) {
        if (!Array.isArray(meeting.attendees)) throw ApiError.badRequest('attendees must be an array');
        meeting.attendees = meeting.attendees.map((attendee, index) => {
            const clean = pickStrictObject(attendee, ATTENDEE_FIELDS, `attendees[${index}]`);
            if (clean.userId !== undefined && clean.userId !== null && clean.userId !== '') {
                clean.userId = requireObjectId(clean.userId, `attendees[${index}].userId`);
            }
            return clean;
        });
    }
    if (meeting.customFields !== undefined && !isPlainObject(meeting.customFields)) {
        throw ApiError.badRequest('customFields must be an object');
    }
    if (meeting.leadId !== undefined && meeting.leadId !== null && meeting.leadId !== '') {
        meeting.leadId = requireObjectId(meeting.leadId, 'leadId');
    }
    if (meeting.meeting !== undefined) {
        if (!isPlainObject(meeting.meeting)) throw ApiError.badRequest('meeting must be an object');
        meeting.meeting = pickStrictObject(meeting.meeting, ['title', 'description', 'agenda', 'scheduledAt', 'duration', 'status', 'notes', 'link', 'outcome', 'nextFollowUpAt', 'followUpNotes', 'meetingType', 'location'], 'meeting');
        if (meeting.meeting.agenda !== undefined) {
            if (!Array.isArray(meeting.meeting.agenda)) throw ApiError.badRequest('meeting.agenda must be an array');
            meeting.meeting.agenda = meeting.meeting.agenda.map((item, index) => {
                if (!isPlainObject(item)) throw ApiError.badRequest(`meeting.agenda[${index}] must be an object`);
                return pickStrictObject(item, ['id', 'text', 'completed'], `meeting.agenda[${index}]`);
            });
        }
        if (meeting.meeting.scheduledAt !== undefined && Number.isNaN(new Date(meeting.meeting.scheduledAt).getTime())) {
            throw ApiError.badRequest('meeting.scheduledAt must be a valid date');
        }
        if (meeting.meeting.duration !== undefined && (!Number.isInteger(meeting.meeting.duration) || meeting.meeting.duration < 5 || meeting.meeting.duration > 480)) {
            throw ApiError.badRequest('meeting.duration must be whole minutes between 5 and 480');
        }
    }
    if (meeting.guest !== undefined) {
        if (!isPlainObject(meeting.guest)) throw ApiError.badRequest('guest must be an object');
        meeting.guest = pickStrictObject(meeting.guest, ['name', 'email', 'phone'], 'guest');
    }
    return meeting;
}

function pickMeetingCreateInput(input) {
    return sanitizeMeeting(input, MEETING_CREATE_FIELDS);
}

function pickMeetingUpdateInput(input) {
    return sanitizeMeeting(input, MEETING_UPDATE_FIELDS);
}

function pickBookingLinkInput(input) {
    const link = pickStrictObject(input, BOOKING_LINK_FIELDS, 'booking link');
    if (link.durationOptions !== undefined) {
        if (!Array.isArray(link.durationOptions) || !link.durationOptions.length) {
            throw ApiError.badRequest('durationOptions must be a non-empty array');
        }
        if (link.durationOptions.some((duration) => !Number.isInteger(duration) || duration < 5 || duration > 480)) {
            throw ApiError.badRequest('durationOptions must contain whole minutes between 5 and 480');
        }
        link.durationOptions = [...new Set(link.durationOptions)];
    }
    if (link.defaultDuration !== undefined) {
        if (!Number.isInteger(link.defaultDuration) || link.defaultDuration < 5) {
            throw ApiError.badRequest('defaultDuration must be a positive integer >= 5');
        }
        if (link.durationOptions && !link.durationOptions.includes(link.defaultDuration)) {
            throw ApiError.badRequest('defaultDuration must exist in durationOptions');
        }
    }
    if (link.slotInterval !== undefined) {
        if (!Number.isInteger(link.slotInterval) || link.slotInterval < 5) {
            throw ApiError.badRequest('slotInterval must be a positive integer >= 5');
        }
    }
    if (link.availability !== undefined) {
        link.availability = pickStrictObject(link.availability, AVAILABILITY_FIELDS, 'availability');
        if (link.availability.days !== undefined && !Array.isArray(link.availability.days)) {
            throw ApiError.badRequest('availability.days must be an array');
        }
        if (link.availability.timezone !== undefined) {
            try {
                new Intl.DateTimeFormat('en-US', { timeZone: link.availability.timezone }).format();
            } catch {
                throw ApiError.badRequest('availability.timezone must be a valid IANA timezone');
            }
        }
        for (const field of ['startTime', 'endTime']) {
            if (link.availability[field] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(link.availability[field])) {
                throw ApiError.badRequest(`availability.${field} must use HH:mm format`);
            }
        }
    }
    if (link.slug !== undefined && !/^[a-z0-9][a-z0-9-]{2,79}$/.test(link.slug)) {
        throw ApiError.badRequest('slug must contain 3-80 lowercase letters, numbers, or hyphens');
    }
    return link;
}

function pickPublicBookingInput(input) {
    const booking = pickStrictObject(input, PUBLIC_BOOKING_FIELDS, 'booking');
    if (booking.meeting !== undefined) {
        if (!isPlainObject(booking.meeting)) throw ApiError.badRequest('meeting must be an object');
        booking.meeting = pickStrictObject(booking.meeting, ['title', 'scheduledAt', 'duration'], 'meeting');
        if (booking.meeting.scheduledAt !== undefined && Number.isNaN(new Date(booking.meeting.scheduledAt).getTime())) {
            throw ApiError.badRequest('meeting.scheduledAt must be a valid date');
        }
        if (booking.meeting.duration !== undefined && (!Number.isInteger(booking.meeting.duration) || booking.meeting.duration < 5 || booking.meeting.duration > 480)) {
            throw ApiError.badRequest('meeting.duration must be whole minutes between 5 and 480');
        }
    }
    if (booking.guest !== undefined) {
        if (!isPlainObject(booking.guest)) throw ApiError.badRequest('guest must be an object');
        booking.guest = pickStrictObject(booking.guest, ['name', 'email', 'phone'], 'guest');
    }
    return booking;
}

function requireObjectId(value, name) {
    if (!mongoose.Types.ObjectId.isValid(String(value || ''))) {
        throw ApiError.badRequest(`${name} must be a valid ObjectId`);
    }
    return String(value);
}

function pagination(query, defaultLimit = 25, maxLimit = 100) {
    const page = Number.parseInt(query.page === undefined ? '1' : query.page, 10);
    const limit = Number.parseInt(query.limit === undefined ? String(defaultLimit) : query.limit, 10);
    if (!Number.isInteger(page) || page < 1) throw ApiError.badRequest('page must be a positive integer');
    if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
        throw ApiError.badRequest(`limit must be between 1 and ${maxLimit}`);
    }
    return { page, limit, skip: (page - 1) * limit };
}

module.exports = {
    pickMeetingCreateInput,
    pickMeetingUpdateInput,
    pickBookingLinkInput,
    pickPublicBookingInput,
    requireObjectId,
    pagination,
};
