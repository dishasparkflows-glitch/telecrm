#!/usr/bin/env node
/**
 * SparkCRM — Master Demo Data Seed Script
 * ─────────────────────────────────────────
 * Seeds 3 tenants with branches, roles, users, and full module data.
 * Uses raw MongoDB collections to avoid schema import issues.
 *
 * Usage:  node scripts/seedDemoData.js
 *         node scripts/seedDemoData.js --clean   (wipe all demo data first)
 */

const path = require('path');
const fs = require('fs');

// ── Load .env ──
const findEnv = () => {
    let d = __dirname;
    for (let i = 0; i < 5; i++) {
        const p = path.join(d, '.env');
        if (fs.existsSync(p)) return p;
        d = path.dirname(d);
    }
};
require('dotenv').config({ path: findEnv() });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── Mongo URIs ──
const MONGO = {
    AUTH: process.env.MONGO_URI_AUTH || 'mongodb://localhost:27017/sparkcrm_auth',
    TENANT: process.env.MONGO_URI_TENANTS || 'mongodb://localhost:27017/sparkcrm_tenants',
    LEAD: process.env.MONGO_URI_LEADS || 'mongodb://localhost:27017/sparkcrm_leads',
    CALL: process.env.MONGO_URI_CALLS || 'mongodb://localhost:27017/sparkcrm_calls',
    WHATSAPP: process.env.MONGO_URI_WHATSAPP || 'mongodb://localhost:27017/sparkcrm_whatsapp',
    AUTOMATION: process.env.MONGO_URI_AUTOMATIONS || 'mongodb://localhost:27017/sparkcrm_automations',
    BILLING: process.env.MONGO_URI_BILLING || 'mongodb://localhost:27017/sparkcrm_billing',
    NOTIFICATION: process.env.MONGO_URI_NOTIFICATIONS || 'mongodb://localhost:27017/sparkcrm_notifications',
    FORM: process.env.MONGO_URI_FORMS || 'mongodb://localhost:27017/sparkcrm_forms',
    MEETING: process.env.MONGO_URI_MEETINGS || 'mongodb://localhost:27017/sparkcrm_meetings',
};

// ────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randPhone = () => `+91${randInt(70000, 99999)}${randInt(10000, 99999)}`;
const pastDate = (daysBack) => new Date(Date.now() - randInt(1, daysBack) * 86400000);
const futureDate = (daysAhead) => new Date(Date.now() + randInt(1, daysAhead) * 86400000);
const oid = () => new mongoose.Types.ObjectId();

const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Dhruv', 'Kabir', 'Ritvik', 'Aarush', 'Kian', 'Ananya', 'Diya', 'Aanya', 'Aadhya', 'Aaradhya', 'Myra', 'Sara', 'Ira', 'Ahana', 'Kiara', 'Priya', 'Neha', 'Riya', 'Kavya', 'Meera', 'Nisha', 'Pooja', 'Shreya', 'Tanvi', 'Zara'];
const LAST_NAMES = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Reddy', 'Joshi', 'Mehta', 'Shah', 'Verma', 'Gupta', 'Nair', 'Iyer', 'Rao', 'Chauhan', 'Malhotra', 'Deshmukh', 'Thakur', 'Chopra', 'Bhat', 'Kapoor'];
const COMPANIES = ['TechVista Solutions', 'Pinnacle Corp', 'Zenith Innovations', 'Nexus Digital', 'Spark Dynamics', 'CloudNine Systems', 'QuantumLeap AI', 'DataBridge Analytics', 'CyberShield Security', 'MobiStack Apps', 'Infra Solutions Ltd', 'GreenTech Renewables', 'UrbanSpace Realty', 'MedConnect Health', 'EduPrime Learning', 'FoodChain Express', 'LogiTrack Systems', 'FinPulse Capital', 'AgriSmart Tech', 'RetailHub India'];

// ────────────────────────────────────────────────
//  CONFIG
// ────────────────────────────────────────────────
const TENANTS = [
    { companyName: 'Alpha Solutions Pvt Ltd', slug: 'alpha-solutions', email: 'admin@alpha.com', phone: '+919876543210', website: 'https://alpha-solutions.com' },
    { companyName: 'Beta Technologies Inc', slug: 'beta-technologies', email: 'admin@beta.com', phone: '+919876543211', website: 'https://beta-tech.com' },
    { companyName: 'Gamma Industries Ltd', slug: 'gamma-industries', email: 'admin@gamma.com', phone: '+919876543212', website: 'https://gamma-ind.com' },
];

