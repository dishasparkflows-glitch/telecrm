const axios = require('axios');
const crypto = require('crypto');
const { decrypt } = require('./leadSourceCrypto.service');

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

const getMetaAppId = () => process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
const getMetaAppSecret = () => process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
const getMetaOAuthRedirectUri = () => `${String(process.env.API_PUBLIC_URL || '').replace(/\/+$/, '')}/api/leads/oauth/meta/callback`;

const buildMetaOAuthUrl = ({ state }) => {
    const appId = getMetaAppId();
    const redirectUri = getMetaOAuthRedirectUri();
    if (!appId) throw new Error('META_APP_ID is not configured');
    if (!process.env.API_PUBLIC_URL) throw new Error('API_PUBLIC_URL is required for Meta OAuth');
    const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        state,
        response_type: 'code',
        scope: 'leads_retrieval,pages_show_list,pages_read_engagement,pages_manage_metadata',
    });
    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
};

const exchangeMetaOAuthCode = async ({ code }) => {
    const appId = getMetaAppId();
    const appSecret = getMetaAppSecret();
    const redirectUri = getMetaOAuthRedirectUri();
    if (!appId || !appSecret) throw new Error('Meta app credentials are not configured');

    const shortTokenResponse = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
        timeout: 15000,
    });
    const shortToken = shortTokenResponse.data?.access_token;
    if (!shortToken) throw new Error('Meta did not return an access token');

    const longTokenResponse = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`, {
        params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortToken,
        },
        timeout: 15000,
    });

    return {
        accessToken: longTokenResponse.data?.access_token || shortToken,
        expiresIn: Number(longTokenResponse.data?.expires_in || shortTokenResponse.data?.expires_in || 0),
    };
};

const fetchMetaIdentityWithToken = async (accessToken) => {
    const response = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/me`, {
        params: { access_token: accessToken, fields: 'id,name' },
        timeout: 10000,
    });
    return response.data;
};

const verifyMetaSignature = (rawBody, signatureHeader) => {
    const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
        return { ok: false, reason: 'META_APP_SECRET is not configured' };
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
        return { ok: false, reason: 'Missing x-hub-signature-256 header' };
    }

    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody || '').digest('hex')}`;
    const received = signatureHeader;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (expectedBuffer.length !== receivedBuffer.length) {
        return { ok: false, reason: 'Invalid signature length' };
    }

    return {
        ok: crypto.timingSafeEqual(expectedBuffer, receivedBuffer),
        reason: 'Invalid Meta webhook signature',
    };
};

const extractLeadChanges = (payload) => {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    const changes = [];

    for (const entry of entries) {
        for (const change of entry.changes || []) {
            if (change.field !== 'leadgen') continue;
            const value = change.value || {};
            changes.push({
                externalLeadId: String(value.leadgen_id || ''),
                externalPageId: String(value.page_id || entry.id || ''),
                externalFormId: String(value.form_id || ''),
                adId: String(value.ad_id || ''),
                createdTime: value.created_time ? new Date(value.created_time * 1000) : null,
                rawChange: change,
                rawEntry: entry,
            });
        }
    }

    return changes.filter((change) => change.externalLeadId);
};

const fieldDataToObject = (fieldData = []) => {
    const out = {};
    for (const field of fieldData || []) {
        const value = Array.isArray(field.values) ? field.values[0] : field.values;
        out[field.name] = value || '';
    }
    return out;
};

const splitName = (fullName = '') => {
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] || 'Unknown',
        lastName: parts.slice(1).join(' '),
    };
};

const isAffirmativeConsent = (value) => {
    if (value === true || value === 1) return true;
    return ['yes', 'true', '1', 'agreed', 'agree', 'accepted', 'opt_in', 'opted_in']
        .includes(String(value || '').trim().toLowerCase());
};

const normalizeMetaLead = ({ graphLead = {}, mapping, change }) => {
    const fields = fieldDataToObject(graphLead.field_data || []);
    const fieldMapping = mapping.fieldMapping || {};
    const fullName = fields[fieldMapping.fullName || 'full_name'] || fields.full_name || fields.name || '';
    const fallbackName = splitName(fullName);

    const firstName = fields[fieldMapping.firstName || 'first_name'] || fields.first_name || fallbackName.firstName;
    const lastName = fields[fieldMapping.lastName || 'last_name'] || fields.last_name || fallbackName.lastName;
    const email = fields[fieldMapping.email || 'email'] || fields.email || '';
    const phone = fields[fieldMapping.phone || 'phone_number'] || fields.phone_number || fields.phone || fields.mobile || '';
    const company = fields[fieldMapping.company || 'company_name'] || fields.company_name || fields.company || '';
    const consentField = fieldMapping.whatsappConsent || 'whatsapp_opt_in';
    const whatsappOptIn = isAffirmativeConsent(fields[consentField]);

    const createdAt = graphLead.created_time ? new Date(graphLead.created_time) : change.createdTime || new Date();

    return {
        leadData: {
            contact: {
                firstName: firstName || 'Unknown',
                lastName: lastName || '',
                email,
                phone,
                company,
            },
            source: mapping.source || 'facebook',
            sourceDetails: `${mapping.externalPageName || 'Meta Page'} / ${mapping.externalFormName || 'Lead Form'}`,
            customFields: fields,
        },
        origin: {
            provider: 'meta_lead_ads',
            sourceId: mapping.externalFormId,
            sourceName: mapping.externalFormName || '',
            rawSource: 'meta.leadgen',
        },
        touch: {
            adId: graphLead.ad_id || change.adId || '',
            adName: graphLead.ad_name || '',
            adSetId: graphLead.adset_id || '',
            adSetName: graphLead.adset_name || '',
            campaignId: graphLead.campaign_id || '',
            campaignName: graphLead.campaign_name || '',
            formId: mapping.externalFormId || change.externalFormId || '',
            formName: mapping.externalFormName || '',
            capturedAt: createdAt,
        },
        consent: {
            whatsappOptIn,
            whatsappOptInAt: whatsappOptIn ? createdAt : null,
            marketingOptIn: whatsappOptIn,
            source: whatsappOptIn ? `meta_form:${mapping.externalFormId}` : '',
        },
        rawFields: fields,
    };
};

const getConnectionToken = (connection) => {
    const token = decrypt(connection.accessToken);
    if (!token) throw new Error('Meta access token is not configured for this connection');
    return token;
};

const metaGraphGet = async ({ path, connection, params = {}, timeout = 15000 }) => {
    const token = getConnectionToken(connection);
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${path.replace(/^\//, '')}`;
    const response = await axios.get(url, {
        params: {
            ...params,
            access_token: token,
        },
        timeout,
    });
    return response.data;
};

