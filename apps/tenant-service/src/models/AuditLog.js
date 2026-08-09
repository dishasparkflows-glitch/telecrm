const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
        userId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
        userName: { type: String, default: 'System' },
        userRole: { type: String, default: 'user' },
        module: { type: String, required: true, index: true },
        action: { type: String, required: true, index: true },
        recordId: { type: String, default: null, index: true },
        recordType: { type: String, default: 'Record' },
        recordName: { type: String, default: 'Record' },
        changes: [
            {
                field: { type: String },
                oldValue: { type: mongoose.Schema.Types.Mixed },
                newValue: { type: mongoose.Schema.Types.Mixed },
            },
        ],

        description: { type: String, default: '' },
        ipAddress: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        resource: { type: String, default: '' },
        resourceId: { type: mongoose.Schema.Types.Mixed, default: null },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, versionKey: false }
);

// Performance compound indexes (Requirement 27)
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, recordId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, module: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });

// TTL index — auto-delete after 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
global.__AUDIT_LOG_MODEL__ = AuditLog;
module.exports = AuditLog;
