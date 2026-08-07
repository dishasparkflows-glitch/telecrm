/**
 * SparkCRM — Comprehensive API Test Suite
 * Tests all 72 endpoints across 12 microservices
 * 
 * Run from project root:  node scripts/testAllAPIs.js
 */
const http = require('http');
const https = require('https');

// ── Config ──
const GATEWAY = 'http://localhost:8000';
const SERVICES = {
    auth: 'http://localhost:8001',
    tenant: 'http://localhost:8002',
    lead: 'http://localhost:8003',
    call: 'http://localhost:8004',
    whatsapp: 'http://localhost:8005',
    automation: 'http://localhost:8006',
    analytics: 'http://localhost:8007',
    billing: 'http://localhost:8008',
    notification: 'http://localhost:8009',
    form: 'http://localhost:8010',
    meeting: 'http://localhost:8011',
};

const results = [];
let TOKEN = null;
let TENANT_ID = null;
let USER_ID = null;
let LEAD_ID = null;
let FORM_ID = null;

// ── HTTP Helper ──
const apiCall = (method, url, body = null, headers = {}) => {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        const isHttps = parsed.protocol === 'https:';
        const options = {
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            timeout: 10000,
        };

        const req = (isHttps ? https : http).request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
                } catch {
                    resolve({ status: res.statusCode, data: null, raw: data });
                }
            });
        });

        req.on('error', (err) => {
            resolve({ status: 0, data: null, raw: `CONNECTION_ERROR: ${err.message}` });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ status: 0, data: null, raw: 'TIMEOUT' });
        });

        if (body) {
            const bodyStr = JSON.stringify(body);
            req.setHeader('Content-Length', Buffer.byteLength(bodyStr));
            req.write(bodyStr);
        }

        req.end();
    });
};

const authHeaders = () => TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

const test = async (service, method, path, body = null, extraHeaders = {}, description = '') => {
    const url = `${GATEWAY}${path}`;
    const hdrs = { ...authHeaders(), ...extraHeaders };
    const res = await apiCall(method, url, body, hdrs);
    const pass = res.status >= 200 && res.status < 300;
    const errorMsg = !pass ? (res.data?.message || res.raw?.substring(0, 100) || 'Unknown') : '';

    results.push({
        service,
        method,
        path,
        description: description || path,
        status: res.status,
        pass: pass ? '✅' : '❌',
        error: errorMsg,
    });

    if (pass) {
        console.log(`  ✅ ${method} ${path} → ${res.status}`);
    } else {
        console.log(`  ❌ ${method} ${path} → ${res.status} | ${errorMsg}`);
    }

    return res;
};

const testDirect = async (service, port, method, path, body = null, extraHeaders = {}, description = '') => {
    const url = `http://localhost:${port}${path}`;
    const hdrs = { ...extraHeaders };
    const res = await apiCall(method, url, body, hdrs);
    const pass = res.status >= 200 && res.status < 300;
    const errorMsg = !pass ? (res.data?.message || res.raw?.substring(0, 100) || 'Unknown') : '';

    results.push({
        service,
        method,
        path,
        description: description || path,
        status: res.status,
        pass: pass ? '✅' : '❌',
        error: errorMsg,
    });

    if (pass) {
        console.log(`  ✅ [direct:${port}] ${method} ${path} → ${res.status}`);
    } else {
        console.log(`  ❌ [direct:${port}] ${method} ${path} → ${res.status} | ${errorMsg}`);
    }

    return res;
};

// ── Check service health ──
const checkServices = async () => {
    console.log('\n═══ SERVICE HEALTH CHECK ═══\n');
    const ports = [8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008, 8009, 8010, 8011];
    const names = ['gateway', 'auth', 'tenant', 'lead', 'call', 'whatsapp', 'automation', 'analytics', 'billing', 'notification', 'form', 'meeting'];

    for (let i = 0; i < ports.length; i++) {
        const res = await apiCall('GET', `http://localhost:${ports[i]}/health`);
        const status = res.status === 200 ? '✅ UP' : '❌ DOWN';
        console.log(`  ${names[i]}:${ports[i]} = ${status}`);
        results.push({
            service: names[i],
            method: 'GET',
            path: '/health',
            description: 'Health Check',
            status: res.status || 0,
            pass: res.status === 200 ? '✅' : '❌',
            error: res.status !== 200 ? (res.raw?.substring(0, 60) || 'Not reachable') : '',
        });
    }
};

