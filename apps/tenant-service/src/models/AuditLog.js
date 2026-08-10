const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
        userId: { type: mongoose.Schema.Types.Mixed, default: null, index: true },
        module: { type: String, required: true, index: true },
        action: { type: String, required: true, index: true },
        recordId: { type: String, default: null, index: true },
        recordType: { type: String, default: 'Record' },

        description: { type: String, default: '' },
        systemInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { versionKey: false }
);

// Performance compound indexes (Requirement 27)
auditLogSchema.index({ tenantId: 1, 'meta.createdAt': -1 });
auditLogSchema.index({ tenantId: 1, recordId: 1, 'meta.createdAt': -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, 'meta.createdAt': -1 });
auditLogSchema.index({ tenantId: 1, module: 1, 'meta.createdAt': -1 });
auditLogSchema.index({ tenantId: 1, branchId: 1, 'meta.createdAt': -1 });
auditLogSchema.index({ tenantId: 1, action: 1, 'meta.createdAt': -1 });

// TTL index — auto-delete after 90 days
auditLogSchema.index({ 'meta.createdAt': 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
global.__AUDIT_LOG_MODEL__ = AuditLog;
module.exports = AuditLog;