const BRANCHES = [
    { name: 'Mumbai Head Office', code: 'MUM', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
    { name: 'Delhi Branch', code: 'DEL', city: 'New Delhi', state: 'Delhi', pincode: '110001' },
    { name: 'Bangalore Branch', code: 'BLR', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
    { name: 'Pune Branch', code: 'PUN', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    { name: 'Hyderabad Branch', code: 'HYD', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
    { name: 'Chennai Branch', code: 'CHN', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
];

const ROLES_DEF = [
    { name: 'Super Admin', slug: 'super-admin', isSystem: true, isDefault: false, desc: 'Full system access', all: true },
    { name: 'Branch Manager', slug: 'branch-manager', desc: 'Manages branch operations', modules: { leads: 'all', calls: 'all', whatsapp: 'all', meetings: 'all', forms: 'all', automations: 'vc', analytics: 'v', settings: 'vc', users: 'vc' } },
    { name: 'Sales Lead', slug: 'sales-lead', desc: 'Senior sales with team oversight', modules: { leads: 'all', calls: 'all', whatsapp: 'vce', meetings: 'all', forms: 'v', analytics: 'v' } },
    { name: 'Senior Agent', slug: 'senior-agent', desc: 'Experienced sales agent', modules: { leads: 'vce', calls: 'vce', whatsapp: 'vce', meetings: 'vce', forms: 'v' } },
    { name: 'Junior Agent', slug: 'junior-agent', isDefault: true, desc: 'Entry-level sales agent', modules: { leads: 'vc', calls: 'vc', whatsapp: 'v', meetings: 'vc' } },
    { name: 'Support Agent', slug: 'support-agent', desc: 'Customer support representative', modules: { leads: 'v', calls: 'vc', whatsapp: 'vce', meetings: 'v' } },
];

const MODULE_KEYS = ['leads', 'calls', 'whatsapp', 'meetings', 'forms', 'automations', 'analytics', 'settings', 'users', 'billing', 'notifications'];

function buildPermissions(roleDef) {
    if (roleDef.all) return MODULE_KEYS.map(mk => ({ moduleKey: mk, actions: { view: true, create: true, edit: true, delete: true, export: true, upload: true } }));
    const mods = roleDef.modules || {};
    return MODULE_KEYS.map(mk => {
        const f = mods[mk] || '';
        return { moduleKey: mk, actions: { view: f.includes('v') || f === 'all', create: f.includes('c') || f === 'all', edit: f.includes('e') || f === 'all', delete: f.includes('d') || f === 'all', export: f.includes('x') || f === 'all', upload: f.includes('u') || f === 'all' } };
    });
}

const PLANS = [
    { name: 'Starter', slug: 'starter', price: 999, yearlyPrice: 9990, perUserPrice: 199, description: 'Perfect for small teams', features: ['lead_management', 'call_basic', 'meeting_scheduler', 'smart_forms', 'analytics_basic'], limits: { maxUsers: 5, maxLeadsPerMonth: 500, maxCallsPerDay: 50, maxWhatsappMessagesPerDay: 0, storageGB: 2 }, sortOrder: 1, isActive: true },
    { name: 'Growth', slug: 'growth', price: 2499, yearlyPrice: 24990, perUserPrice: 399, description: 'For growing sales teams', features: ['lead_management', 'call_basic', 'call_recording', 'whatsapp_basic', 'meeting_scheduler', 'smart_forms', 'automation_basic', 'analytics_basic', 'analytics_advanced'], limits: { maxUsers: 15, maxLeadsPerMonth: 2000, maxCallsPerDay: 200, maxWhatsappMessagesPerDay: 500, storageGB: 10 }, sortOrder: 2, isActive: true },
    { name: 'Professional', slug: 'professional', price: 4999, yearlyPrice: 49990, perUserPrice: 599, description: 'Advanced features for pros', features: ['lead_management', 'call_basic', 'call_recording', 'whatsapp_basic', 'whatsapp_chatbot', 'meeting_scheduler', 'smart_forms', 'automation_basic', 'automation_advanced', 'analytics_basic', 'analytics_advanced', 'audit_logs'], limits: { maxUsers: 50, maxLeadsPerMonth: 10000, maxCallsPerDay: 500, maxWhatsappMessagesPerDay: 2000, storageGB: 50 }, sortOrder: 3, isActive: true },
    { name: 'Enterprise', slug: 'enterprise', price: 9999, yearlyPrice: 99990, perUserPrice: 799, description: 'Unlimited power', features: ['lead_management', 'call_basic', 'call_recording', 'whatsapp_basic', 'whatsapp_chatbot', 'meeting_scheduler', 'smart_forms', 'automation_basic', 'automation_advanced', 'analytics_basic', 'analytics_advanced', 'audit_logs', 'api_access', 'custom_branding', 'dedicated_support'], limits: { maxUsers: 500, maxLeadsPerMonth: 100000, maxCallsPerDay: 5000, maxWhatsappMessagesPerDay: 10000, storageGB: 500 }, sortOrder: 4, isActive: true },
];

// ────────────────────────────────────────────────
//  DATA GENERATORS (return plain objects with _id)
// ────────────────────────────────────────────────
const LEAD_SOURCES = ['manual', 'website', 'facebook', 'whatsapp', 'csv', 'api', 'smart_form', 'referral'];
const STAGES = ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow'];
const STATES = ['Maharashtra', 'Delhi', 'Karnataka', 'Maharashtra', 'Telangana', 'Tamil Nadu', 'West Bengal', 'Gujarat', 'Rajasthan', 'Uttar Pradesh'];
const TAGS = ['hot-lead', 'follow-up', 'enterprise', 'sme', 'referral', 'website-lead', 'demo-requested', 'price-quoted', 'callback', 'high-value'];
const DESIGNATIONS = ['CEO', 'CTO', 'VP Sales', 'Director', 'Manager', 'Team Lead', 'Executive', 'Analyst', 'Developer', 'Consultant'];

function genLeads(tid, bid, users, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid, firstName: fn, lastName: ln,
            email: `${fn.toLowerCase()}.${ln.toLowerCase()}${randInt(1, 999)}@${pick(['gmail.com', 'outlook.com', 'yahoo.com', 'company.co.in'])}`,
            phone: randPhone(), company: pick(COMPANIES), designation: pick(DESIGNATIONS),
            stage: pick(STAGES), source: pick(LEAD_SOURCES), priority: pick(PRIORITIES),
            expectedValue: randInt(10000, 500000), score: randInt(10, 95),
            scoreBreakdown: { profileCompleteness: randInt(5, 25), engagement: randInt(5, 25), responseRate: randInt(5, 25), dealValue: randInt(0, 15), recency: randInt(0, 10) },
            assignedTo: pick(users)._id, assignedAt: pastDate(30),
            tags: [pick(TAGS), pick(TAGS)].filter((v, i, a) => a.indexOf(v) === i),
            address: { city: pick(CITIES), state: pick(STATES), country: 'India', pincode: String(randInt(100000, 999999)) },
            lastActivityAt: pastDate(15), lastContactedAt: Math.random() > 0.3 ? pastDate(10) : null,
            followUpAt: Math.random() > 0.5 ? futureDate(14) : null,
            notes: Math.random() > 0.6 ? [{ text: pick(['Interested in premium plan', 'Requested demo', 'Will decide next week', 'Budget approved', 'Need proposal']), createdBy: pick(users)._id, createdAt: pastDate(10) }] : [],
            customFields: {}, isArchived: false, createdAt: pastDate(60), updatedAt: pastDate(5)
        });
    }
    return arr;
}

const CALL_STATUSES = ['completed', 'missed', 'failed', 'completed', 'completed', 'completed'];
const CALL_DISPS = ['interested', 'not_interested', 'callback', 'no_answer', 'wrong_number', 'do_not_call'];

function genCalls(tid, bid, users, leads, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        const caller = pick(users), lead = pick(leads), status = pick(CALL_STATUSES);
        const dur = status === 'completed' ? randInt(30, 600) : 0;
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid, leadId: lead._id, callerId: caller._id, callerName: caller.name,
            fromNumber: randPhone(), toNumber: lead.phone || randPhone(),
            direction: Math.random() > 0.2 ? 'outbound' : 'inbound', status,
            disposition: status === 'completed' ? pick(CALL_DISPS) : null, duration: dur,
            notes: status === 'completed' ? pick(['Good conversation', 'Will follow up', 'Not interested', 'Asked for proposal', 'Meeting scheduled']) : '',
            callbackAt: status === 'completed' && Math.random() > 0.6 ? futureDate(7) : null,
            provider: 'exotel', externalCallId: `EXO-${Date.now()}-${randInt(1000, 9999)}`,
            providerData: {}, startedAt: pastDate(30), endedAt: dur > 0 ? new Date(Date.now() - randInt(1, 30) * 86400000 + dur * 1000) : null,
            createdAt: pastDate(30), updatedAt: pastDate(5)
        });
    }
    return arr;
}

