/**
 * Seed default plans into the tenant database
 * Run: node scripts/seedPlans.js
 */
const mongoose = require('mongoose');
const { env } = require('@sparkcrm/shared-config');

// Import Plan model
const Plan = require('../src/models/Plan');

const DEFAULT_PLANS = [
    {
        name: 'Free Trial',
        slug: 'trial',
        description: '30-day free trial with all features unlocked',
        price: 0,
        yearlyPrice: 0,
        perUserPrice: 0,
        currency: 'INR',
        features: [
            'lead_management',
            'calling_basic',
            'whatsapp_templates',
            'smart_forms',
            'meeting_scheduler',
            'automation_basic',
            'analytics_basic',
        ],
        limits: {
            maxUsers: 5,
            maxLeadsPerMonth: 1000,
            maxCallsPerDay: 50,
            maxWhatsappMessagesPerDay: 100,
            storageGB: 5,
        },
        isTrial: true,
        trialDurationDays: 30,
        isActive: true,
        sortOrder: 0,
    },
    {
        name: 'Free',
        slug: 'free',
        description: 'Basic CRM for small teams',
        price: 0,
        yearlyPrice: 0,
        perUserPrice: 0,
        currency: 'INR',
        features: ['lead_management'],
        limits: {
            maxUsers: 1,
            maxLeadsPerMonth: 100,
            maxCallsPerDay: 0,
            maxWhatsappMessagesPerDay: 0,
            storageGB: 1,
        },
        isTrial: false,
        isActive: true,
        sortOrder: 1,
    },
    {
        name: 'Starter',
        slug: 'starter',
        description: 'Everything you need to grow your sales',
        price: 999,
        yearlyPrice: 9990,
        perUserPrice: 499,
        currency: 'INR',
        features: [
            'lead_management',
            'calling_basic',
            'whatsapp_templates',
            'smart_forms',
            'analytics_basic',
        ],
        limits: {
            maxUsers: 5,
            maxLeadsPerMonth: 1000,
            maxCallsPerDay: 50,
            maxWhatsappMessagesPerDay: 50,
            storageGB: 5,
        },
        isTrial: false,
        isActive: true,
        sortOrder: 2,
    },
    {
        name: 'Professional',
        slug: 'professional',
        description: 'Advanced CRM for growing businesses',
        price: 2499,
        yearlyPrice: 24990,
        perUserPrice: 999,
        currency: 'INR',
        features: [
            'lead_management',
            'calling_basic',
            'call_recording',
            'whatsapp_templates',
            'whatsapp_chatbot',
            'smart_forms',
            'meeting_scheduler',
            'automation_basic',
            'analytics_basic',
            'analytics_advanced',
        ],
        limits: {
            maxUsers: 20,
            maxLeadsPerMonth: 10000,
            maxCallsPerDay: 200,
            maxWhatsappMessagesPerDay: 500,
            storageGB: 25,
        },
        isTrial: false,
        isActive: true,
        sortOrder: 3,
    },
    {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Full-featured CRM for large teams',
        price: 4999,
        yearlyPrice: 49990,
        perUserPrice: 1999,
        currency: 'INR',
        features: [
            'lead_management',
            'calling_basic',
            'call_recording',
            'whatsapp_templates',
            'whatsapp_chatbot',
            'smart_forms',
            'meeting_scheduler',
            'automation_basic',
            'automation_advanced',
            'analytics_basic',
            'analytics_advanced',
            'custom_reports',
            'api_access',
            'priority_support',
        ],
        limits: {
            maxUsers: 100,
            maxLeadsPerMonth: 100000,
            maxCallsPerDay: 1000,
            maxWhatsappMessagesPerDay: 5000,
            storageGB: 100,
        },
        isTrial: false,
        isActive: true,
        sortOrder: 4,
    },
];

const seedPlans = async () => {
    try {
        await mongoose.connect(env.MONGO.TENANT);
        console.log('✅ Connected to tenant database');

        // Check if plans already exist
        const count = await Plan.countDocuments();
        if (count > 0) {
            console.log(`ℹ️  ${count} plans already exist. Skipping seed.`);
            process.exit(0);
        }

        // Insert default plans
        const plans = await Plan.insertMany(DEFAULT_PLANS);
        console.log(`✅ Seeded ${plans.length} default plans:`);
        plans.forEach((p) => console.log(`   - ${p.name} (${p.slug}): ₹${p.price}/mo`));

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error.message);
        process.exit(1);
    }
};

seedPlans();
