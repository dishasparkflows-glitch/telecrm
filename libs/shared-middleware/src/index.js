const { errorHandler } = require('./errorHandler');
const { requestLogger } = require('./requestLogger');
const { auditLog, auditLogger } = require('./auditLog');
const serviceIdentity = require('./serviceIdentity');
const cors = require('./cors');
const { contextMiddleware, requestContext } = require('./contextMiddleware');

module.exports = {
    errorHandler,
    requestLogger,
    auditLog,
    auditLogger,
    contextMiddleware,
    requestContext,
    ...serviceIdentity,
    ...cors,
};