function genWaMessages(tid, bid, users, leads, n) {
    const arr = [], types = ['text', 'text', 'text', 'text', 'image', 'document', 'template'];
    const contents = ['Hi, following up on our conversation.', 'Thank you for your interest!', 'Can we schedule a call?', 'Please find the attached brochure.', 'Our team will get back to you.', 'Would you like a demo?', 'Here is the price quote.', 'Happy to help!', 'Your inquiry has been received.', 'Thank you for choosing us!'];
    for (let i = 0; i < n; i++) {
        const user = pick(users), lead = pick(leads), dir = Math.random() > 0.4 ? 'outbound' : 'inbound';
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid, leadId: lead._id, userId: user._id,
            direction: dir, from: dir === 'outbound' ? '+919876500001' : (lead.phone || randPhone()),
            to: dir === 'outbound' ? (lead.phone || randPhone()) : '+919876500001',
            type: pick(types), content: pick(contents),
            status: dir === 'outbound' ? pick(['sent', 'delivered', 'read']) : 'received',
            waMessageId: null, isRead: Math.random() > 0.3, readAt: null,
            createdAt: pastDate(30), updatedAt: pastDate(5)
        });
    }
    return arr;
}

function genTemplates(tid, bid, n) {
    const categories = ['marketing', 'utility', 'authentication'];
    const names = ['Welcome Message', 'Follow Up', 'Meeting Reminder', 'Price Quote', 'Feedback Request', 'Order Confirmation', 'Shipping Update', 'Payment Reminder', 'New Offer', 'Appointment Booking', 'Account Verification', 'Password Reset', 'OTP Verify', 'Lead Nurture 1', 'Lead Nurture 2', 'Onboarding 1', 'Onboarding 2', 'Re-engagement', 'Loyalty Reward', 'Festive Greeting', 'Product Launch', 'Service Update', 'Maintenance Notice', 'Survey Request', 'Referral Program'];
    const arr = [];
    for (let i = 0; i < Math.min(n, names.length); i++) {
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid,
            name: `${names[i]}_${bid.toString().slice(-4)}`, language: 'en', category: pick(categories),
            body: `Hello {{1}}, ${names[i].toLowerCase()} — demo template. {{2}}`,
            headerType: pick(['none', 'text', 'none']), headerContent: '', footer: 'Powered by SparkCRM',
            buttons: [], variables: ['name', 'details'], waTemplateId: null,
            status: pick(['draft', 'approved', 'approved', 'approved', 'pending']), isActive: true,
            createdAt: pastDate(60), updatedAt: pastDate(5)
        });
    }
    return arr;
}

function genChatbotRules(tid, bid) {
    const rules = [
        { kw: 'hi', m: 'exact', r: 'Hello! 👋 Welcome! How can I help?\n1. Product Info\n2. Pricing\n3. Support\n4. Talk to Agent' },
        { kw: 'price', m: 'contains', r: 'Plans start at ₹999/month. Visit our pricing page for details.' },
        { kw: 'demo', m: 'contains', r: 'We would love to show you a demo! Share your preferred date & time.' },
        { kw: 'support', m: 'contains', r: 'Support is available Mon-Fri 9AM-6PM IST. Describe your issue.' },
        { kw: 'thank', m: 'contains', r: 'You are welcome! 😊 Anything else I can help with?' },
        { kw: 'bye', m: 'exact', r: 'Goodbye! Have a great day! 👋' },
        { kw: 'help', m: 'exact', r: 'I can help with:\n1. Product info\n2. Pricing\n3. Demo\n4. Support\n5. Live agent' },
        { kw: 'agent', m: 'contains', r: 'Connecting you to a live agent. Please wait... 🔄' },
    ];
    return rules.map((r, i) => ({
        _id: oid(), tenantId: tid, branchId: bid, triggerKeyword: r.kw, matchType: r.m,
        responseType: 'text', responseContent: r.r, templateName: null, isActive: true, priority: rules.length - i,
        createdAt: pastDate(30), updatedAt: pastDate(5)
    }));
}

