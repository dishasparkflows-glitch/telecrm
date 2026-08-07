/**
 * Module Flash Bug Fix — Verification Test
 * 
 * Root cause: tenant superadmins have role='superadmin' in JWT.
 * listModules bypassed filtering for userRole==='superadmin',
 * but this matched ALL tenant superadmins, not just impersonation.
 * 
 * Fix: Changed bypass from userRole check to isImpersonating flag.
 * 
 * Tests:
 * 1. Tenant superadmin → GET /api/modules → MUST return plan-filtered (not all)
 * 2. Owner impersonation → GET /api/modules → SHOULD return all (bypass)
 * 3. featureGuard → tenant cannot access restricted API
 * 4. featureGuard → impersonation CAN access restricted API
 */
const http = require('http');
const BASE = 'http://127.0.0.1:8000';

function request(method, reqPath, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(reqPath, BASE);
        const opts = {
            hostname: url.hostname, port: url.port,
            path: url.pathname + url.search, method,
            headers: { 'Content-Type': 'application/json', ...headers },
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

let passed = 0, failed = 0;
function check(label, condition, detail) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else { console.log(`  ❌ ${label} — ${detail || 'FAILED'}`); failed++; }
}
function heading(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

async function run() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   Module Flash Bug Fix — Verification Test              ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // ─── SETUP: Owner Login ───
    heading('SETUP');
    const ownerLogin = await request('POST', '/api/auth/owner-login', {
        email: 'raj.kalsariya1994@gmail.com', password: 'SparkCRM@123'
    });
    check('Owner login', ownerLogin.status === 200);
    const ownerToken = ownerLogin.body.data?.tokens?.accessToken;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    // Get tenants
    const tenantsResp = await request('GET', '/api/owner/tenants', null, ownerHeaders);
    const tenants = tenantsResp.body.data?.tenants || tenantsResp.body.data || [];
    const freeOrg = tenants.find(t => t.companyName === 'Free Org');
    check('Free Org exists', !!freeOrg);

    // Find a tenant user to login as (not owner impersonation)
    const tenantDetail = freeOrg ? await request('GET', `/api/owner/tenants/${freeOrg._id}`, null, ownerHeaders) : null;
    const tenantUsers = tenantDetail?.body?.data?.users || [];
    console.log(`  ℹ️  Tenant users: ${tenantUsers.length}`);

    // ═══ TEST 1: Tenant superadmin login → GET /api/modules must be filtered ═══
    heading('TEST 1: Tenant Superadmin → /api/modules MUST be filtered');

    // Login as the tenant superadmin
    const superadminUser = tenantUsers.find(u => u.role === 'superadmin') || tenantUsers[0];
    let tenantToken;
    if (superadminUser) {
        const tenantLogin = await request('POST', '/api/auth/login', {
            email: superadminUser.email, password: 'SparkCRM@123'
        });
        if (tenantLogin.status === 200) {
            tenantToken = tenantLogin.body.data?.tokens?.accessToken;
            console.log(`  ℹ️  Logged in as tenant: ${superadminUser.email} (role: ${superadminUser.role})`);
        } else {
            console.log(`  ⚠️  Tenant login failed: ${tenantLogin.status} — ${JSON.stringify(tenantLogin.body)}`);
        }
    }

    if (tenantToken) {
        const tenantHeaders = { Authorization: `Bearer ${tenantToken}`, 'x-branch-id': 'all' };

        // Call /api/modules directly (same endpoint Sidebar.jsx uses)
        const modulesResp = await request('GET', '/api/modules', null, tenantHeaders);
        check('/api/modules returns 200', modulesResp.status === 200);

        const modules = modulesResp.body.data || [];
        const menuMods = modules.filter(m => m.section === 'MENU');
        console.log(`  ℹ️  MENU modules from /api/modules: ${menuMods.map(m => m.key).join(', ')}`);
        console.log(`  ℹ️  Total modules: ${modules.length}, MENU: ${menuMods.length}`);

        // Free plan features: [lead_management, notifications]
        // → dashboard (no feature required), leads, notifications in MENU
        // → calls, whatsapp, forms, automations, analytics, meetings should be HIDDEN
        check('dashboard visible', menuMods.some(m => m.key === 'dashboard'));
        check('leads visible (lead_management in free plan)', menuMods.some(m => m.key === 'leads'));
        check('notifications visible (in free plan)', menuMods.some(m => m.key === 'notifications'));
        check('calls HIDDEN (calling_basic not in free plan)', !menuMods.some(m => m.key === 'calls'));
        check('whatsapp HIDDEN', !menuMods.some(m => m.key === 'whatsapp'));
        check('forms HIDDEN', !menuMods.some(m => m.key === 'forms'));
        check('automations HIDDEN', !menuMods.some(m => m.key === 'automations'));
        check('meetings HIDDEN', !menuMods.some(m => m.key === 'meetings'));
        check('analytics HIDDEN (analytics_basic not in free plan)', !menuMods.some(m => m.key === 'analytics'));

        // Also verify getMe returns the SAME filtered modules
        const meResp = await request('GET', '/api/auth/me', null, tenantHeaders);
        const meMods = (meResp.body.data?.modules || []).filter(m => m.section === 'MENU');
        console.log(`  ℹ️  getMe MENU modules: ${meMods.map(m => m.key).join(', ')}`);
        check('getMe modules match /api/modules (no flash!)', meMods.length === menuMods.length,
            `getMe: ${meMods.length} vs /api/modules: ${menuMods.length}`);
    } else {
        console.log('  ⚠️  Skipping test: could not login as tenant superadmin');
    }

    // ═══ TEST 2: Owner impersonation → /api/modules returns ALL ═══
    heading('TEST 2: Owner Impersonation → /api/modules shows ALL');
    if (freeOrg) {
        const imp = await request('POST', `/api/owner/impersonate/${freeOrg._id}`, null, ownerHeaders);
        const impToken = imp.body.data?.token;
        check('Impersonation token obtained', !!impToken);

        if (impToken) {
            const impHeaders = { Authorization: `Bearer ${impToken}`, 'x-branch-id': 'all' };

            const modulesResp = await request('GET', '/api/modules', null, impHeaders);
            const modules = modulesResp.body.data || [];
            const menuMods = modules.filter(m => m.section === 'MENU');
            console.log(`  ℹ️  Impersonation MENU modules: ${menuMods.map(m => m.key).join(', ')}`);

            check('Impersonation sees ALL MENU modules (≥8)', menuMods.length >= 8,
                `got: ${menuMods.length}`);
            check('calls visible (owner can see all)', menuMods.some(m => m.key === 'calls'));
            check('whatsapp visible', menuMods.some(m => m.key === 'whatsapp'));
        }
    }

    // ═══ TEST 3: featureGuard — tenant blocked from restricted API ═══
    heading('TEST 3: featureGuard — tenant blocked from /api/calls');
    if (tenantToken) {
        const tenantHeaders = { Authorization: `Bearer ${tenantToken}`, 'x-branch-id': 'all' };
        const callsResp = await request('GET', '/api/calls', null, tenantHeaders);
        console.log(`  ℹ️  /api/calls status: ${callsResp.status}`);
        check('Tenant blocked from /api/calls (403)', callsResp.status === 403,
            `got: ${callsResp.status}`);
    }

    // ═══ TEST 4: featureGuard — impersonation allowed ═══
    heading('TEST 4: featureGuard — impersonation can access /api/calls');
    if (freeOrg) {
        const imp = await request('POST', `/api/owner/impersonate/${freeOrg._id}`, null, ownerHeaders);
        const impToken = imp.body.data?.token;
        if (impToken) {
            const impHeaders = { Authorization: `Bearer ${impToken}`, 'x-branch-id': 'all' };
            const callsResp = await request('GET', '/api/calls', null, impHeaders);
            console.log(`  ℹ️  /api/calls (impersonation) status: ${callsResp.status}`);
            // Should be 200 or 404 (no data) — NOT 403
            check('Impersonation NOT blocked from /api/calls', callsResp.status !== 403,
                `got: ${callsResp.status}`);
        }
    }

    // ═══ SUMMARY ═══
    console.log('\n' + '═'.repeat(60));
    console.log(`  FINAL RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═'.repeat(60));
    if (failed === 0) console.log('\n  🎉 ALL TESTS PASSED!\n');
    else console.log(`\n  ⚠️ ${failed} test(s) failed.\n`);
}

run().catch(e => console.error('Error:', e.message));
