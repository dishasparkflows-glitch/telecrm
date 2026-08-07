const crypto = require('crypto');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const {
    LeadSourceConnection,
    LeadSourceMapping,
    InboundLeadEvent,
    MetaOAuthState,
} = require('../models/LeadSourceModels');
const { encrypt } = require('../services/leadSourceCrypto.service');
const { createOrUpdateLeadFromSource } = require('../services/leadIngestion.service');
const {
    verifyMetaSignature,
    extractLeadChanges,
    normalizeMetaLead,
    fetchMetaLead,
    testMetaConnection,
    listMetaPages,
    listMetaLeadForms,
    subscribeMetaPageToLeadgen,
    buildMetaOAuthUrl,
    exchangeMetaOAuthCode,
    fetchMetaIdentityWithToken,
    getMetaOAuthRedirectUri,
} = require('../services/metaLeadAds.service');

const hashApiKey = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const createApiKey = () => {
    const prefix = crypto.randomBytes(4).toString('hex');
    const secret = crypto.randomBytes(32).toString('base64url');
    return { prefix, apiKey: `sparkcrm_${prefix}_${secret}` };
};

const readInboundApiKey = (req) => {
    const authorization = req.headers.authorization || '';
    if (authorization.startsWith('Bearer ')) return authorization.slice(7).trim();
    return String(req.headers['x-sparkcrm-api-key'] || '').trim();
};

const maskSecret = (value) => {
    if (!value) return '';
    const raw = String(value);
    return raw.length <= 8 ? '••••••' : `${raw.slice(0, 4)}••••••${raw.slice(-4)}`;
};

const startMetaOAuth = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.query.branchId || req.headers['x-branch-id'] || req.headers['x-user-branch-id'] || null;
    const state = crypto.randomBytes(32).toString('base64url');
    await MetaOAuthState.create({
        stateHash: hashApiKey(state),
        tenantId,
        branchId: branchId && branchId !== 'all' ? branchId : null,
        userId: userId || null,
        expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    ApiResponse.success(res, { authorizationUrl: buildMetaOAuthUrl({ state }), redirectUri: getMetaOAuthRedirectUri() }, 'Meta OAuth authorization URL created');
});

const completeMetaOAuth = asyncHandler(async (req, res) => {
    const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const redirect = (status, message = '') => res.redirect(`${frontendUrl}/settings?meta=${encodeURIComponent(status)}${message ? `&message=${encodeURIComponent(message)}` : ''}`);
    if (req.query.error) return redirect('error', req.query.error_description || req.query.error);
    if (!req.query.code || !req.query.state) return redirect('error', 'Missing Meta OAuth code or state');

    const oauthState = await MetaOAuthState.findOneAndUpdate(
        { stateHash: hashApiKey(req.query.state), usedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { usedAt: new Date() } },
        { new: true }
    );
    if (!oauthState) return redirect('error', 'OAuth session expired or was already used');

    try {
        const token = await exchangeMetaOAuthCode({ code: req.query.code });
        const identity = await fetchMetaIdentityWithToken(token.accessToken);
        await LeadSourceConnection.findOneAndUpdate(
            { tenantId: oauthState.tenantId, provider: 'meta_lead_ads', externalAccountId: identity.id },
            {
                $set: {
                    tenantId: oauthState.tenantId,
                    branchId: oauthState.branchId,
                    provider: 'meta_lead_ads',
                    label: `Meta Lead Ads - ${identity.name || identity.id}`,
                    externalAccountId: identity.id,
                    externalAccountName: identity.name || '',
                    accessToken: encrypt(token.accessToken),
                    tokenExpiresAt: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null,
                    isActive: true,
                    health: { status: 'healthy', message: `Connected as ${identity.name || identity.id}`, checkedAt: new Date() },
                    updatedBy: oauthState.userId,
                },
                $setOnInsert: { createdBy: oauthState.userId },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return redirect('connected');
    } catch (error) {
        return redirect('error', error.response?.data?.error?.message || error.message || 'Meta connection failed');
    }
});

const listConnections = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const connections = await LeadSourceConnection.find({ tenantId }).sort({ updatedAt: -1 }).select('+verifyToken').lean();
    const data = connections.map((connection) => ({
        ...connection,
        accessToken: connection.accessToken ? '••••••' : '',
        verifyToken: maskSecret(connection.verifyToken),
    }));
    ApiResponse.success(res, data, 'Lead source connections fetched');
});

