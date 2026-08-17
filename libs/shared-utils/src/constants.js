/**
 * Application-wide constants
 */
const ROLES = {
    SUPER_ADMIN: 'super-admin',
    BRANCH_MANAGER: 'branch-manager',
    SALES_LEAD: 'sales-lead',
    AGENT: 'agent',
    SENIOR_AGENT: 'senior-agent',
    JUNIOR_AGENT: 'junior-agent',
    SUPPORT_AGENT: 'support-agent',
};

const ROLE_HIERARCHY = {
    [ROLES.SUPER_ADMIN]: 4,
    [ROLES.BRANCH_MANAGER]: 3,
    [ROLES.SALES_LEAD]: 2,
    [ROLES.AGENT]: 1,
    [ROLES.SENIOR_AGENT]: 1.2,
    [ROLES.JUNIOR_AGENT]: 0.8,
    [ROLES.SUPPORT_AGENT]: 1,
};

const TENANT_STATUS = {
    TRIAL: 'trial',
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
    CANCELLED: 'cancelled',
    FREE: 'free',
};

const TRIAL_STATUS = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    CONVERTED: 'converted',
    NEVER: 'never',
};

const TRIAL_DURATION_DAYS = 30;

const LEAD_SOURCES = {
    MANUAL: 'manual',
    WEBSITE: 'website',
    FACEBOOK: 'facebook',
    INSTAGRAM: 'instagram',
    GOOGLE_ADS: 'google_ads',
    WHATSAPP: 'whatsapp',
    CSV: 'csv',
    API: 'api',
    SMART_FORM: 'smart_form',
    REFERRAL: 'referral',
    INDIAMART: 'indiamart',
    JUSTDIAL: 'justdial',
    SULEKHA: 'sulekha',
    NINETY_NINE_ACRES: '99acres',
    MAGICBRICKS: 'magicbricks',
    HOUSING: 'housing',
};

const PIPELINE_STAGES = {
    NEW: 'new',
    CONTACTED: 'contacted',
    QUALIFIED: 'qualified',
    NEGOTIATION: 'negotiation',
    WON: 'won',
    LOST: 'lost',
};

const LEAD_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
};

const CALL_STATUS = {
    INITIATED: 'initiated',
    RINGING: 'ringing',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    MISSED: 'missed',
    FAILED: 'failed',
};

const BILLING_TYPE = {
    ONE_TIME: 'one_time',
    RECURRING: 'recurring',
};

const INVOICE_STATUS = {
    DRAFT: 'draft',
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
};

const FEATURE_CATEGORIES = {
    CALLING: 'calling',
    WHATSAPP: 'whatsapp',
    AUTOMATION: 'automation',
    ANALYTICS: 'analytics',
    INTEGRATION: 'integration',
    AI: 'ai',
    PRODUCTIVITY: 'productivity',
    ENTERPRISE: 'enterprise',
    USERS: 'users',
    LEADS: 'leads',
    UTILITY: 'utility',
};

const NOTIFICATION_TYPES = {
    LEAD_ASSIGNED: 'lead_assigned',
    FOLLOW_UP_REMINDER: 'follow_up_reminder',
    MEETING_BOOKED: 'meeting_booked',
    DEAL_WON: 'deal_won',
    TRIAL_EXPIRING: 'trial_expiring',
    WHATSAPP_MESSAGE: 'whatsapp_message',
    MISSED_CALL: 'missed_call',
    AUTOMATION_TRIGGERED: 'automation_triggered',
    PAYMENT_SUCCESS: 'payment_success',
    PAYMENT_FAILED: 'payment_failed',
};

const ASSIGNMENT_STRATEGIES = {
    ROUND_ROBIN: 'round_robin',
    MANUAL: 'manual',
    SKILL_BASED: 'skill_based',
    GEOGRAPHY_BASED: 'geography_based',
    LOAD_BASED: 'load_based',
};

const EXOTEL_STATUS_MAP = {
    ringing: 'ringing',
    'in-progress': 'in_progress',
    completed: 'completed',
    busy: 'missed',
    'no-answer': 'missed',
    failed: 'failed',
    canceled: 'failed',
};

module.exports = {
    ROLES,
    ROLE_HIERARCHY,
    TENANT_STATUS,
    TRIAL_STATUS,
    TRIAL_DURATION_DAYS,
    LEAD_SOURCES,
    PIPELINE_STAGES,
    LEAD_PRIORITY,
    CALL_STATUS,

    BILLING_TYPE,
    INVOICE_STATUS,
    FEATURE_CATEGORIES,
    NOTIFICATION_TYPES,
    ASSIGNMENT_STRATEGIES,
    EXOTEL_STATUS_MAP,
};
