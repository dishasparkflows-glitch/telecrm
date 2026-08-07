const Feature = require('../models/Feature');

const seedFeatures = async () => {
    const count = await Feature.countDocuments();
    if (count > 0) {
        console.log('🧩 Features already seeded, skipping...');
        return;
    }

    const features = [
        { name: 'WhatsApp Chatbot', slug: 'whatsapp_chatbot', category: 'whatsapp', price: 499, icon: '🤖', minPlan: 'basic', sortOrder: 1 },
        { name: 'WhatsApp Broadcasting', slug: 'whatsapp_broadcasting', category: 'whatsapp', price: 699, icon: '📢', minPlan: 'basic', sortOrder: 2 },
        { name: 'Call Recording', slug: 'call_recording', category: 'calling', price: 299, icon: '🎙️', minPlan: 'basic', sortOrder: 3 },
        { name: 'Auto Dialer', slug: 'auto_dialer', category: 'calling', price: 599, icon: '🔄', minPlan: 'professional', sortOrder: 4 },
        { name: 'Power Dialer', slug: 'power_dialer', category: 'calling', price: 799, icon: '⚡', minPlan: 'professional', sortOrder: 5 },
        { name: 'IVR / Virtual Number', slug: 'ivr', category: 'calling', price: 999, icon: '📞', minPlan: 'basic', sortOrder: 6 },
        { name: 'AI Lead Scoring', slug: 'ai_lead_scoring', category: 'ai', price: 399, icon: '🧠', minPlan: 'basic', sortOrder: 7 },
        { name: 'Advanced Analytics', slug: 'analytics_advanced', category: 'analytics', price: 499, icon: '📊', minPlan: 'basic', sortOrder: 8 },
        { name: 'Custom Report Builder', slug: 'custom_reports', category: 'analytics', price: 399, icon: '📝', minPlan: 'professional', sortOrder: 9 },
        { name: 'Scheduled Reports', slug: 'scheduled_reports', category: 'analytics', price: 199, icon: '📅', minPlan: 'professional', sortOrder: 10 },
        { name: 'Smart Web Forms', slug: 'smart_forms', category: 'integration', price: 199, icon: '📋', minPlan: 'free', sortOrder: 11 },
        { name: 'Meeting Scheduler', slug: 'meeting_scheduler', category: 'productivity', price: 299, icon: '🗓️', minPlan: 'basic', sortOrder: 12 },
        { name: 'Team Inbox', slug: 'team_inbox', category: 'productivity', price: 399, icon: '📥', minPlan: 'basic', sortOrder: 13 },
        { name: 'API Access & Webhooks', slug: 'api_access', category: 'integration', price: 599, icon: '🔌', minPlan: 'professional', sortOrder: 14 },
        { name: 'White-label Reports', slug: 'whitelabel_reports', category: 'enterprise', price: 999, icon: '🏷️', minPlan: 'professional', sortOrder: 15 },
        { name: 'Extra 10 Users', slug: 'extra_users_10', category: 'users', price: 999, icon: '👥', minPlan: 'free', sortOrder: 16 },
        { name: 'Extra 5,000 Leads', slug: 'extra_leads_5000', category: 'leads', price: 499, icon: '📈', minPlan: 'free', sortOrder: 17 },
        { name: 'Data Export (CSV/PDF)', slug: 'data_export', category: 'utility', price: 99, billingType: 'one_time', icon: '💾', minPlan: 'free', sortOrder: 18 },
    ];

    await Feature.insertMany(features);
    console.log('✅ 18 features seeded for the marketplace');
};

module.exports = { seedFeatures };