const saveConnection = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.body.branchId || req.headers['x-branch-id'] || req.headers['x-user-branch-id'] || null;
    const {
        id,
        provider = 'meta_lead_ads',
        label,
        externalAccountId,
        externalAccountName,
        accessToken,
        tokenExpiresAt,
        verifyToken,
        isActive = true,
    } = req.body;

    if (provider !== 'meta_lead_ads') throw ApiError.badRequest('Only meta_lead_ads is supported by this endpoint');
    if (!externalAccountId) throw ApiError.badRequest('externalAccountId is required');

    const update = {
        tenantId,
        branchId: branchId && branchId !== 'all' ? branchId : null,
        provider,
        label: label || 'Meta Lead Ads',
        externalAccountId,
        externalAccountName: externalAccountName || '',
        tokenExpiresAt: tokenExpiresAt || null,
        isActive,
        updatedBy: userId || null,
    };

    if (accessToken) update.accessToken = encrypt(accessToken);
    if (verifyToken) update.verifyToken = verifyToken;

    const connection = await LeadSourceConnection.findOneAndUpdate(
        id ? { _id: id, tenantId } : { tenantId, provider, externalAccountId },
        { $set: update, $setOnInsert: { createdBy: userId || null } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    ApiResponse.success(res, { ...connection.toObject(), accessToken: connection.accessToken ? '••••••' : '' }, 'Lead source connection saved');
});

const createApiConnection = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.body.branchId || req.headers['x-branch-id'] || req.headers['x-user-branch-id'] || null;
    const provider = ['website_api', 'custom_api', 'google_ads'].includes(req.body.provider) ? req.body.provider : 'website_api';
    const sourceByProvider = { website_api: 'website', custom_api: 'api', google_ads: 'google_ads' };
    const { prefix, apiKey } = createApiKey();

    const connection = await LeadSourceConnection.create({
        tenantId,
        branchId: branchId && branchId !== 'all' ? branchId : null,
        provider,
        label: req.body.label || 'Website/API Lead Capture',
        externalAccountId: crypto.randomUUID(),
        apiKeyHash: hashApiKey(apiKey),
        apiKeyPrefix: prefix,
        defaultAssignedTo: req.body.defaultAssignedTo || null,
        defaultSource: req.body.defaultSource || sourceByProvider[provider],
        isActive: req.body.isActive !== false,
        createdBy: userId || null,
        updatedBy: userId || null,
    });

    ApiResponse.created(res, {
        ...connection.toObject(),
        apiKey,
        endpoint: `${process.env.API_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/api/leads/webhooks/inbound/${connection._id}`,
    }, 'Inbound lead API connection created. Store the API key now; it will not be shown again.');
});

const rotateApiConnectionKey = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { prefix, apiKey } = createApiKey();
    const connection = await LeadSourceConnection.findOneAndUpdate(
        { _id: req.params.id, tenantId, provider: { $in: ['website_api', 'custom_api', 'google_ads'] } },
        { $set: { apiKeyHash: hashApiKey(apiKey), apiKeyPrefix: prefix, updatedBy: req.headers['x-user-id'] || null } },
        { new: true }
    );
    if (!connection) throw ApiError.notFound('Inbound lead API connection not found');
    ApiResponse.success(res, { apiKey, apiKeyPrefix: prefix }, 'API key rotated. The previous key is no longer valid.');
});

