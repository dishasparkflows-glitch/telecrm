/**
 * Setup script: Creates test tenants for feature gating verification.
 *
 * Creates:
 *   - "Free Org"  → free plan
 *   - "Pro Org"   → professional plan
 *
 * Run once before running test_feature_gating.js
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

async function main() {
    console.log('\n🔧  Feature Gating Test Setup\n');

    // ── List existing tenants (owner login first) ──────────────────────────────
    const ownerLogin = await request('POST', '/api/auth/owner-login', {
        email: 'raj.kalsariya1994@gmail.com', password: 'SparkCRM@123'
    });
    if (ownerLogin.status !== 200) {
        console.error('❌ Owner login failed:', ownerLogin.status, JSON.stringify(ownerLogin.body));
        process.exit(1);
    }
    const ownerToken = ownerLogin.body.data?.tokens?.accessToken;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    console.log('✅ Owner logged in');

    const tenantsResp = await request('GET', '/api/owner/tenants', null, ownerHeaders);
    const tenants = tenantsResp.body.data?.tenants || tenantsResp.body.data || [];
    console.log(`ℹ️  Existing tenants: ${tenants.map(t => t.companyName).join(', ') || 'none'}`);

    // ── Register test tenants ──────────────────────────────────────────────────
    const toCreate = [
        { companyName: 'Free Org',  name: 'Free Admin',  email: 'free-admin@testorg.com',  planSlug: 'free',         password: 'SparkCRM@123' },
        { companyName: 'Pro Org',   name: 'Pro Admin',   email: 'pro-admin@testorg.com',   planSlug: 'professional', password: 'SparkCRM@123' },
        { companyName: 'Basic Org', name: 'Basic Admin', email: 'basic-admin@testorg.com', planSlug: 'basic',        password: 'SparkCRM@123' },
    ];

    for (const t of toCreate) {
        const existing = tenants.find(x => x.companyName === t.companyName);
        if (existing) {
            console.log(`⏭️  "${t.companyName}" already exists — skipping`);
            continue;
        }

        const res = await request('POST', '/api/auth/register-tenant', t);
        if (res.status === 201 || res.status === 200) {
            const planName = res.body.data?.plan?.name || t.planSlug;
            console.log(`✅ Created "${t.companyName}" (${t.email}) → plan: ${planName}`);
        } else {
            console.error(`❌ Failed to create "${t.companyName}": ${res.status}`, JSON.stringify(res.body).slice(0, 200));
        }
    }

    console.log('\n🎉  Setup complete. Now run: node scripts/test_feature_gating.js\n');
}

main().catch(e => console.error('Error:', e.message));
