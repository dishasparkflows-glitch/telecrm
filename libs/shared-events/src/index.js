const { EVENTS } = require('./events');
const { publishEvent } = require('./publisher');
const { subscribeToEvents } = require('./subscriber');

module.exports = {
    EVENTS,
    publishEvent,
    subscribeToEvents,
};