const receiveInboundApiLead = asyncHandler(async (req, res) => {
    const connection = await LeadSourceConnection.findOne({
        _id: req.params.connectionId,
        provider: { $in: ['website_api', 'custom_api', 'google_ads'] },
        isActive: true,
    }).select('+apiKeyHash');
    if (!connection) throw ApiError.notFound('Inbound lead connection not found');

    const providedKeyHash = hashApiKey(readInboundApiKey(req));
    const storedKeyHash = String(connection.apiKeyHash || '');
    const validKey = storedKeyHash.length === providedKeyHash.length && crypto.timingSafeEqual(Buffer.from(storedKeyHash), Buffer.from(providedKeyHash));
    if (!validKey) throw ApiError.unauthorized('Invalid inbound lead API key');

    const payload = req.body?.lead && typeof req.body.lead === 'object' ? req.body.lead : req.body;
    const fullName = String(payload.name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = String(payload.firstName || fullName[0] || '').trim();
    if (!firstName) throw ApiError.badRequest('firstName or name is required');
    if (!payload.email && !payload.phone) throw ApiError.badRequest('email or phone is required');

    const leadData = {
        firstName,
        lastName: String(payload.lastName || fullName.slice(1).join(' ') || '').trim(),
        email: String(payload.email || '').trim(),
        phone: String(payload.phone || '').trim(),
        company: String(payload.company || '').trim(),
        designation: String(payload.designation || '').trim(),
        expectedValue: Number(payload.expectedValue) || 0,
        priority: payload.priority,
        tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 25).map(String) : [],
        customFields: payload.customFields && typeof payload.customFields === 'object' ? payload.customFields : {},
    };
    Object.keys(leadData).forEach((key) => leadData[key] === undefined && delete leadData[key]);

    const externalId = String(req.body.externalId || payload.externalId || '').trim();
    const result = await createOrUpdateLeadFromSource({
        tenantId: connection.tenantId,
        branchId: connection.branchId,
        source: connection.defaultSource || 'api',
        sourceDetails: connection.label,
        leadData,
        assignedTo: connection.defaultAssignedTo || null,
        actorType: 'integration',
        origin: {
            provider: connection.provider,
            sourceId: String(connection._id),
            sourceName: connection.label,
            rawSource: 'inbound_api',
        },
        firstTouch: { capturedAt: new Date() },
        lastTouch: { capturedAt: new Date() },
        externalIdentity: externalId ? { provider: connection.provider, externalId, metadata: { connectionId: connection._id } } : null,
        rawPayload: req.body,
    });

    res.status(result.created ? 201 : 200).json({
        success: true,
        data: { leadId: result.lead._id, created: result.created, duplicate: result.duplicate },
        message: result.created ? 'Lead created' : 'Lead already exists',
    });
});

const listMappings = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const mappings = await LeadSourceMapping.find({ tenantId }).sort({ updatedAt: -1 });
    ApiResponse.success(res, mappings, 'Lead source mappings fetched');
});

const getTenantConnection = async (req) => {
    const tenantId = req.headers['x-tenant-id'];
    const connection = await LeadSourceConnection.findOne({ _id: req.params.id, tenantId });
    if (!connection) throw ApiError.notFound('Lead source connection not found');
    return connection;
};

const testConnection = asyncHandler(async (req, res) => {
    const connection = await getTenantConnection(req);
    try {
        const metaAccount = await testMetaConnection({ connection });
        const expiresSoon = connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - Date.now() <= 7 * 24 * 60 * 60_000;
        connection.health = {
            status: expiresSoon ? 'expiring' : 'healthy',
            message: expiresSoon
                ? `Connected as ${metaAccount.name || metaAccount.id}; token expires soon. Reconnect Meta.`
                : `Connected as ${metaAccount.name || metaAccount.id}`,
            checkedAt: new Date(),
        };
        await connection.save();
        ApiResponse.success(res, { account: metaAccount, health: connection.health }, 'Meta connection is healthy');
    } catch (err) {
        connection.health = {
            status: 'failed',
            message: err.response?.data?.error?.message || err.message,
            checkedAt: new Date(),
        };
        await connection.save();
        throw ApiError.badRequest(connection.health.message || 'Meta connection test failed');
    }
});

const discoverPages = asyncHandler(async (req, res) => {
    const connection = await getTenantConnection(req);
    const pages = await listMetaPages({ connection });
    ApiResponse.success(res, pages, 'Meta pages fetched');
});

const discoverForms = asyncHandler(async (req, res) => {
    const connection = await getTenantConnection(req);
    const forms = await listMetaLeadForms({ connection, pageId: req.params.pageId });
    ApiResponse.success(res, forms, 'Meta lead forms fetched');
});

const subscribePage = asyncHandler(async (req, res) => {
    const connection = await getTenantConnection(req);
    if (!req.params.pageId) throw ApiError.badRequest('Meta page ID is required');
    const result = await subscribeMetaPageToLeadgen({ connection, pageId: req.params.pageId });
    ApiResponse.success(res, result, 'Meta page subscribed to leadgen webhooks');
});

