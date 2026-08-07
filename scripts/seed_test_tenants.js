/**
 * Direct MongoDB seed script — creates test tenants + superadmin users
 * for feature gating verification tests.
 *
 * Bypasses OTP requirement by writing directly to MongoDB (dev-only).
 *
 * Creates:
 *   - "Free Org"  (free plan)      → free-admin@testorg.com   / SparkCRM@123
 *   - "Pro Org"   (professional)   → pro-admin@testorg.com    / SparkCRM@123
 *   - "Basic Org" (basic)          → basic-admin@testorg.com  / SparkCRM@123
 *
 * Usage:
 *   node scripts/seed_test_tenants.js
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── Two separate DB connections (mirrors microservice DB isolation) ─────────────
const tenantConn = mongoose.createConnection(process.env.MONGO_URI_TENANTS);
const authConn   = mongoose.createConnection(process.env.MONGO_URI_AUTH);

// ── Models on tenant DB ────────────────────────────────────────────────────────
const Plan = tenantConn.model('Plan', new mongoose.Schema(
    { slug: String, name: String, features: [String], moduleKeys: [String] },
    { strict: false }
));
const Tenant = tenantConn.model('Tenant', new mongoose.Schema({
    companyName: String, slug: String, email: String, phone: String,
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    status: { type: String, default: 'trial' },
    trialStatus: { type: String, default: 'active' },
    trialStartedAt: Date, trialExpiresAt: Date,
    purchasedFeatures: [String], extraFeatures: [String], extraModuleKeys: [String],
}, { strict: false }));
const Role = tenantConn.model('Role', new mongoose.Schema(
    { tenantId: mongoose.Schema.Types.ObjectId, name: String, slug: String, isSystem: Boolean },
    { strict: false }
));
const Branch = tenantConn.model('Branch', new mongoose.Schema(
    { tenantId: mongoose.Schema.Types.ObjectId, name: String, isDefault: Boolean, isActive: Boolean },
    { strict: false }
));
const Module = tenantConn.model('Module', new mongoose.Schema({
    tenantId: mongoose.Schema.Types.ObjectId, key: String, parentKey: String,
    label: String, path: String, icon: String, section: String,
    order: Number, isActive: Boolean, requiredFeature: String,
}, { strict: false }));

// ── Models on auth DB ──────────────────────────────────────────────────────────
const User = authConn.model('User', new mongoose.Schema({
    tenantId: mongoose.Schema.Types.ObjectId, name: String, email: String,
    phone: String, password: String, role: String,
    roleId: mongoose.Schema.Types.ObjectId, branchId: mongoose.Schema.Types.ObjectId,
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: true },
    inviteAccepted: { type: Boolean, default: true },
}, { strict: false }));

// ── All modules seeded per tenant (filtering is done at query time) ────────────
const ALL_MODULES = [
    // MENU
    { key: 'dashboard',     section: 'MENU',     label: 'Dashboard',     path: '/dashboard',     icon: 'LayoutDashboard', order: 0, isActive: true },
    { key: 'leads',         section: 'MENU',     label: 'Leads',         path: '/leads',         icon: 'Users',           order: 1, isActive: true, requiredFeature: 'lead_management' },
    { key: 'calls',         section: 'MENU',     label: 'Calls',         path: '/calls',         icon: 'Phone',           order: 2, isActive: true, requiredFeature: 'calling_basic' },
    { key: 'whatsapp',      section: 'MENU',     label: 'WhatsApp',      path: '/whatsapp',      icon: 'MessageSquare',   order: 3, isActive: true, requiredFeature: 'whatsapp_session' },
    { key: 'automations',   section: 'MENU',     label: 'Automations',   path: '/automations',   icon: 'Zap',             order: 4, isActive: true, requiredFeature: 'automation_basic' },
    { key: 'analytics',     section: 'MENU',     label: 'Analytics',     path: '/analytics',     icon: 'BarChart2',       order: 5, isActive: true, requiredFeature: 'analytics_basic' },
    { key: 'forms',         section: 'MENU',     label: 'Forms',         path: '/forms',         icon: 'FileText',        order: 6, isActive: true, requiredFeature: 'smart_forms' },
    { key: 'meetings',      section: 'MENU',     label: 'Meetings',      path: '/meetings',      icon: 'Calendar',        order: 7, isActive: true, requiredFeature: 'meeting_scheduler' },
    { key: 'notifications', section: 'MENU',     label: 'Notifications', path: '/notifications', icon: 'Bell',            order: 8, isActive: true },
    // ADMIN
    { key: 'users',         section: 'ADMIN',    label: 'Users',         path: '/users',         icon: 'Users',           order: 0, isActive: true },
    { key: 'roles',         section: 'ADMIN',    label: 'Roles',         path: '/roles',         icon: 'Shield',          order: 1, isActive: true },
    { key: 'branches',      section: 'ADMIN',    label: 'Branches',      path: '/branches',      icon: 'Building2',       order: 2, isActive: true },
    { key: 'audit',         section: 'ADMIN',    label: 'Audit Log',     path: '/audit',         icon: 'Activity',        order: 3, isActive: true },
    // SETTINGS
    { key: 'settings',      section: 'SETTINGS', label: 'Settings',      path: '/settings',      icon: 'Settings',        order: 0, isActive: true },
    { key: 'billing',       section: 'SETTINGS', label: 'Billing',       path: '/billing',       icon: 'CreditCard',      order: 1, isActive: true },
    { key: 'integrations',  section: 'SETTINGS', label: 'Integrations',  path: '/integrations',  icon: 'Puzzle',          order: 2, isActive: true },
];

async function seedTenant({ companyName, email, planSlug, adminName, password }) {
    const plan = await Plan.findOne({ slug: planSlug });
    if (!plan) {
        console.error(`  ❌ Plan "${planSlug}" not found — does it exist in the DB? Skipping "${companyName}".`);
        return null;
    }

    const existing = await Tenant.findOne({ email });
    if (existing) {
        console.log(`  ⏭️  "${companyName}" (${email}) already exists — skipping`);
        return existing;
    }

    const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();

    const tenant = await Tenant.create({
        companyName, slug, email, phone: '+919876543210',
        planId: plan._id,
        status: 'trial', trialStatus: 'active',
        trialStartedAt: new Date(),
        trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        purchasedFeatures: [], extraFeatures: [], extraModuleKeys: [],
        settings: { timezone: 'Asia/Kolkata' },
        leadStages: [
            { name: 'New', slug: 'new', color: '#3b82f6', order: 0 },
            { name: 'Contacted', slug: 'contacted', color: '#8b5cf6', order: 1 },
            { name: 'Won', slug: 'won', color: '#22c55e', order: 4 },
            { name: 'Lost', slug: 'lost', color: '#ef4444', order: 5 },
        ],
    });

    const branch = await Branch.create({ tenantId: tenant._id, name: 'Main Branch', isDefault: true, isActive: true });
    const role   = await Role.create({ tenantId: tenant._id, name: 'Super Admin', slug: 'superadmin', isSystem: true, permissions: {} });
    await Module.insertMany(ALL_MODULES.map(m => ({ ...m, tenantId: tenant._id })));

    const hashedPw = await bcrypt.hash(password, 12);
    await User.create({
        tenantId: tenant._id, name: adminName, email: email.toLowerCase(),
        phone: '+919876543210', password: hashedPw,
        role: 'superadmin', roleId: role._id, branchId: branch._id,
        isActive: true, isEmailVerified: true, inviteAccepted: true,
    });

    console.log(`  ✅ "${companyName}" → plan: ${plan.name} | features: [${(plan.features || []).join(', ')}] | user: ${email}`);
    return tenant;
}

async function main() {
    console.log('\n🌱  Seeding Test Tenants for Feature Gating Tests\n');

    // Wait for both connections to be ready
    await Promise.all([
        new Promise(r => tenantConn.once('open', r)),
        new Promise(r => authConn.once('open', r)),
    ]);
    console.log('✅ MongoDB connected (auth + tenants DBs)\n');

    const TENANTS = [
        { companyName: 'Free Org',  email: 'free-admin@testorg.com',  planSlug: 'free',         adminName: 'Free Admin',  password: 'SparkCRM@123' },
        { companyName: 'Pro Org',   email: 'pro-admin@testorg.com',   planSlug: 'professional', adminName: 'Pro Admin',   password: 'SparkCRM@123' },
        { companyName: 'Basic Org', email: 'basic-admin@testorg.com', planSlug: 'basic',        adminName: 'Basic Admin', password: 'SparkCRM@123' },
    ];

    for (const t of TENANTS) {
        await seedTenant(t);
    }

    console.log('\n🎉  Done!\n');
    console.log('    Now run:  node scripts/test_feature_gating.js\n');
    await tenantConn.close();
    await authConn.close();
}

main().catch(e => {
    console.error('❌ Seed failed:', e.message, e.stack);
    process.exit(1);
});
