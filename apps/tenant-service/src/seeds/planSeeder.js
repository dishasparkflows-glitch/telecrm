const Plan = require('../models/Plan');

/**
 * Seed default plans into the database
 */
const seedPlans = async () => {
    const count = await Plan.countDocuments();
    if (count > 0) {
        console.log('📋 Plans already seeded, skipping...');
        return;
    }

    const plans = [
        {
            name: 'Free Trial',
            slug: 'free-trial',
            description: 'All Pro features for 30 days — no credit card required',
            price: 0,
            yearlyPrice: 0,
            isTrial: true,
            trialDurationDays: 30,
            moduleKeys: ['leads', 'calls', 'whatsapp', 'forms', 'meetings', 'automations', 'analytics', 'tasks'],
            features: [
                'lead_management', 'calling_basic', 'call_recording', 'call_reminders',
                'whatsapp_templates', 'whatsapp_session', 'whatsapp_chatbot', 'whatsapp_media',
                'automation_basic', 'automation_advanced', 'analytics_basic', 'analytics_advanced',
                'custom_fields', 'smart_forms', 'team_inbox', 'meeting_scheduler',
                'ai_lead_scoring', 'notifications', 'task_management',
            ],
            limits: {
                maxUsers: 5,
                maxLeadsPerMonth: 2000,
                maxCallsPerDay: 100,
                maxWhatsappMessagesPerDay: 200,
                storageGB: 2,
            },
            sortOrder: 0,
        },
        {
            name: 'Free',
            slug: 'free',
            description: 'Basic CRM features for individuals',
            price: 0,
            yearlyPrice: 0,
            moduleKeys: ['leads', 'analytics'],
            features: ['lead_management', 'analytics_basic', 'notifications'],
            limits: {
                maxUsers: 1,
                maxLeadsPerMonth: 100,
                maxCallsPerDay: 0,
                maxWhatsappMessagesPerDay: 0,
                storageGB: 0.5,
            },
            sortOrder: 1,
        },
        {
            name: 'Basic',
            slug: 'basic',
            description: 'Essential CRM for small teams',
            price: 999,
            yearlyPrice: 9990,
            perUserPrice: 199,
            moduleKeys: ['leads', 'calls', 'forms', 'automations', 'analytics'],
            features: [
                'lead_management', 'calling_basic', 'call_reminders',
                'whatsapp_templates', 'automation_basic', 'analytics_basic',
                'analytics_standard', 'custom_fields', 'smart_forms', 'notifications',
            ],
            limits: {
                maxUsers: 5,
                maxLeadsPerMonth: 2000,
                maxCallsPerDay: 100,
                maxWhatsappMessagesPerDay: 200,
                storageGB: 2,
            },
            sortOrder: 2,
        },
        {
            name: 'Professional',
            slug: 'professional',
            description: 'Advanced CRM for growing teams',
            price: 1999,
            yearlyPrice: 19990,
            perUserPrice: 149,
            moduleKeys: ['leads', 'calls', 'whatsapp', 'forms', 'meetings', 'automations', 'analytics', 'tasks'],
            features: [
                'lead_management', 'calling_basic', 'call_recording', 'call_reminders',
                'whatsapp_templates', 'whatsapp_session', 'whatsapp_chatbot', 'whatsapp_media',
                'automation_basic', 'automation_advanced', 'analytics_basic', 'analytics_standard',
                'analytics_advanced', 'custom_fields', 'smart_forms', 'team_inbox',
                'meeting_scheduler', 'ai_lead_scoring', 'notifications', 'task_management',
            ],
            limits: {
                maxUsers: 15,
                maxLeadsPerMonth: 10000,
                maxCallsPerDay: 500,
                maxWhatsappMessagesPerDay: 1000,
                storageGB: 10,
            },
            sortOrder: 3,
        },
        {
            name: 'Enterprise',
            slug: 'enterprise',
            description: 'Unlimited CRM for large organizations',
            price: 4999,
            yearlyPrice: 49990,
            perUserPrice: 0,
            moduleKeys: ['leads', 'calls', 'whatsapp', 'forms', 'meetings', 'automations', 'analytics', 'tasks'],
            features: [
                'lead_management', 'calling_basic', 'call_recording', 'call_reminders',
                'auto_dialer', 'power_dialer',
                'whatsapp_templates', 'whatsapp_session', 'whatsapp_chatbot',
                'whatsapp_media', 'whatsapp_broadcasting',
                'automation_basic', 'automation_advanced', 'automation_custom',
                'analytics_basic', 'analytics_standard', 'analytics_advanced',
                'custom_reports', 'scheduled_reports', 'whitelabel_reports',
                'custom_fields', 'smart_forms', 'team_inbox',
                'meeting_scheduler', 'ai_lead_scoring', 'api_access',
                'ivr', 'notifications', 'audit_logs', 'task_management',
            ],
            limits: {
                maxUsers: 9999,
                maxLeadsPerMonth: 999999,
                maxCallsPerDay: 9999,
                maxWhatsappMessagesPerDay: 9999,
                storageGB: 100,
            },
            sortOrder: 4,
        },
    ];

    await Plan.insertMany(plans);
    console.log('✅ Default plans seeded successfully');
};

module.exports = { seedPlans };