const saveMapping = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.body.branchId || req.headers['x-branch-id'] || req.headers['x-user-branch-id'] || null;
    const {
        id,
        connectionId,
        externalPageId,
        externalPageName,
        externalFormId,
        externalFormName,
        source = 'facebook',
        defaultAssignedTo,
        welcomeTemplateName,
        sendWelcomeMessage = false,
        requireWhatsappConsent = true,
        fieldMapping = {},
        isActive = true,
    } = req.body;

    if (!connectionId) throw ApiError.badRequest('connectionId is required');
    if (!externalPageId) throw ApiError.badRequest('externalPageId is required');
    if (!externalFormId) throw ApiError.badRequest('externalFormId is required');
    if (sendWelcomeMessage && !welcomeTemplateName) {
        throw ApiError.badRequest('An approved WhatsApp template name is required when welcome messaging is enabled');
    }

    const normalizedPageId = String(externalPageId).trim();
    const normalizedFormId = String(externalFormId).trim();
    const connection = await LeadSourceConnection.findOne({
        _id: connectionId,
        tenantId,
        provider: 'meta_lead_ads',
        isActive: true,
    });
    if (!connection) throw ApiError.notFound('Active Meta lead source connection not found');

    const targetFilter = id
        ? { _id: id, tenantId }
        : {
            tenantId,
            provider: 'meta_lead_ads',
            externalPageId: normalizedPageId,
            externalFormId: normalizedFormId,
        };
    const existingMapping = await LeadSourceMapping.findOne(targetFilter);
    if (id && !existingMapping) throw ApiError.notFound('Lead source mapping not found');

    if (isActive) {
        const conflict = await LeadSourceMapping.findOne({
            provider: 'meta_lead_ads',
            externalPageId: normalizedPageId,
            externalFormId: normalizedFormId,
            isActive: true,
            ...(existingMapping ? { _id: { $ne: existingMapping._id } } : {}),
        }).select('_id tenantId connectionId');
        if (conflict) {
            throw ApiError.conflict('This Meta Page/Form is already assigned to another active mapping');
        }
    }

    let mapping;
    try {
        mapping = await LeadSourceMapping.findOneAndUpdate(
        existingMapping ? { _id: existingMapping._id, tenantId } : targetFilter,
        {
            $set: {
                tenantId,
                branchId: branchId && branchId !== 'all' ? branchId : null,
                connectionId,
                provider: 'meta_lead_ads',
                externalPageId: normalizedPageId,
                externalPageName: externalPageName || '',
                externalFormId: normalizedFormId,
                externalFormName: externalFormName || '',
                source,
                defaultAssignedTo: defaultAssignedTo || null,
                welcomeTemplateName: welcomeTemplateName || '',
                sendWelcomeMessage,
                requireWhatsappConsent,
                fieldMapping,
                isActive,
                updatedBy: userId || null,
            },
            $setOnInsert: { createdBy: userId || null },
        },
        { upsert: !existingMapping, new: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        if (error?.code === 11000) {
            throw ApiError.conflict('This Meta Page/Form is already assigned to another active mapping');
        }
        throw error;
    }

    if (mapping.isActive) {
        await InboundLeadEvent.updateMany(
            {
                provider: 'meta_lead_ads',
                externalPageId: normalizedPageId,
                externalFormId: normalizedFormId,
                status: 'unmapped',
                tenantId: null,
            },
            {
                $set: {
                    tenantId,
                    branchId: mapping.branchId,
                    mappingId: mapping._id,
                    status: 'received',
                    error: '',
                    processingAt: null,
                },
            }
        );
    }

    ApiResponse.success(res, mapping, 'Lead source mapping saved');
});

const getWebhookConfig = asyncHandler(async (_req, res) => {
    const verifyToken = process.env.META_LEAD_ADS_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || '';
    ApiResponse.success(res, {
        webhookUrl: `${process.env.API_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/api/leads/webhooks/meta`,
        verifyTokenConfigured: Boolean(verifyToken),
        appSecretConfigured: Boolean(process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET),
        appIdConfigured: Boolean(process.env.META_APP_ID || process.env.FACEBOOK_APP_ID),
        oauthRedirectUri: getMetaOAuthRedirectUri(),
    }, 'Meta webhook configuration');
});

const verifyMetaWebhook = asyncHandler(async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = process.env.META_LEAD_ADS_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (!expectedToken) throw ApiError.internal('Meta webhook verify token is not configured');
    if (mode === 'subscribe' && token === expectedToken) {
        return res.status(200).send(challenge || '');
    }
    throw ApiError.forbidden('Meta webhook verification failed');
});

