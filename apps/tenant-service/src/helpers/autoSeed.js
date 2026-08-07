/**
 * Auto-seed demo data for a new tenant.
 * Called automatically during tenant registration.
 * Creates sample leads, calls, WA messages, forms, meetings, and automations.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { env } = require('@sparkcrm/shared-config');

const oid = () => new mongoose.Types.ObjectId();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randPhone = () => `+91${randInt(70000, 99999)}${randInt(10000, 99999)}`;
const pastDate = (d) => new Date(Date.now() - randInt(1, d) * 86400000);
const futureDate = (d) => new Date(Date.now() + randInt(1, d) * 86400000);

// Maps new role slugs to legacy role strings stored on User.role
const ROLE_SLUG_TO_LEGACY = {
    'super-admin': 'superadmin',
    'branch-manager': 'manager',
    'sales-lead': 'manager',
    'senior-agent': 'agent',
    'junior-agent': 'agent',
    'support-agent': 'agent',
};

const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Krishna', 'Ishaan', 'Dhruv', 'Kabir', 'Pranav', 'Ananya', 'Diya', 'Aadhya', 'Myra', 'Sara', 'Ira', 'Kiara', 'Priya', 'Riya', 'Kavya'];
const LAST_NAMES = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Reddy', 'Joshi', 'Mehta', 'Shah', 'Verma', 'Gupta'];
const COMPANIES = ['TechVista', 'Pinnacle Corp', 'Zenith Innovations', 'Nexus Digital', 'CloudNine Systems', 'DataBridge', 'CyberShield', 'MobiStack', 'InfraSolutions', 'GreenTech'];
const STAGES = ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'];
const SOURCES = ['manual', 'website', 'facebook', 'whatsapp', 'smart_form', 'referral'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TAGS = ['hot-lead', 'follow-up', 'enterprise', 'sme', 'referral', 'demo-requested'];

/**
 * Generates demo data across all required databases for a given tenant.
 * @param {string} tenantId
 * @param {Array} branches - Array of branch documents [{_id, name, code}]
 * @param {Object} superAdmin - {_id, name, email, branchId}
 */