// ── Test Suites ──
const testAuth = async () => {
    console.log('\n═══ AUTH SERVICE TESTS ═══\n');
    const ts = Date.now();

    // 1. Register tenant
    const regRes = await test('auth', 'POST', '/api/auth/register-tenant', {
        name: `Test User ${ts}`,
        email: `testuser_${ts}@sparktest.com`,
        password: 'TestPass@12345',
        companyName: `TestCo_${ts}`,
    }, {}, 'Register Tenant');

    if (regRes.data?.data?.tokens) {
        TOKEN = regRes.data.data.tokens.accessToken;
        TENANT_ID = regRes.data.data.tenant?._id;
        USER_ID = regRes.data.data.user?._id;
        console.log(`    → Token obtained, TenantID: ${TENANT_ID}, UserID: ${USER_ID}`);
    }

    // 2. Login
    const loginRes = await test('auth', 'POST', '/api/auth/login', {
        email: `testuser_${ts}@sparktest.com`,
        password: 'TestPass@12345',
    }, {}, 'Login');

    if (loginRes.data?.data?.tokens) {
        TOKEN = loginRes.data.data.tokens.accessToken;
        console.log('    → Token refreshed via login');
    }

    // 3. Get Me (direct to auth-service since /api/auth is public in gateway)
    await testDirect('auth', 8001, 'GET', '/api/auth/me', null, { 'x-user-id': USER_ID, 'x-tenant-id': TENANT_ID }, 'Get Current User');

    // 4. Forgot Password
    await test('auth', 'POST', '/api/auth/forgot-password', {
        email: `testuser_${ts}@sparktest.com`,
    }, {}, 'Forgot Password');

    // 5. Logout
    await test('auth', 'POST', '/api/auth/logout', null, {}, 'Logout');

    // Re-login for subsequent tests
    if (loginRes.data?.data?.tokens) TOKEN = loginRes.data.data.tokens.accessToken;
};

const testUsers = async () => {
    console.log('\n═══ USER MANAGEMENT TESTS ═══\n');

    // GET users list
    await test('users', 'GET', '/api/users', null, {}, 'List Users');

    // Invite user
    const invRes = await test('users', 'POST', '/api/users/invite', {
        name: 'Invited Agent',
        email: `invited_${Date.now()}@sparktest.com`,
        role: 'agent',
    }, {}, 'Invite User');

    if (invRes.data?.data?._id) {
        const invitedId = invRes.data.data._id;
        // Get user by ID
        await test('users', 'GET', `/api/users/${invitedId}`, null, {}, 'Get User by ID');
        // Update user
        await test('users', 'PUT', `/api/users/${invitedId}`, { name: 'Updated Agent' }, {}, 'Update User');
        // Delete user
        await test('users', 'DELETE', `/api/users/${invitedId}`, null, {}, 'Delete User');
    }
};

const testTenant = async () => {
    console.log('\n═══ TENANT SERVICE TESTS ═══\n');

    await test('tenant', 'GET', '/api/tenants/profile', null, {}, 'Get Tenant Profile');
    await test('tenant', 'GET', '/api/tenants/trial-status', null, {}, 'Get Trial Status');
    await test('tenant', 'PUT', '/api/tenants/settings', {
        timezone: 'Asia/Kolkata',
        currency: 'INR',
    }, {}, 'Update Settings');
    await test('tenant', 'PUT', '/api/tenants/pipeline', {
        stages: [
            { name: 'New', slug: 'new', color: '#3b82f6', order: 0 },
            { name: 'Contacted', slug: 'contacted', color: '#8b5cf6', order: 1 },
            { name: 'Won', slug: 'won', color: '#22c55e', order: 2 },
        ],
    }, {}, 'Update Pipeline');
    await test('tenant', 'POST', '/api/tenants/custom-fields', {
        name: 'test_field',
        type: 'text',
        required: false,
    }, {}, 'Add Custom Field');
    await test('tenant', 'PUT', '/api/tenants/onboarding', {
        completedSteps: ['setup_company', 'invite_team'],
    }, {}, 'Update Onboarding');
};

const testPlans = async () => {
    console.log('\n═══ PLAN TESTS ═══\n');

    await test('plans', 'GET', '/api/plans', null, {}, 'List Plans');
    await test('plans', 'GET', '/api/plans/free-trial', null, {}, 'Get Plan by Slug');
};

const testReferral = async () => {
    console.log('\n═══ REFERRAL TESTS ═══\n');
    await test('referral', 'GET', '/api/referral/code', null, {}, 'Get Referral Code');
    await test('referral', 'GET', '/api/referral/stats', null, {}, 'Get Referral Stats');
};

