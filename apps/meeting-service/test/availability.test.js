const test = require('node:test');
const assert = require('node:assert/strict');
const { zonedSlot, isWithinAvailability } = require('../src/controllers/meeting.controller');

test('converts booking times into configured timezone slots', () => {
    assert.deepEqual(zonedSlot(new Date('2026-07-27T09:30:00.000Z'), 'UTC'), { day: 'monday', time: '09:30' });
});

test('requires the full meeting duration to fit availability', () => {
    const availability = { days: ['monday'], startTime: '09:00', endTime: '10:00', timezone: 'UTC' };
    assert.equal(isWithinAvailability(new Date('2026-07-27T09:30:00.000Z'), 30, availability), true);
    assert.equal(isWithinAvailability(new Date('2026-07-27T09:45:00.000Z'), 30, availability), false);
    assert.equal(isWithinAvailability(new Date('2026-07-28T09:00:00.000Z'), 30, availability), false);
});