function genForms(tid, bid, users, n) {
    const names = ['Contact Us', 'Request Demo', 'Get Quote', 'Newsletter', 'Feedback', 'Event Registration', 'Job Application', 'Product Inquiry', 'Partner App', 'Support Ticket', 'Free Trial', 'Consultation', 'Warranty', 'Complaint', 'Suggestion Box', 'Vendor Registration', 'Customer Survey', 'Referral Form', 'Callback Request', 'Lead Capture', 'Webinar', 'White Paper', 'Case Study', 'ROI Calculator', 'Feature Request'];
    const arr = [];
    for (let i = 0; i < Math.min(n, names.length * 2); i++) {
        const fname = names[i % names.length];
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid,
            name: `${fname} - ${bid.toString().slice(-4)}-${i}`, description: `Demo ${fname.toLowerCase()}`,
            fields: [
                { label: 'Full Name', name: 'fullName', type: 'text', placeholder: '', required: true, options: [], order: 0 },
                { label: 'Email', name: 'email', type: 'email', placeholder: '', required: true, options: [], order: 1 },
                { label: 'Phone', name: 'phone', type: 'phone', placeholder: '', required: false, options: [], order: 2 },
                { label: 'Company', name: 'company', type: 'text', placeholder: '', required: false, options: [], order: 3 },
                { label: 'Message', name: 'message', type: 'textarea', placeholder: '', required: false, options: [], order: 4 },
            ],
            settings: { submitButtonText: 'Submit', successMessage: 'Thank you!', redirectUrl: '', notifyEmails: [pick(users).email], assignTo: pick(users)._id, leadSource: 'smart_form', autoTag: [] },
            styling: { theme: pick(['light', 'dark', 'minimal', 'branded']), primaryColor: pick(['#6366f1', '#3b82f6', '#22c55e', '#f59e0b']), fontFamily: 'Inter' },
            embedCode: '', isActive: true, submissionCount: randInt(0, 200),
            createdAt: pastDate(45), updatedAt: pastDate(5)
        });
    }
    return arr;
}

function genMeetings(tid, bid, users, leads, n) {
    const titles = ['Product Demo', 'Follow-Up Call', 'Pricing Discussion', 'Onboarding', 'Quarterly Review', 'Strategy Meeting', 'Client Kick-off', 'Technical Discussion', 'Contract Negotiation', 'Team Sync'];
    const arr = [];
    for (let i = 0; i < n; i++) {
        const host = pick(users), lead = pick(leads), isPast = Math.random() > 0.4;
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid, hostId: host._id, hostName: host.name,
            leadId: lead._id, title: `${pick(titles)} #${i + 1}`,
            description: '', guestName: `${lead.firstName} ${lead.lastName}`, guestEmail: lead.email, guestPhone: lead.phone,
            scheduledAt: isPast ? pastDate(30) : futureDate(30), duration: pick([15, 30, 45, 60]),
            attendees: [{ userId: host._id, name: host.name, email: host.email, role: 'host', status: 'accepted' }],
            meetingUrl: Math.random() > 0.3 ? `https://meet.google.com/${randInt(100, 999)}-${randInt(100, 999)}-${randInt(100, 999)}` : '',
            comments: [], attachments: [], customFields: {},
            location: pick(['video', 'phone', '']), meetingLink: '',
            status: isPast ? pick(['completed', 'completed', 'cancelled', 'no_show']) : 'scheduled',
            notes: Math.random() > 0.5 ? pick(['Discuss pricing', 'Present roadmap', 'Contract review', 'Technical Q&A']) : '',
            reminderSent: false, createdAt: pastDate(45), updatedAt: pastDate(5)
        });
    }
    return arr;
}

function genBookingLinks(tid, bid, users, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        const user = pick(users);
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid, userId: user._id,
            slug: `book-${bid.toString().slice(-4)}-${user.name.toLowerCase().replace(/\s+/g, '-')}-${i}`,
            title: `Book with ${user.name}`, description: `Schedule a meeting with ${user.name}`,
            durationOptions: [15, 30, 60],
            availability: { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], startTime: '09:00', endTime: '18:00', timezone: 'Asia/Kolkata' },
            isActive: true, createdAt: pastDate(30), updatedAt: pastDate(5)
        });
    }
    return arr;
}

const TRIGGER_EVENTS = ['lead.created', 'lead.stage_changed', 'lead.assigned', 'form.submitted', 'meeting.scheduled'];
const ACTION_TYPES = ['assign_lead', 'send_email', 'send_whatsapp', 'change_stage', 'add_tag', 'create_task', 'send_notification'];

