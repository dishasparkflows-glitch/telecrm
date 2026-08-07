const { errorHandler } = require('./errorHandler');
const { requestLogger } = require('./requestLogger');
const { auditLog } = require('./auditLog');
const serviceIdentity = require('./serviceIdentity');
const cors = require('./cors');

module.exports = {
    errorHandler,
    requestLogger,
    auditLog,
    ...serviceIdentity,
    ...cors,
};