const resolveActiveMetaMapping = async ({ event, change }) => {
    if (event.mappingId || event.tenantId) {
        if (!event.mappingId || !event.tenantId) {
            return { status: 'invalid', mapping: null };
        }
        const mapping = await LeadSourceMapping.findOne({
            _id: event.mappingId,
            tenantId: event.tenantId,
            provider: 'meta_lead_ads',
            externalPageId: change.externalPageId,
            externalFormId: change.externalFormId,
            isActive: true,
        });
        return { status: mapping ? 'resolved' : 'invalid', mapping };
    }

    const mappings = await LeadSourceMapping.find({
        provider: 'meta_lead_ads',
        externalPageId: change.externalPageId,
        externalFormId: change.externalFormId,
        isActive: true,
    }).limit(2);
    if (mappings.length === 0) return { status: 'unmapped', mapping: null };
    if (mappings.length > 1) return { status: 'ambiguous', mapping: null };
    return { status: 'resolved', mapping: mappings[0] };
};

const processStoredMetaEvent = async ({ event, change, rawPayload: _rawPayload }) => {
    const resolution = await resolveActiveMetaMapping({ event, change });
    const mapping = resolution.mapping;

    if (resolution.status === 'ambiguous' || resolution.status === 'invalid') {
        const error = resolution.status === 'ambiguous'
            ? 'Ambiguous active mappings for Meta page/form'
            : 'Stored Meta event mapping scope is invalid';
        await InboundLeadEvent.updateOne(
            { _id: event._id },
            { $set: { status: 'failed', error, processingAt: null }, $inc: { attempts: 1 } }
        );
        return { status: 'failed', externalLeadId: change.externalLeadId, error };
    }

    if (!mapping) {
        await InboundLeadEvent.updateOne(
            { _id: event._id },
            { $set: { status: 'unmapped', error: 'No active mapping for page/form', processingAt: null }, $inc: { attempts: 1 } }
        );
        return { status: 'unmapped', externalLeadId: change.externalLeadId };
    }

    await InboundLeadEvent.updateOne(
        { _id: event._id },
        {
            $set: {
                tenantId: mapping.tenantId,
                branchId: mapping.branchId,
                mappingId: mapping._id,
            },
        }
    );

    const connection = await LeadSourceConnection.findOne({
        _id: mapping.connectionId,
        tenantId: mapping.tenantId,
        provider: 'meta_lead_ads',
        isActive: true,
    });
    if (!connection) {
        await InboundLeadEvent.updateOne(
            { _id: event._id },
            { $set: { tenantId: mapping.tenantId, branchId: mapping.branchId, mappingId: mapping._id, status: 'failed', error: 'Connection inactive or missing', processingAt: null }, $inc: { attempts: 1 } }
        );
        return { status: 'failed', externalLeadId: change.externalLeadId, error: 'Connection inactive or missing' };
    }

    try {
        const graphLead = await fetchMetaLead({ externalLeadId: change.externalLeadId, connection });
        const normalized = normalizeMetaLead({ graphLead, mapping, change });
        const leadResult = await createOrUpdateLeadFromSource({
            tenantId: mapping.tenantId,
            branchId: mapping.branchId,
            source: mapping.source || 'facebook',
            sourceDetails: normalized.leadData.sourceDetails,
            leadData: normalized.leadData,
            assignedTo: mapping.defaultAssignedTo || null,
            actorType: 'integration',
            origin: normalized.origin,
            firstTouch: normalized.touch,
            lastTouch: normalized.touch,
            consent: normalized.consent,
            externalIdentity: {
                provider: 'meta_lead_ads',
                externalId: change.externalLeadId,
                metadata: {
                    pageId: change.externalPageId,
                    formId: change.externalFormId,
                    rawFields: normalized.rawFields,
                },
            },
            rawPayload: graphLead,
        });

        const consentSatisfied = !mapping.requireWhatsappConsent || normalized.consent.whatsappOptIn;
        if (leadResult.created && mapping.sendWelcomeMessage && mapping.welcomeTemplateName && normalized.leadData.phone && consentSatisfied) {
            await publishEvent(EVENTS.WHATSAPP_WELCOME_REQUESTED, {
                tenantId: mapping.tenantId,
                branchId: mapping.branchId,
                leadId: leadResult.lead._id,
                assignedTo: leadResult.lead.assignedTo,
                phone: normalized.leadData.phone,
                templateName: mapping.welcomeTemplateName,
                templateData: {
                    firstName: normalized.leadData.firstName,
                    lastName: normalized.leadData.lastName,
                    fullName: `${normalized.leadData.firstName} ${normalized.leadData.lastName || ''}`.trim(),
                    company: normalized.leadData.company || '',
                    source: mapping.source || 'facebook',
                    pageName: mapping.externalPageName || '',
                    formName: mapping.externalFormName || '',
                },
                consent: normalized.consent,
                consentRequired: mapping.requireWhatsappConsent,
                externalLeadId: change.externalLeadId,
                idempotencyKey: `meta-welcome:${mapping.tenantId}:${change.externalLeadId}`,
            });
        }

        await InboundLeadEvent.updateOne(
            { _id: event._id },
            {
                $set: {
                    tenantId: mapping.tenantId,
                    branchId: mapping.branchId,
                    mappingId: mapping._id,
                    leadId: leadResult.lead._id,
                    status: 'processed',
                    normalizedPayload: normalized,
                    processedAt: new Date(),
                    processingAt: null,
                    error: '',
                },
                $inc: { attempts: 1 },
            }
        );

        return { status: leadResult.duplicate ? 'duplicate_lead' : 'processed', leadId: leadResult.lead._id, externalLeadId: change.externalLeadId };
    } catch (err) {
        await InboundLeadEvent.updateOne(
            { _id: event._id },
            {
                $set: {
                    tenantId: mapping.tenantId,
                    branchId: mapping.branchId,
                    mappingId: mapping._id,
                    status: 'failed',
                    error: err.message,
                    processingAt: null,
                },
                $inc: { attempts: 1 },
            }
        );
        return { status: 'failed', externalLeadId: change.externalLeadId, error: err.message };
    }
};