const fetchMetaLead = async ({ externalLeadId, connection }) => metaGraphGet({
    path: externalLeadId,
    connection,
    params: {
        fields: 'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data',
    },
});

const testMetaConnection = async ({ connection }) => metaGraphGet({
    path: 'me',
    connection,
    params: { fields: 'id,name' },
    timeout: 10000,
});

const listMetaPages = async ({ connection }) => {
    const data = await metaGraphGet({
        path: 'me/accounts',
        connection,
        params: { fields: 'id,name,access_token,tasks,perms' },
    });

    return (data.data || []).map((page) => ({
        id: page.id,
        name: page.name,
        hasLeadAccess: [...(page.tasks || []), ...(page.perms || [])].some((permission) =>
            String(permission).toLowerCase().includes('lead') || String(permission).toLowerCase().includes('manage')
        ),
    }));
};

const listMetaLeadForms = async ({ connection, pageId }) => {
    if (!pageId) throw new Error('Meta page ID is required');
    const data = await metaGraphGet({
        path: `${pageId}/leadgen_forms`,
        connection,
        params: { fields: 'id,name,status,created_time,locale,questions' },
    });

    return (data.data || []).map((form) => ({
        id: form.id,
        name: form.name,
        status: form.status,
        createdTime: form.created_time,
        locale: form.locale,
        questions: form.questions || [],
    }));
};

const subscribeMetaPageToLeadgen = async ({ connection, pageId }) => {
    const userToken = getConnectionToken(connection);
    const pageTokenResponse = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}`, {
        params: { fields: 'id,name,access_token', access_token: userToken },
        timeout: 15000,
    });
    const pageToken = pageTokenResponse.data?.access_token;
    if (!pageToken) throw new Error('Meta did not return a page access token. Confirm pages_manage_metadata permission for this page.');

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/subscribed_apps`;
    const response = await axios.post(url, null, {
        params: {
            subscribed_fields: 'leadgen',
            access_token: pageToken,
        },
        timeout: 15000,
    });
    return { ...response.data, page: { id: pageTokenResponse.data.id, name: pageTokenResponse.data.name } };
};

module.exports = {
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
};