function genAutoRules(tid, bid, users, n) {
    const names = ['Auto-assign website leads', 'Welcome email', 'Notify manager hot lead', 'Change stage after demo', 'Tag high-value leads', 'Follow-up reminder', 'Send WA on form submit', 'Auto-create task', 'Escalate stale leads', 'Monthly report', 'Lead nurture', 'Score routing', 'Auto-tag referrals', 'Notify deal won', 'Re-engagement', 'Birthday greeting', 'Follow-up missed call', 'Post-meeting summary', 'Lead qualification', 'Callback reminder', 'Onboarding auto', 'Feedback after close', 'Survey on won deal', 'Cross-sell auto', 'Compliance check'];
    const arr = [];
    for (let i = 0; i < Math.min(n, names.length * 2); i++) {
        const event = pick(TRIGGER_EVENTS);
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid,
            name: `${names[i % names.length]} #${Math.floor(i / names.length) + 1}`,
            description: `Rule for ${event.replace('.', ' ')}`, isActive: Math.random() > 0.2,
            trigger: { event, conditions: [{ field: pick(['source', 'stage', 'score', 'priority']), operator: pick(['equals', 'contains', 'greater_than']), value: pick(['website', 'new', '50', 'high']) }] },
            actions: [{ type: pick(ACTION_TYPES), config: { target: pick(users)._id.toString() }, delay: pick([0, 0, 0, 5, 15, 30]) }],
            executionCount: randInt(0, 200), lastExecutedAt: Math.random() > 0.3 ? pastDate(10) : null,
            createdBy: pick(users)._id, createdAt: pastDate(45), updatedAt: pastDate(5)
        });
    }
    return arr;
}

function genAutoLogs(tid, bid, rules, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        const rule = pick(rules);
        arr.push({
            _id: oid(), tenantId: tid, branchId: bid, ruleId: rule._id, ruleName: rule.name,
            triggerEvent: rule.trigger.event, triggerData: { leadId: oid().toString(), source: 'website' },
            actionsExecuted: [{ type: rule.actions[0].type, status: pick(['success', 'success', 'success', 'failed']), result: { message: 'Executed' }, executedAt: pastDate(10) }],
            status: pick(['success', 'success', 'success', 'partial', 'failed']),
            createdAt: pastDate(30), updatedAt: pastDate(5)
        });
    }
    return arr;
}