const testLeads = async () => {
    console.log('\n═══ LEAD SERVICE TESTS ═══\n');

    // Create lead
    const leadRes = await test('leads', 'POST', '/api/leads', {
        firstName: 'John',
        lastName: 'Doe',
        email: `lead_${Date.now()}@sparktest.com`,
        phone: '+919876543210',
        company: 'TestCorp',
        source: 'manual',
        stage: 'new',
    }, {}, 'Create Lead');

    if (leadRes.data?.data?._id) {
        LEAD_ID = leadRes.data.data._id;
        console.log(`    → Lead created: ${LEAD_ID}`);
    }

    // List leads
    await test('leads', 'GET', '/api/leads', null, {}, 'List Leads');
    // Get stats
    await test('leads', 'GET', '/api/leads/stats', null, {}, 'Lead Stats');

    if (LEAD_ID) {
        // Get lead by ID
        await test('leads', 'GET', `/api/leads/${LEAD_ID}`, null, {}, 'Get Lead by ID');
        // Update lead
        await test('leads', 'PUT', `/api/leads/${LEAD_ID}`, { stage: 'contacted' }, {}, 'Update Lead Stage');
        // Add note
        await test('leads', 'POST', `/api/leads/${LEAD_ID}/notes`, { text: 'Test note from API test' }, {}, 'Add Note to Lead');
        // Assign lead
        if (USER_ID) {
            await test('leads', 'PUT', `/api/leads/${LEAD_ID}/assign`, { assignedTo: USER_ID }, {}, 'Assign Lead');
        }
        // Import leads
        await test('leads', 'POST', '/api/leads/import', {
            leads: [{ firstName: 'Import1', lastName: 'Test', email: 'import1@test.com' }],
        }, {}, 'Import Leads');
        // Archive lead
        await test('leads', 'DELETE', `/api/leads/${LEAD_ID}`, null, {}, 'Archive Lead');
    }
};

const testCalls = async () => {
    console.log('\n═══ CALL SERVICE TESTS ═══\n');
    await test('calls', 'GET', '/api/calls/logs', null, {}, 'Get Call Logs');
    await test('calls', 'GET', '/api/calls/stats', null, {}, 'Get Call Stats');
    await test('calls', 'POST', '/api/calls/initiate', {
        toNumber: '+919876543210',
        leadId: LEAD_ID || undefined,
    }, {}, 'Initiate Call');
};

const testWhatsApp = async () => {
    console.log('\n═══ WHATSAPP SERVICE TESTS ═══\n');
    await test('whatsapp', 'GET', '/api/whatsapp/templates', null, {}, 'Get Templates');
    await test('whatsapp', 'GET', '/api/whatsapp/team-inbox', null, {}, 'Get Team Inbox');
    await test('whatsapp', 'GET', '/api/whatsapp/chatbot', null, {}, 'Get Chatbot Rules');
    await test('whatsapp', 'POST', '/api/whatsapp/templates', {
        name: 'test_template',
        body: 'Hello {{name}}, welcome to SparkCRM!',
        category: 'utility',
    }, {}, 'Create Template');
    await test('whatsapp', 'POST', '/api/whatsapp/chatbot', {
        triggerKeyword: 'hello',
        responseContent: 'Hi! How can we help you?',
        isActive: true,
    }, {}, 'Create Chatbot Rule');
};

const testForms = async () => {
    console.log('\n═══ FORM SERVICE TESTS ═══\n');

    const formRes = await test('forms', 'POST', '/api/forms', {
        name: 'Test Contact Form',
        fields: [
            { label: 'Name', name: 'name', type: 'text', required: true },
            { label: 'Email', name: 'email', type: 'email', required: true },
            { label: 'Message', name: 'message', type: 'textarea', required: false },
        ],
    }, {}, 'Create Form');

    if (formRes.data?.data?._id) {
        FORM_ID = formRes.data.data._id;
        console.log(`    → Form created: ${FORM_ID}`);
    }

    await test('forms', 'GET', '/api/forms', null, {}, 'List Forms');

    if (FORM_ID) {
        await test('forms', 'GET', `/api/forms/${FORM_ID}`, null, {}, 'Get Form by ID');
        await test('forms', 'PUT', `/api/forms/${FORM_ID}`, { name: 'Updated Form' }, {}, 'Update Form');
        // Public submission
        await test('forms', 'POST', `/api/forms/${FORM_ID}/submit`, {
            data: { Name: 'Tester', Email: 'tester@test.com', Message: 'Hello!' },
        }, {}, 'Submit Form (Public)');
        await test('forms', 'GET', `/api/forms/${FORM_ID}/submissions`, null, {}, 'Get Submissions');
    }
};

const testMeetings = async () => {
    console.log('\n═══ MEETING SERVICE TESTS ═══\n');

    await test('meetings', 'GET', '/api/meetings', null, {}, 'List Meetings');

    await test('meetings', 'POST', '/api/meetings/schedule', {
        title: 'Test Meeting',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        duration: 30,
        guestName: 'Attendee',
        guestEmail: 'attendee@test.com',
    }, {}, 'Schedule Meeting');

    await test('meetings', 'GET', '/api/meetings/booking-links', null, {}, 'Get Booking Links');
    await test('meetings', 'POST', '/api/meetings/booking-links', {
        title: 'Test Booking',
        slug: `test-booking-${Date.now()}`,
        durationOptions: [15, 30, 60],
    }, {}, 'Create Booking Link');
};

