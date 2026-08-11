const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { createCorsOptions, errorHandler, requestLogger, contextMiddleware } = require('@sparkcrm/shared-middleware');
const { setupProxies } = require('./proxy/serviceProxy');

const app = express();

// ─── Security ───
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(compression());

// ─── Logging ───
app.use(morgan('dev'));
app.use(requestLogger('api-gateway'));

// ─── Health Check ───
app.get('/health', (req, res) => {
    res.json({
        service: 'api-gateway',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ─── Setup Service Proxies ───
// IMPORTANT: Proxies MUST be registered BEFORE express.json() body parser.
// If express.json() runs first, it consumes the raw request body stream.
// http-proxy-middleware then tries to forward the request but the body is
// already consumed → downstream service hangs waiting for body data.
setupProxies(app);

// ─── Body Parsers (for any non-proxied local routes) ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── 404 Handler ───
app.use('/{*path}', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
    });
});

// ─── Global Error Handler ───
app.use(errorHandler);

module.exports = app;
