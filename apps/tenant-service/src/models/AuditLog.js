const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        userName: { type: String, default: '' },
        userRole: { type: String, default: '' },
        action: {
            type: String,
            required: true,
            enum: [
                'user.login', 'user.logout', 'user.password_change', 'user.invited', 'user.deactivated',
                'lead.created', 'lead.updated', 'lead.deleted', 'lead.assigned', 'lead.imported',
                'tenant.settings_changed', 'tenant.plan_upgraded', 'tenant.plan_downgraded',
                'call.initiated', 'call.completed',
                'whatsapp.sent', 'whatsapp.template_created',
                'form.created', 'form.deleted',
                'automation.created', 'automation.toggled', 'automation.deleted',
                'billing.payment', 'billing.refund',
                'feature.purchased', 'feature.cancelled',
                'meeting.scheduled', 'meeting.cancelled',
                'data.exported', 'data.imported',
                'api.key_generated', 'api.key_revoked',
            ],
        },
        resource: { type: String, default: '' }, // e.g., 'Lead', 'User', 'Automation'
        resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
        ipAddress: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    },
    { timestamps: true, versionKey: false }
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, severity: 1 });

// TTL index — auto-delete after 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
