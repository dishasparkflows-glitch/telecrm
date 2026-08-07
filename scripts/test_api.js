const http = require('http');

const BASE = 'http://127.0.0.1:8000';

function request(method, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('=== SparkCRM API Test Suite ===\n');

    // 1. Owner Login
    console.log('--- 1. Owner Login ---');
    const login = await request('POST', '/api/auth/owner-login', {
        email: 'raj.kalsariya1994@gmail.com',
        password: 'Owner@123'
    });
    console.log(`Status: ${login.status}`);
    console.log(`Success: ${login.body.success}`);
    const ownerToken = login.body?.data?.tokens?.accessToken;
    const ownerUser = login.body?.data?.user;
    console.log(`Owner: ${ownerUser?.name} (${ownerUser?.role})`);
    console.log(`Token: ${ownerToken ? ownerToken.slice(0, 30) + '...' : 'MISSING'}\n`);

    if (!ownerToken) { console.log('FATAL: No owner token'); return; }
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    // 2. Owner Dashboard
    console.log('--- 2. Owner Dashboard ---');
    const dash = await request('GET', '/api/owner/dashboard', null, ownerHeaders);
    console.log(`Status: ${dash.status}`);
    if (dash.body.data) {
        const d = dash.body.data;
        console.log(`Tenants: ${d.totalTenants}, Active: ${d.activeTenants}, Revenue: ${d.totalRevenue}`);
    }
    console.log();

    // 3. Owner Tenants List
    console.log('--- 3. Owner Tenants List ---');
    const tenants = await request('GET', '/api/owner/tenants', null, ownerHeaders);
    console.log(`Status: ${tenants.status}`);
    const tenantList = tenants.body?.data?.tenants || tenants.body?.data || [];
    console.log(`Tenants count: ${Array.isArray(tenantList) ? tenantList.length : 'N/A'}`);
    const firstTenant = Array.isArray(tenantList) ? tenantList[0] : null;
    if (firstTenant) console.log(`First: ${firstTenant.companyName} (${firstTenant._id})`);
    console.log();

    if (!firstTenant) { console.log('No tenants to test further'); return; }

    // 4. Tenant Detail
    console.log('--- 4. Tenant Detail ---');
    const detail = await request('GET', `/api/owner/tenants/${firstTenant._id}`, null, ownerHeaders);
    console.log(`Status: ${detail.status}`);
    if (detail.body.data) {
        const d = detail.body.data;
        console.log(`Users: ${d.userCount}, Leads: ${d.leadCount}, Calls: ${d.callCount}, Meetings: ${d.meetingCount}`);
    }
    console.log();

    // 5. Impersonate Tenant
    console.log('--- 5. Impersonate Tenant ---');
    const imp = await request('POST', `/api/owner/impersonate/${firstTenant._id}`, null, ownerHeaders);
    console.log(`Status: ${imp.status}`);
    const impToken = imp.body?.data?.token;
    console.log(`Impersonation token: ${impToken ? impToken.slice(0, 30) + '...' : 'MISSING'}`);
    console.log();

    if (!impToken) { console.log('FATAL: No impersonation token'); return; }
    const impHeaders = { Authorization: `Bearer ${impToken}`, 'x-branch-id': 'all' };

    // 6-14: Impersonation API tests
    const tests = [
        ['6. getMe (imp)', 'GET', '/api/auth/me'],
        ['7. Analytics (imp)', 'GET', '/api/analytics/dashboard'],
        ['8. Lead Stats (imp)', 'GET', '/api/leads/stats'],
        ['9. Leads List (imp)', 'GET', '/api/leads?page=1&limit=15'],
        ['10. Modules (imp)', 'GET', '/api/modules'],
        ['11. Branches (imp)', 'GET', '/api/branches'],
        ['12. Notifications (imp)', 'GET', '/api/notifications'],
        ['13. Calls (imp)', 'GET', '/api/calls?page=1&limit=15'],
        ['14. Meetings (imp)', 'GET', '/api/meetings'],
    ];

    const results = [
        ['1. Owner Login', login.status],
        ['2. Owner Dashboard', dash.status],
        ['3. Tenants List', tenants.status],
        ['4. Tenant Detail', detail.status],
        ['5. Impersonate', imp.status],
    ];

    for (const [name, method, path] of tests) {
        console.log(`--- ${name} ---`);
        const r = await request(method, path, null, impHeaders);
        console.log(`Status: ${r.status}`);
        if (r.body?.data && name.includes('getMe')) {
            const u = r.body.data.user || r.body.data;
            console.log(`User: ${u.name} (role: ${u.role}, imp: ${u.isImpersonating})`);
            console.log(`Modules: ${r.body.data.modules?.length || 0}, Branches: ${r.body.data.branches?.length || 0}`);
        }
        if (r.body?.data && name.includes('Analytics')) {
            const d = r.body.data;
            console.log(`Leads: ${d.leads?.total}, Calls: ${d.calls?.totalToday}, Team: ${d.team?.activeUsers}`);
        }
        if (r.body?.data && name.includes('Stats')) {
            console.log(`Total: ${r.body.data.totalLeads}, Stages: ${JSON.stringify(r.body.data.byStage)}`);
        }
        if (r.body?.data && name.includes('Leads List')) {
            const d = r.body.data;
            console.log(`Total: ${d.total || d.pagination?.total}, Returned: ${d.leads?.length || 0}`);
        }
        if (!r.body?.success && r.status !== 200) {
            console.log(`Error: ${r.body?.message || JSON.stringify(r.body).slice(0, 100)}`);
        }
        results.push([name, r.status]);
        console.log();
    }

    console.log('\n=== SUMMARY ===');
    results.forEach(([name, status]) => {
        const icon = status === 200 ? '✅' : status === 304 ? '⚠️ ' : `❌`;
        console.log(`  ${icon} [${status}] ${name}`);
    });
}

run().catch(e => console.error('Test error:', e.message));