async function seedDemoForTenant(tenantId, branches, superAdmin, roles = []) {
    const ITEMS_PER_BRANCH = 15; // Keep it light for auto-seed (not 50)
    let conns = {};

    try {
        // Connect to required databases
        conns = {
            LEAD: await mongoose.createConnection(env.MONGO.LEAD, { serverSelectionTimeoutMS: 5000 }).asPromise(),
            CALL: await mongoose.createConnection(env.MONGO.CALL, { serverSelectionTimeoutMS: 5000 }).asPromise(),
            WHATSAPP: await mongoose.createConnection(env.MONGO.WHATSAPP, { serverSelectionTimeoutMS: 5000 }).asPromise(),
            FORM: await mongoose.createConnection(env.MONGO.FORM, { serverSelectionTimeoutMS: 5000 }).asPromise(),
            MEETING: await mongoose.createConnection(env.MONGO.MEETING, { serverSelectionTimeoutMS: 5000 }).asPromise(),
            AUTOMATION: await mongoose.createConnection(env.MONGO.AUTOMATION, { serverSelectionTimeoutMS: 5000 }).asPromise(),
            AUTH: await mongoose.createConnection(env.MONGO.AUTH, { serverSelectionTimeoutMS: 5000 }).asPromise(),
        };

        const C = {
            Lead: conns.LEAD.db.collection('leads'),
            CallLog: conns.CALL.db.collection('calllogs'),
            WaMsg: conns.WHATSAPP.db.collection('whatsappmessages'),
            Template: conns.WHATSAPP.db.collection('templates'),
            Chatbot: conns.WHATSAPP.db.collection('chatbotrules'),
            Form: conns.FORM.db.collection('smartforms'),
            Meeting: conns.MEETING.db.collection('meetings'),
            AutoRule: conns.AUTOMATION.db.collection('automationrules'),
            AutoLog: conns.AUTOMATION.db.collection('automationlogs'),
            User: conns.AUTH.db.collection('users'),
        };

        const userId = superAdmin._id === 'auto' ? oid() : new mongoose.Types.ObjectId(superAdmin._id);
        const user = { _id: userId, name: superAdmin.name, email: superAdmin.email };

        for (const branch of branches) {
            const bid = new mongoose.Types.ObjectId(branch._id);
            const tid = new mongoose.Types.ObjectId(tenantId);

            // ── Leads ──
            const leads = [];
            for (let i = 0; i < ITEMS_PER_BRANCH; i++) {
                const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
                leads.push({
                    _id: oid(), tenantId: tid, branchId: bid,
                    firstName: fn, lastName: ln,
                    email: `${fn.toLowerCase()}.${ln.toLowerCase()}${randInt(1, 999)}@gmail.com`,
                    phone: randPhone(), company: pick(COMPANIES),
                    designation: pick(['CEO', 'CTO', 'Manager', 'Director', 'Executive']),
                    stage: pick(STAGES), source: pick(SOURCES), priority: pick(PRIORITIES),
                    expectedValue: randInt(10000, 500000), score: randInt(20, 90),
                    assignedTo: user._id, assignedAt: pastDate(30),
                    tags: [pick(TAGS)], address: { city: branch.name?.split(' ')[0] || 'Mumbai', state: 'India', country: 'India' },
                    lastActivityAt: pastDate(10), isArchived: false,
                    createdAt: pastDate(45), updatedAt: pastDate(3),
                });
            }
            await C.Lead.insertMany(leads);

            // ── Calls ──
            const calls = [];
            for (let i = 0; i < ITEMS_PER_BRANCH; i++) {
                const lead = pick(leads);
                const status = pick(['completed', 'completed', 'completed', 'missed', 'failed']);
                calls.push({
                    _id: oid(), tenantId: tid, branchId: bid,
                    leadId: lead._id, callerId: user._id, callerName: user.name,
                    fromNumber: randPhone(), toNumber: lead.phone,
                    direction: Math.random() > 0.2 ? 'outbound' : 'inbound', status,
                    disposition: status === 'completed' ? pick(['interested', 'callback', 'not_interested']) : null,
                    duration: status === 'completed' ? randInt(30, 300) : 0,
                    notes: status === 'completed' ? pick(['Good call', 'Will follow up', 'Meeting scheduled']) : '',
                    provider: 'exotel', startedAt: pastDate(20),
                    createdAt: pastDate(20), updatedAt: pastDate(3),
                });
            }
            await C.CallLog.insertMany(calls);

            // ── WhatsApp Messages ──
            const msgs = [];
            const contents = ['Hi, following up!', 'Thank you for your interest.', 'Can we schedule a call?', 'Here is the brochure.', 'Would you like a demo?'];
            for (let i = 0; i < ITEMS_PER_BRANCH; i++) {
                const lead = pick(leads);
                const dir = Math.random() > 0.4 ? 'outbound' : 'inbound';
                msgs.push({
                    _id: oid(), tenantId: tid, branchId: bid,
                    leadId: lead._id, userId: user._id,
                    direction: dir, from: dir === 'outbound' ? '+919876500001' : lead.phone,
                    to: dir === 'outbound' ? lead.phone : '+919876500001',
                    type: 'text', content: pick(contents),
                    status: dir === 'outbound' ? pick(['sent', 'delivered', 'read']) : 'received',
                    isRead: Math.random() > 0.3,
                    createdAt: pastDate(20), updatedAt: pastDate(3),
                });
            }
            await C.WaMsg.insertMany(msgs);

            // ── Templates ──
            const templateNames = ['Welcome', 'Follow Up', 'Meeting Reminder', 'Quote', 'Feedback'];
            await C.Template.insertMany(templateNames.map((n) => ({
                _id: oid(), tenantId: tid, branchId: bid,
                name: `${n}_${bid.toString().slice(-4)}`, language: 'en', category: 'marketing',
                body: `Hello {{1}}, ${n.toLowerCase()} template. {{2}}`,
                headerType: 'none', footer: 'SparkCRM', buttons: [], variables: ['name', 'details'],
                status: 'approved', isActive: true,
                createdAt: pastDate(30), updatedAt: pastDate(5),
            })));

            // ── Chatbot Rules ──
            await C.Chatbot.insertMany([
                { _id: oid(), tenantId: tid, branchId: bid, triggerKeyword: 'hi', matchType: 'exact', responseType: 'text', responseContent: 'Hello! 👋 How can I help?', isActive: true, priority: 10, createdAt: pastDate(30), updatedAt: pastDate(5) },
                { _id: oid(), tenantId: tid, branchId: bid, triggerKeyword: 'price', matchType: 'contains', responseType: 'text', responseContent: 'Plans start at ₹999/month.', isActive: true, priority: 9, createdAt: pastDate(30), updatedAt: pastDate(5) },
                { _id: oid(), tenantId: tid, branchId: bid, triggerKeyword: 'demo', matchType: 'contains', responseType: 'text', responseContent: 'We would love to show you a demo!', isActive: true, priority: 8, createdAt: pastDate(30), updatedAt: pastDate(5) },
            ]);

            // ── Smart Forms ──
            const formNames = ['Contact Us', 'Request Demo', 'Get Quote', 'Newsletter', 'Feedback'];
            await C.Form.insertMany(formNames.map((n) => ({
                _id: oid(), tenantId: tid, branchId: bid,
                name: `${n} - ${branch.code || 'HO'}`, description: `Demo ${n.toLowerCase()} form`,
                fields: [
                    { label: 'Full Name', name: 'fullName', type: 'text', required: true, options: [], order: 0 },
                    { label: 'Email', name: 'email', type: 'email', required: true, options: [], order: 1 },
                    { label: 'Phone', name: 'phone', type: 'phone', required: false, options: [], order: 2 },
                    { label: 'Message', name: 'message', type: 'textarea', required: false, options: [], order: 3 },
                ],
                settings: { submitButtonText: 'Submit', successMessage: 'Thank you!', notifyEmails: [user.email], assignTo: user._id, leadSource: 'smart_form' },
                styling: { theme: 'light', primaryColor: '#6366f1', fontFamily: 'Inter' },
                isActive: true, submissionCount: randInt(0, 50),
                createdAt: pastDate(30), updatedAt: pastDate(5),
            })));

            // ── Meetings ──
            const meetingTitles = ['Product Demo', 'Follow-Up', 'Pricing Discussion', 'Onboarding', 'Review'];
            const meetings = [];
            for (let i = 0; i < ITEMS_PER_BRANCH; i++) {
                const lead = pick(leads);
                const isPast = Math.random() > 0.4;
                meetings.push({
                    _id: oid(), tenantId: tid, branchId: bid,
                    hostId: user._id, hostName: user.name,
                    leadId: lead._id, title: `${pick(meetingTitles)} #${i + 1}`,
                    guestName: `${lead.firstName} ${lead.lastName}`, guestEmail: lead.email, guestPhone: lead.phone,
                    scheduledAt: isPast ? pastDate(20) : futureDate(20), duration: pick([15, 30, 60]),
                    attendees: [{ userId: user._id, name: user.name, email: user.email, role: 'host', status: 'accepted' }],
                    comments: [], attachments: [], customFields: {},
                    status: isPast ? pick(['completed', 'completed', 'cancelled']) : 'scheduled',
                    notes: '', reminderSent: false,
                    createdAt: pastDate(30), updatedAt: pastDate(5),
                });
            }
            await C.Meeting.insertMany(meetings);

            // ── Automation Rules ──
            const autoNames = ['Auto-assign leads', 'Welcome email', 'Notify manager', 'Follow-up reminder', 'Tag high-value'];
            const triggerEvents = ['lead.created', 'lead.stage_changed', 'form.submitted', 'meeting.scheduled'];
            const actionTypes = ['assign_lead', 'send_email', 'send_notification', 'change_stage', 'add_tag'];
            const rules = autoNames.map((n) => ({
                _id: oid(), tenantId: tid, branchId: bid,
                name: n, description: `Auto rule: ${n.toLowerCase()}`, isActive: true,
                trigger: { event: pick(triggerEvents), conditions: [{ field: 'source', operator: 'equals', value: 'website' }] },
                actions: [{ type: pick(actionTypes), config: { target: user._id.toString() }, delay: 0 }],
                executionCount: randInt(0, 50), lastExecutedAt: pastDate(10),
                createdBy: user._id,
                createdAt: pastDate(30), updatedAt: pastDate(5),
            }));
            await C.AutoRule.insertMany(rules);

            await C.AutoLog.insertMany(rules.slice(0, 3).map(r => ({
                _id: oid(), tenantId: tid, branchId: bid,
                ruleId: r._id, ruleName: r.name, triggerEvent: r.trigger.event,
                triggerData: { leadId: oid().toString() },
                actionsExecuted: [{ type: r.actions[0].type, status: 'success', result: { message: 'OK' }, executedAt: pastDate(5) }],
                status: 'success',
                createdAt: pastDate(15), updatedAt: pastDate(3),
            })));
        }

        // ── Seed Users (per branch, with different roles) ──
        if (roles.length > 0) {
            const defaultPassword = await bcrypt.hash('Spark@123', 12);
            const ROLE_SLUG_TO_LEGACY = {
                'super-admin': 'superadmin',
                'branch-manager': 'manager',
                'sales-lead': 'manager',
                'senior-agent': 'agent',
                'junior-agent': 'agent',
                'support-agent': 'agent',
            };

            // Users per branch — names for each role type
            const USERS_PER_BRANCH = [
                // Branch Manager
                {
                    roleSlugs: ['branch-manager'], names: [
                        'Rajesh Sharma', 'Priya Kapoor', 'Suresh Menon', 'Kavita Nair', 'Arun Mehta', 'Deepa Joshi'
                    ]
                },
                // Sales Lead
                {
                    roleSlugs: ['sales-lead'], names: [
                        'Vikram Singh', 'Neha Reddy', 'Rohan Patel', 'Anita Desai', 'Karthik Iyer', 'Sneha Gupta'
                    ]
                },
                // Senior Agent
                {
                    roleSlugs: ['senior-agent'], names: [
                        'Amit Kumar', 'Meera Shah', 'Sanjay Verma', 'Pooja Bhatt', 'Nikhil Jain', 'Ritika Malhotra'
                    ]
                },
                // Junior Agent (2 per branch)
                {
                    roleSlugs: ['junior-agent'], names: [
                        'Rahul Yadav', 'Swati Pillai', 'Gaurav Tiwari', 'Nisha Chauhan', 'Manish Soni', 'Divya Saxena',
                        'Akash Dubey', 'Tanvi Agarwal', 'Varun Mishra', 'Simran Kaur', 'Harsh Pandey', 'Komal Thakur'
                    ]
                },
                // Support Agent
                {
                    roleSlugs: ['support-agent'], names: [
                        'Sachin Patil', 'Rekha Bose', 'Vivek Chandra', 'Asha Rani', 'Tarun Sethi', 'Bhavna Khurana'
                    ]
                },
            ];

            const allSeedUsers = [];
            for (let bIdx = 0; bIdx < branches.length; bIdx++) {
                const branch = branches[bIdx];
                const bid = new mongoose.Types.ObjectId(branch._id);
                const tid = new mongoose.Types.ObjectId(tenantId);

                for (const userGroup of USERS_PER_BRANCH) {
                    const roleSlug = userGroup.roleSlugs[0];
                    const role = roles.find(r => r.slug === roleSlug);
                    if (!role) continue;

                    // Pick name based on branch index
                    const howMany = roleSlug === 'junior-agent' ? 2 : 1;
                    for (let j = 0; j < howMany; j++) {
                        const nameIdx = (bIdx * howMany + j) % userGroup.names.length;
                        const fullName = userGroup.names[nameIdx];
                        const [first, last] = fullName.split(' ');
                        const email = `${first.toLowerCase()}.${last.toLowerCase()}.${(branch.code || 'hq').toLowerCase()}@sparkcrm.demo`;

                        // Check if user already exists
                        const existing = await C.User.findOne({ tenantId: tid, email });
                        if (existing) continue;

                        allSeedUsers.push({
                            _id: oid(),
                            tenantId: tid,
                            branchId: bid,
                            name: fullName,
                            email,
                            phone: randPhone(),
                            password: defaultPassword,
                            role: ROLE_SLUG_TO_LEGACY[roleSlug] || 'agent',
                            roleId: new mongoose.Types.ObjectId(role._id),
                            isActive: true,
                            isEmailVerified: true,
                            inviteAccepted: true,
                            whatsappNumber: randPhone(),
                            loginAttempts: 0,
                            lastLoginAt: pastDate(5),
                            customFields: {},
                            createdAt: pastDate(30),
                            updatedAt: pastDate(3),
                        });
                    }
                }
            }

            if (allSeedUsers.length > 0) {
                await C.User.insertMany(allSeedUsers);
                console.log(`  👥 Seeded ${allSeedUsers.length} demo users across ${branches.length} branches`);
            }
        }

        console.log(`  ✅ Auto-seeded demo data for tenant ${tenantId} (${branches.length} branches × ${ITEMS_PER_BRANCH} items each)`);
    } catch (err) {
        console.error(`  ⚠️ Auto-seed failed (non-blocking):`, err.message);
    } finally {
        // Close all connections
        for (const conn of Object.values(conns)) {
            try { await conn.close(); } catch { }
        }
    }
}

module.exports = { seedDemoForTenant };