const enqueueMetaChange = async (change, rawPayload) => {
    const idempotencyKey = `meta_lead_ads:${change.externalLeadId}`;
    let event;
    try {
        event = await InboundLeadEvent.create({
            provider: 'meta_lead_ads',
            idempotencyKey,
            externalLeadId: change.externalLeadId,
            externalPageId: change.externalPageId,
            externalFormId: change.externalFormId,
            rawPayload,
        });
    } catch (err) {
        if (err.code === 11000) {
            await InboundLeadEvent.updateOne(
                { idempotencyKey },
                { $inc: { duplicateDeliveries: 1 } }
            );
            return { status: 'duplicate', externalLeadId: change.externalLeadId };
        }
        throw err;
    }

    return { status: 'received', eventId: event._id, externalLeadId: change.externalLeadId };
};

const listInboundEvents = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { status, limit = 25 } = req.query;
    const filter = { tenantId, provider: 'meta_lead_ads' };
    if (status && status !== 'all') filter.status = status;

    const events = await InboundLeadEvent.find(filter)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 25, 100))
        .select('-rawPayload -normalizedPayload')
        .lean();

    ApiResponse.success(res, events, 'Inbound lead events fetched');
});

const replayInboundEvent = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const event = await InboundLeadEvent.findOne({ _id: req.params.id, tenantId, provider: 'meta_lead_ads' });
    if (!event) throw ApiError.notFound('Inbound lead event not found');
    if (!['failed', 'unmapped'].includes(event.status)) {
        throw ApiError.badRequest('Only failed or unmapped inbound lead events can be replayed');
    }

    event.status = 'received';
    event.error = '';
    event.processingAt = null;
    event.processedAt = null;
    await event.save();

    ApiResponse.success(res, { status: 'received', eventId: event._id }, 'Inbound lead event queued for replay');
});

const receiveMetaWebhook = asyncHandler(async (req, res) => {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const signature = verifyMetaSignature(rawBody, req.headers['x-hub-signature-256']);
    if (!signature.ok) throw ApiError.forbidden(signature.reason);

    const changes = extractLeadChanges(req.body);
    const results = [];
    for (const change of changes) {
        results.push(await enqueueMetaChange(change, req.body));
    }

    res.status(200).json({ success: true, received: changes.length, results });
});

module.exports = {
    startMetaOAuth,
    completeMetaOAuth,
    listConnections,
    saveConnection,
    createApiConnection,
    rotateApiConnectionKey,
    receiveInboundApiLead,
    listMappings,
    saveMapping,
    getWebhookConfig,
    testConnection,
    discoverPages,
    discoverForms,
    subscribePage,
    listInboundEvents,
    replayInboundEvent,
    verifyMetaWebhook,
    receiveMetaWebhook,
    processStoredMetaEvent,
    resolveActiveMetaMapping,
    hashApiKey,
    createApiKey,
    readInboundApiKey,
};