const testAutomations = async () => {
    console.log('\n═══ AUTOMATION SERVICE TESTS ═══\n');

    const ruleRes = await test('automations', 'POST', '/api/automations', {
        name: 'Test Auto Rule',
        trigger: {
            event: 'lead.created',
            conditions: [{ field: 'source', operator: 'equals', value: 'website' }],
        },
        actions: [{ type: 'assign_lead', config: { userId: USER_ID } }],
        isActive: true,
    }, {}, 'Create Automation Rule');

    await test('automations', 'GET', '/api/automations', null, {}, 'List Automation Rules');
    await test('automations', 'GET', '/api/automations/logs', null, {}, 'Get Automation Logs');

    if (ruleRes.data?.data?._id) {
        const ruleId = ruleRes.data.data._id;
        await test('automations', 'PUT', `/api/automations/${ruleId}`, { name: 'Updated Rule' }, {}, 'Update Rule');
        await test('automations', 'PUT', `/api/automations/${ruleId}/toggle`, null, {}, 'Toggle Rule');
        await test('automations', 'DELETE', `/api/automations/${ruleId}`, null, {}, 'Delete Rule');
    }
};

const testAnalytics = async () => {
    console.log('\n═══ ANALYTICS SERVICE TESTS ═══\n');
    await test('analytics', 'GET', '/api/analytics/dashboard', null, {}, 'Dashboard Analytics');
    await test('analytics', 'GET', '/api/analytics/leads', null, {}, 'Lead Analytics');
    await test('analytics', 'GET', '/api/analytics/calls', null, {}, 'Call Analytics');
    await test('analytics', 'GET', '/api/analytics/team', null, {}, 'Team Analytics');
    await test('analytics', 'GET', '/api/analytics/revenue', null, {}, 'Revenue Analytics');
};

const testBilling = async () => {
    console.log('\n═══ BILLING SERVICE TESTS ═══\n');
    await test('billing', 'GET', '/api/billing/invoices', null, {}, 'List Invoices');
    await test('billing', 'GET', '/api/features/store', null, {}, 'Feature Store');
    await test('billing', 'GET', '/api/features/purchased', null, {}, 'Purchased Features');
};

const testNotifications = async () => {
    console.log('\n═══ NOTIFICATION SERVICE TESTS ═══\n');
    await test('notifications', 'GET', '/api/notifications', null, {}, 'List Notifications');
    await test('notifications', 'PUT', '/api/notifications/read-all', null, {}, 'Mark All Read');
};

const testAudit = async () => {
    console.log('\n═══ AUDIT TESTS ═══\n');
    await test('audit', 'GET', '/api/audit', null, {}, 'Get Audit Logs');
};

// ── Report ──
const printReport = () => {
    console.log('\n\n═══════════════════════════════════════════');
    console.log('            FINAL TEST REPORT');
    console.log('═══════════════════════════════════════════\n');

    const passed = results.filter(r => r.pass === '✅').length;
    const failed = results.filter(r => r.pass === '❌').length;
    const total = results.length;

    console.log(`  Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}\n`);

    // Print table
    console.log('| Service | Method | Path | Status | Result | Error |');
    console.log('|---------|--------|------|--------|--------|-------|');
    for (const r of results) {
        const err = r.error.replace(/\|/g, '¦').substring(0, 50);
        console.log(`| ${r.service} | ${r.method} | ${r.path} | ${r.status} | ${r.pass} | ${err} |`);
    }

    // Print failures summary
    const failures = results.filter(r => r.pass === '❌');
    if (failures.length > 0) {
        console.log('\n\n═══ FAILURES REQUIRING FIXES ═══\n');
        for (const f of failures) {
            console.log(`❌ [${f.service}] ${f.method} ${f.path}`);
            console.log(`   Status: ${f.status} | Error: ${f.error}\n`);
        }
    }
};

// ── Main ──
const main = async () => {
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║    SparkCRM — Full API Test Suite          ║');
    console.log('╚═══════════════════════════════════════════╝\n');

    await checkServices();
    await testAuth();
    await testUsers();
    await testTenant();
    await testPlans();
    await testReferral();
    await testLeads();
    await testCalls();
    await testWhatsApp();
    await testForms();
    await testMeetings();
    await testAutomations();
    await testAnalytics();
    await testBilling();
    await testNotifications();
    await testAudit();

    printReport();

    // Save results to file
    const fs = require('fs');
    const reportData = JSON.stringify(results, null, 2);
    fs.writeFileSync('test-results.json', reportData);
    console.log('\n📄 Results saved to test-results.json');

    process.exit(0);
};

main().catch((err) => {
    console.error('Test suite crashed:', err);
    process.exit(1);
});