function genInvoices(tid, plan, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        const monthsBack = n - i;
        const periodStart = new Date(Date.now() - monthsBack * 30 * 86400000);
        const periodEnd = new Date(periodStart.getTime() + 30 * 86400000);
        const subtotal = plan.price, tax = Math.round(subtotal * 0.18);
        arr.push({
            _id: oid(), tenantId: tid,
            invoiceNumber: `INV-${tid.toString().slice(-4).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
            type: 'subscription', description: `${plan.name} Plan - Monthly`,
            items: [{ name: `${plan.name} Plan`, quantity: 1, unitPrice: subtotal, total: subtotal }],
            subtotal, tax, taxPercent: 18, total: subtotal + tax, currency: 'INR',
            status: i < n - 1 ? 'paid' : pick(['paid', 'pending']),
            razorpayOrderId: `order_${Date.now()}_${randInt(1000, 9999)}`,
            razorpayPaymentId: i < n - 1 ? `pay_${Date.now()}_${randInt(1000, 9999)}` : null,
            razorpaySubscriptionId: null,
            paidAt: i < n - 1 ? new Date(periodStart.getTime() + 86400000) : null,
            paymentMethod: 'razorpay', periodStart, periodEnd,
            createdAt: periodStart, updatedAt: periodStart
        });
    }
    return arr;
}

const AUDIT_ACTIONS = ['user.login', 'lead.created', 'lead.updated', 'lead.assigned', 'call.initiated', 'call.completed', 'whatsapp.sent', 'meeting.scheduled', 'automation.created', 'form.created', 'tenant.settings_changed', 'data.exported'];

function genAuditLogs(tid, users, branches, n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        const user = pick(users);
        arr.push({
            _id: oid(), tenantId: tid, userId: user._id, branchId: user.branchId || pick(branches)._id,
            userName: user.name, userRole: user.role, action: pick(AUDIT_ACTIONS),
            resource: pick(['Lead', 'User', 'Call', 'WhatsApp', 'Meeting', 'Form', 'Automation']),
            resourceId: oid(), details: { description: `Action by ${user.name}` },
            ipAddress: `192.168.${randInt(1, 255)}.${randInt(1, 255)}`,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
            severity: pick(['info', 'info', 'info', 'info', 'warning']),
            createdAt: pastDate(60), updatedAt: pastDate(5)
        });
    }
    return arr;
}

function genNotifications(tid, user) {
    const notifs = [
        { type: 'info', title: 'New Lead Assigned', message: `Lead "Rahul Sharma" assigned to you`, actionUrl: '/leads' },
        { type: 'success', title: 'Deal Won!', message: `Deal worth ₹2,50,000 has been won`, actionUrl: '/leads' },
        { type: 'warning', title: 'Follow-up Overdue', message: `You have 3 follow-ups overdue`, actionUrl: '/leads' },
        { type: 'action', title: 'Meeting Reminder', message: `Meeting with "Priya Patel" in 30 minutes`, actionUrl: '/meetings' },
        { type: 'info', title: 'Automation Triggered', message: `"Auto-assign website leads" executed`, actionUrl: '/automations' },
    ];
    return notifs.map((n, i) => ({
        _id: oid(), tenantId: tid, userId: user._id, branchId: user.branchId,
        ...n, channel: 'in_app', data: {}, isRead: i > 2, readAt: null, sentAt: pastDate(15), expiresAt: null,
        createdAt: pastDate(15), updatedAt: pastDate(5)
    }));
}

// ────────────────────────────────────────────────
//  MAIN SEED
// ────────────────────────────────────────────────
async function seed() {
    const isClean = process.argv.includes('--clean');
    console.log('\n🌱 SparkCRM Demo Data Seeder');
    console.log('══════════════════════════════════════');

    // Connect to all databases
    const conns = {};
    for (const [key, uri] of Object.entries(MONGO)) {
        try {
            conns[key] = (await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise());
            console.log(`  ✅ Connected: ${key}`);
        } catch (e) {
            console.error(`  ❌ Failed to connect: ${key} → ${e.message}`);
            process.exit(1);
        }
    }

    // Raw MongoDB collections
    const C = {
        Tenant: conns.TENANT.db.collection('tenants'),
        Branch: conns.TENANT.db.collection('branches'),
        Role: conns.TENANT.db.collection('roles'),
        Module: conns.TENANT.db.collection('modules'),
        Plan: conns.TENANT.db.collection('plans'),
        AuditLog: conns.TENANT.db.collection('auditlogs'),
        User: conns.AUTH.db.collection('users'),
        Lead: conns.LEAD.db.collection('leads'),
        CallLog: conns.CALL.db.collection('calllogs'),
        WaMsg: conns.WHATSAPP.db.collection('whatsappmessages'),
        Template: conns.WHATSAPP.db.collection('templates'),
        Chatbot: conns.WHATSAPP.db.collection('chatbotrules'),
        Form: conns.FORM.db.collection('smartforms'),
        Meeting: conns.MEETING.db.collection('meetings'),
        BookingLink: conns.MEETING.db.collection('bookinglinks'),
        AutoRule: conns.AUTOMATION.db.collection('automationrules'),
        AutoLog: conns.AUTOMATION.db.collection('automationlogs'),
        Subscription: conns.BILLING.db.collection('subscriptions'),
        Invoice: conns.BILLING.db.collection('invoices'),
        Notification: conns.NOTIFICATION.db.collection('notifications'),
    };

    if (isClean) {
        console.log('\n🗑️  Cleaning existing demo data...');
        const slugs = TENANTS.map(t => t.slug);
        const existing = await C.Tenant.find({ slug: { $in: slugs } }).toArray();
        const tids = existing.map(t => t._id);
        if (tids.length > 0) {
            await Promise.all([
                C.Branch.deleteMany({ tenantId: { $in: tids } }), C.Role.deleteMany({ tenantId: { $in: tids } }),
                C.User.deleteMany({ tenantId: { $in: tids } }), C.Lead.deleteMany({ tenantId: { $in: tids } }),
                C.CallLog.deleteMany({ tenantId: { $in: tids } }), C.WaMsg.deleteMany({ tenantId: { $in: tids } }),
                C.Template.deleteMany({ tenantId: { $in: tids } }), C.Chatbot.deleteMany({ tenantId: { $in: tids } }),
                C.Form.deleteMany({ tenantId: { $in: tids } }), C.Meeting.deleteMany({ tenantId: { $in: tids } }),
                C.BookingLink.deleteMany({ tenantId: { $in: tids } }), C.AutoRule.deleteMany({ tenantId: { $in: tids } }),
                C.AutoLog.deleteMany({ tenantId: { $in: tids } }), C.Subscription.deleteMany({ tenantId: { $in: tids } }),
                C.Invoice.deleteMany({ tenantId: { $in: tids } }), C.AuditLog.deleteMany({ tenantId: { $in: tids } }),
                C.Notification.deleteMany({ tenantId: { $in: tids } }), C.Tenant.deleteMany({ slug: { $in: slugs } }),
                C.Module.deleteMany({ tenantId: { $in: tids } }),
            ]);
            console.log(`  Cleaned ${tids.length} demo tenants`);
        }
    }

    // ── Seed Plans ──
    console.log('\n📋 Seeding Plans...');
    const planDocs = [];
    for (const p of PLANS) {
        const result = await C.Plan.findOneAndUpdate({ slug: p.slug }, { $set: p }, { upsert: true, returnDocument: 'after' });
        planDocs.push(result);
        console.log(`  ✅ Plan: ${result.name} (₹${result.price}/mo)`);
    }

    // Hash password once
    const hashedPw = await bcrypt.hash('Demo@1234', 12);

    // ── Seed Each Tenant ──
    for (let t = 0; t < TENANTS.length; t++) {
        const def = TENANTS[t];
        const plan = planDocs[planDocs.length - 1]; // Enterprise plan for all demo tenants
        console.log(`\n${'═'.repeat(50)}`);
        console.log(`🏢 TENANT ${t + 1}: ${def.companyName}`);
        console.log(`${'═'.repeat(50)}`);

        // Tenant
        const tenantId = oid();
        await C.Tenant.insertOne({
            _id: tenantId, companyName: def.companyName, slug: def.slug, email: def.email, phone: def.phone,
            logo: '', website: def.website, planId: plan._id,
            planExpiresAt: new Date(Date.now() + 335 * 86400000), billingCycle: 'yearly',
            trialStatus: 'converted', trialStartedAt: new Date(Date.now() - 60 * 86400000),
            trialExpiresAt: new Date(Date.now() - 30 * 86400000), trialConvertedAt: new Date(Date.now() - 30 * 86400000),
            purchasedFeatures: [], status: 'active', suspendedReason: null,
            settings: { timezone: 'Asia/Kolkata', workingHours: { start: '09:00', end: '18:00' }, currency: 'INR', dateFormat: 'DD/MM/YYYY', language: 'en' },
            pipelineStages: [
                { name: 'New', slug: 'new', color: '#3b82f6', order: 0 }, { name: 'Contacted', slug: 'contacted', color: '#8b5cf6', order: 1 },
                { name: 'Qualified', slug: 'qualified', color: '#f59e0b', order: 2 }, { name: 'Negotiation', slug: 'negotiation', color: '#f97316', order: 3 },
                { name: 'Won', slug: 'won', color: '#22c55e', order: 4 }, { name: 'Lost', slug: 'lost', color: '#ef4444', order: 5 },
            ],
            customFields: [], onboarding: { completedSteps: [], isComplete: true },
            referralCode: `REF-${def.slug.toUpperCase().slice(0, 5)}-${randInt(1000, 9999)}`, referredBy: null,
            createdAt: new Date(Date.now() - 60 * 86400000), updatedAt: new Date(),
        });
        console.log(`  ✅ Tenant created`);

        // Branches
        const branchDocs = [];
        for (let b = 0; b < BRANCHES.length; b++) {
            const br = BRANCHES[b], bid = oid();
            await C.Branch.insertOne({
                _id: bid, tenantId, name: br.name, code: br.code,
                address: { street: `${randInt(1, 500)} Main Road`, city: br.city, state: br.state, country: 'India', pincode: br.pincode },
                phone: randPhone(), email: `${br.code.toLowerCase()}@${def.slug}.com`,
                isDefault: b === 0, isActive: true, createdBy: null, customFields: {},
                createdAt: new Date(Date.now() - 55 * 86400000), updatedAt: new Date(),
            });
            branchDocs.push({ _id: bid, name: br.name, code: br.code });
        }
        console.log(`  ✅ ${branchDocs.length} branches`);

        // Roles
        const roleDocs = [];
        for (const rd of ROLES_DEF) {
            const rid = oid();
            await C.Role.insertOne({
                _id: rid, tenantId, name: rd.name, slug: rd.slug, description: rd.desc || '',
                isSystem: rd.isSystem || false, isDefault: rd.isDefault || false,
                permissions: buildPermissions(rd), createdBy: null, isActive: true,
                createdAt: new Date(Date.now() - 55 * 86400000), updatedAt: new Date(),
            });
            roleDocs.push({ _id: rid, name: rd.name, slug: rd.slug });
        }
        console.log(`  ✅ ${roleDocs.length} roles`);

        // Modules (sidebar menu items)
        const DEFAULT_MODULES = [
            { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', section: 'MENU', order: 0, isSystem: true },
            { key: 'leads', label: 'Leads', icon: 'Users', path: '/leads', section: 'MENU', order: 1, isSystem: true },
            { key: 'calls', label: 'Calls', icon: 'Phone', path: '/calls', section: 'MENU', order: 2, isSystem: true },
            { key: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', path: '/whatsapp', section: 'MENU', order: 3, isSystem: true },
            { key: 'whatsapp_inbox', label: 'Team Inbox', icon: 'MessageCircle', path: '/whatsapp/inbox', parentKey: 'whatsapp', section: 'MENU', order: 4, isSystem: true },
            { key: 'whatsapp_broadcasts', label: 'Broadcasts', icon: 'Megaphone', path: '/whatsapp/broadcasts', parentKey: 'whatsapp', section: 'MENU', order: 5, isSystem: true },
            { key: 'forms', label: 'Smart Forms', icon: 'FileText', path: '/forms', section: 'MENU', order: 6, isSystem: true },
            { key: 'meetings', label: 'Meetings', icon: 'Calendar', path: '/meetings', section: 'MENU', order: 7, isSystem: true },
            { key: 'automations', label: 'Automations', icon: 'Zap', path: '/automations', section: 'MENU', order: 8, isSystem: true },
            { key: 'analytics', label: 'Analytics', icon: 'BarChart3', path: '/analytics', section: 'MENU', order: 9, isSystem: true },
            { key: 'roles', label: 'Roles & Permissions', icon: 'Shield', path: '/admin/roles', section: 'ADMIN', order: 0, isSystem: true },
            { key: 'users', label: 'Users', icon: 'UserCog', path: '/admin/users', section: 'ADMIN', order: 1, isSystem: true },
            { key: 'modules', label: 'Modules', icon: 'LayoutList', path: '/admin/modules', section: 'ADMIN', order: 2, isSystem: true },
            { key: 'branches', label: 'Branches', icon: 'Building2', path: '/admin/branches', section: 'ADMIN', order: 3, isSystem: true },
            { key: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', section: 'SETTINGS', order: 0, isSystem: true },
            { key: 'billing', label: 'Billing', icon: 'CreditCard', path: '/billing', section: 'SETTINGS', order: 1, isSystem: true },
            { key: 'audit', label: 'Audit Logs', icon: 'ClipboardList', path: '/audit', section: 'SETTINGS', order: 2, isSystem: true },
            { key: 'notifications', label: 'Notifications', icon: 'Bell', path: '/notifications', section: 'SETTINGS', order: 3, isSystem: true },
        ];
        const moduleDocs = DEFAULT_MODULES.map(m => ({ _id: oid(), ...m, tenantId, isActive: true, createdBy: null, createdAt: new Date(Date.now() - 55 * 86400000), updatedAt: new Date() }));
        await C.Module.insertMany(moduleDocs);
        console.log(`  ✅ ${moduleDocs.length} modules`);

        // Users (20)
        const userDocs = [];
        // Super Admin
        const saId = oid();
        await C.User.insertOne({
            _id: saId, tenantId, name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
            email: def.email, phone: def.phone, password: hashedPw,
            role: 'superadmin', roleId: roleDocs[0]._id, branchId: branchDocs[0]._id,
            avatar: '', isEmailVerified: true, twoFactorEnabled: false, loginAttempts: 0, lockUntil: null, lastLoginAt: new Date(),
            lastLoginIp: '', isActive: true, invitedBy: null, inviteAccepted: true,
            whatsappNumber: '', extensionNumber: '', customFields: {},
            createdAt: new Date(Date.now() - 55 * 86400000), updatedAt: new Date(),
        });
        userDocs.push({ _id: saId, name: def.email.split('@')[0], email: def.email, role: 'superadmin', branchId: branchDocs[0]._id });

        for (let u = 0; u < 19; u++) {
            const branch = branchDocs[u % branchDocs.length];
            const roleIdx = Math.min(u < 6 ? 1 : u < 12 ? Math.floor(u / 3) : randInt(3, 5), roleDocs.length - 1);
            const fn = FIRST_NAMES[u % FIRST_NAMES.length], ln = LAST_NAMES[u % LAST_NAMES.length];
            const role = roleDocs[roleIdx];
            const roleSlug = role.slug === 'super-admin' ? 'admin' : role.slug === 'branch-manager' ? 'manager' : 'agent';
            const uid = oid(), uEmail = `${fn.toLowerCase()}.${ln.toLowerCase()}@${def.slug}.com`;
            await C.User.insertOne({
                _id: uid, tenantId, name: `${fn} ${ln}`, email: uEmail, phone: randPhone(), password: hashedPw,
                role: roleSlug, roleId: role._id, branchId: branch._id,
                avatar: '', isEmailVerified: true, twoFactorEnabled: false, loginAttempts: 0, lockUntil: null, lastLoginAt: pastDate(5),
                lastLoginIp: '', isActive: true, invitedBy: saId, inviteAccepted: true,
                whatsappNumber: '', extensionNumber: '', customFields: {},
                createdAt: new Date(Date.now() - 50 * 86400000), updatedAt: new Date(),
            });
            userDocs.push({ _id: uid, name: `${fn} ${ln}`, email: uEmail, role: roleSlug, branchId: branch._id });
        }
        console.log(`  ✅ ${userDocs.length} users (password: Demo@1234)`);

        // ── Per-branch data ──
        let stats = { leads: 0, calls: 0, msgs: 0, forms: 0, meetings: 0, autos: 0 };

        for (const branch of branchDocs) {
            const bUsers = userDocs.filter(u => u.branchId.toString() === branch._id.toString());
            if (!bUsers.length) continue;
            process.stdout.write(`  📍 ${branch.name}: `);

            // Leads (50)
            const leads = genLeads(tenantId, branch._id, bUsers, 50);
            await C.Lead.insertMany(leads); stats.leads += leads.length;
            process.stdout.write(`${leads.length}L `);

            // Calls (50)
            const calls = genCalls(tenantId, branch._id, bUsers, leads, 50);
            await C.CallLog.insertMany(calls); stats.calls += calls.length;
            process.stdout.write(`${calls.length}C `);

            // WhatsApp (50)
            const msgs = genWaMessages(tenantId, branch._id, bUsers, leads, 50);
            await C.WaMsg.insertMany(msgs); stats.msgs += msgs.length;
            process.stdout.write(`${msgs.length}WA `);

            // Templates (25)
            await C.Template.insertMany(genTemplates(tenantId, branch._id, 25));

            // Chatbot
            await C.Chatbot.insertMany(genChatbotRules(tenantId, branch._id));

            // Forms (50)
            const forms = genForms(tenantId, branch._id, bUsers, 50);
            await C.Form.insertMany(forms); stats.forms += forms.length;
            process.stdout.write(`${forms.length}F `);

            // Meetings (50)
            const meetings = genMeetings(tenantId, branch._id, bUsers, leads, 50);
            await C.Meeting.insertMany(meetings); stats.meetings += meetings.length;

            // Booking Links (25)
            await C.BookingLink.insertMany(genBookingLinks(tenantId, branch._id, bUsers, 25));
            process.stdout.write(`${meetings.length}M `);

            // Automation Rules (25) + Logs (25)
            const autoRules = genAutoRules(tenantId, branch._id, bUsers, 25);
            await C.AutoRule.insertMany(autoRules); stats.autos += autoRules.length;
            await C.AutoLog.insertMany(genAutoLogs(tenantId, branch._id, autoRules, 25));
            process.stdout.write(`${autoRules.length}A\n`);
        }

        // Billing
        await C.Subscription.insertOne({
            _id: oid(), tenantId, planId: plan._id, planSlug: plan.slug,
            billingCycle: 'yearly', status: 'active',
            razorpaySubscriptionId: null, razorpayCustomerId: null,
            currentPeriodStart: new Date(Date.now() - 30 * 86400000),
            currentPeriodEnd: new Date(Date.now() + 335 * 86400000),
            amount: plan.yearlyPrice, currency: 'INR', cancelledAt: null, cancelAtPeriodEnd: false,
            createdAt: new Date(Date.now() - 30 * 86400000), updatedAt: new Date(),
        });
        await C.Invoice.insertMany(genInvoices(tenantId, plan, 10));
        console.log(`  ✅ Billing: 1 subscription + 10 invoices`);

        // Audit Logs
        await C.AuditLog.insertMany(genAuditLogs(tenantId, userDocs, branchDocs, 50));

        // Notifications
        let nCount = 0;
        for (const u of userDocs) {
            const notifs = genNotifications(tenantId, u);
            await C.Notification.insertMany(notifs); nCount += notifs.length;
        }
        console.log(`  ✅ ${50} audit logs, ${nCount} notifications`);
        console.log(`  📊 Leads:${stats.leads} Calls:${stats.calls} WA:${stats.msgs} Forms:${stats.forms} Meetings:${stats.meetings} Auto:${stats.autos}`);
    }

    console.log('\n══════════════════════════════════════');
    console.log('✅ ALL DEMO DATA SEEDED SUCCESSFULLY!');
    console.log('══════════════════════════════════════');
    console.log('\n📋 Login credentials:  Password: Demo@1234');
    TENANTS.forEach(t => console.log(`   Super Admin: ${t.email}`));
    console.log('');

    for (const conn of Object.values(conns)) await conn.close();
    process.exit(0);
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
