const test = require('node:test');
const assert = require('node:assert/strict');

const { Meeting, BookingLink } = require('../src/models/Meeting');
const meetingController = require('../src/controllers/meeting.controller');
const meetingRoutes = require('../src/routes/meeting.routes');
const {
    pickMeetingCreateInput,
    pickMeetingUpdateInput,
    pickBookingLinkInput,
    pickPublicBookingInput,
    pagination,
} = require('../src/utils/meetingDto');

const TENANT_ID = '64e000000000000000000001';
const BRANCH_ID = '64e000000000000000000002';
const USER_ID = '64e000000000000000000003';
const OTHER_USER_ID = '64e000000000000000000004';
const MEETING_ID = '64e000000000000000000005';

function ownOnlyHeaders() {
    return {
        'x-tenant-id': TENANT_ID,
        'x-user-id': USER_ID,
        'x-user-role': 'agent',
        'x-user-branch-id': BRANCH_ID,
        'x-user-permissions': JSON.stringify({ meetings: { isOwn: true, isGlobal: false } }),
    };
}

function invoke(handler, req, expectSuccess = false) {
    return new Promise((resolve, reject) => {
        const res = {
            statusCode: null,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(body) {
                this.body = body;
                if (expectSuccess) resolve(this);
                else reject(new Error('Expected request to be rejected'));
            },
        };
        handler(req, res, (error) => {
            if (expectSuccess) reject(error || new Error('Unexpected next call'));
            else if (error) resolve(error);
            else reject(new Error('Expected an error'));
        });
    });
}

test('meeting DTOs reject scope and system-managed collaboration fields', () => {
    for (const field of ['tenantId', 'branchId', 'hostId', 'comments', 'attachments', 'reminderSent', 'createdAt']) {
        assert.throws(
            () => pickMeetingCreateInput({ title: 'Safe', scheduledAt: '2026-08-05T10:00:00Z', [field]: 'injected' }),
            (error) => error.statusCode === 400 && error.message.includes(field)
        );
    }
    assert.throws(() => pickMeetingCreateInput({ status: 'completed' }), /Unsupported meeting fields/);
    assert.equal(pickMeetingUpdateInput({ status: 'confirmed' }).status, 'confirmed');
    assert.throws(
        () => pickMeetingUpdateInput({ attendees: [{ userId: USER_ID, _id: MEETING_ID }] }),
        /Unsupported attendees\[0\] fields/
    );
});

test('booking DTOs reject identity injection and validate duration and availability', () => {
    assert.throws(
        () => pickBookingLinkInput({ title: 'Demo', tenantId: TENANT_ID }),
        /Unsupported booking link fields/
    );
    assert.deepEqual(pickBookingLinkInput({
        title: 'Demo',
        durationOptions: [30, 30, 60],
        availability: { timezone: 'Asia/Kolkata', startTime: '09:00', endTime: '18:00' },
    }), {
        title: 'Demo',
        durationOptions: [30, 60],
        availability: { timezone: 'Asia/Kolkata', startTime: '09:00', endTime: '18:00' },
    });
    assert.throws(() => pickBookingLinkInput({ availability: { timezone: 'Not/AZone' } }), /valid IANA timezone/);
    assert.throws(() => pickPublicBookingInput({ scheduledAt: 'invalid', duration: 30 }), /valid date/);
    assert.throws(
        () => pickPublicBookingInput({ scheduledAt: '2026-08-05T10:00:00Z', duration: 30, hostId: USER_ID }),
        /Unsupported booking fields/
    );
});

test('meeting pagination is bounded and confirmed is a valid model status', () => {
    assert.deepEqual(pagination({ page: '2', limit: '25' }), { page: 2, limit: 25, skip: 25 });
    assert.throws(() => pagination({ limit: '101' }), (error) => error.statusCode === 400);
    assert.ok(Meeting.schema.path('status').enumValues.includes('confirmed'));
});

test('own-only meeting lists include only hosted or attended meetings', async (t) => {
    const originalFind = Meeting.find;
    const originalCount = Meeting.countDocuments;
    let capturedFilter;
    Meeting.find = (filter) => {
        capturedFilter = filter;
        return {
            sort() { return this; },
            skip() { return this; },
            limit() { return this; },
            async populate() { return []; },
        };
    };
    Meeting.countDocuments = async () => 0;
    t.after(() => {
        Meeting.find = originalFind;
        Meeting.countDocuments = originalCount;
    });

    const response = await invoke(meetingController.getMeetings, {
        headers: ownOnlyHeaders(),
        query: { page: '1', limit: '25' },
        params: {},
        body: {},
    }, true);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(capturedFilter, {
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        $or: [{ hostId: USER_ID }, { 'attendees.userId': USER_ID }],
    });
});

test('another user cannot update, delete, comment on, or attach to a meeting', async (t) => {
    const originalFindOne = Meeting.findOne;
    let saveCalls = 0;
    let deleteCalls = 0;
    Meeting.findOne = async () => ({
        _id: MEETING_ID,
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        hostId: OTHER_USER_ID,
        attendees: [],
        comments: [],
        attachments: [],
        async save() { saveCalls += 1; },
        async deleteOne() { deleteCalls += 1; },
    });
    t.after(() => { Meeting.findOne = originalFindOne; });

    const requests = [
        [meetingController.updateMeeting, { title: 'Hijacked' }],
        [meetingController.deleteMeeting, {}],
        [meetingController.addMeetingComment, { text: 'Unauthorized' }],
        [meetingController.addMeetingAttachment, { name: 'x', url: 'https://example.test/x', fileType: 'text/plain' }],
    ];
    for (const [handler, body] of requests) {
        const error = await invoke(handler, {
            headers: ownOnlyHeaders(),
            params: { id: MEETING_ID },
            query: {},
            body,
        });
        assert.equal(error.statusCode, 403);
    }
    assert.equal(saveCalls, 0);
    assert.equal(deleteCalls, 0);
});

test('booking-link deletion route is registered and model ownership remains explicit', () => {
    const route = meetingRoutes.stack.find((layer) => (
        layer.route?.path === '/booking-links/:id' && layer.route.methods.delete
    ));
    assert.ok(route);
    assert.ok(BookingLink.schema.path('userId'));
});
