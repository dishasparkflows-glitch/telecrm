const mongoose = require('mongoose');
const { env } = require('@sparkcrm/shared-config');

// Create separate connections for different services
const leadConn = mongoose.createConnection(env.MONGO.LEAD);
const callConn = mongoose.createConnection(env.MONGO.CALL);
const whatsappConn = mongoose.createConnection(env.MONGO.WHATSAPP);
const authConn = mongoose.createConnection(env.MONGO.AUTH);

// Shadow Lead Model
const Lead = leadConn.model('Lead', new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, index: true },
    pipeline: {
        stage: String,
        previousStage: String,
        stageChangedAt: Date,
    },
    lifecycle: {
        priority: String,
        expectedValue: Number,
        currency: String,
        lastActivityAt: Date,
        lastContactedAt: Date,
        followUpAt: Date,
        convertedAt: Date,
    },
    stage: String,
    source: String,
    score: Number,
    assignedTo: mongoose.Schema.Types.ObjectId,
    expectedValue: Number,
    currency: String,
    firstTouch: {
        campaignId: String,
        campaignName: String,
        adId: String,
        adName: String,
        formId: String,
        formName: String,
    },
    isArchived: { type: Boolean, default: false },
    meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }));

// Shadow CallLog Model
const CallLog = callConn.model('CallLog', new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, index: true },
    status: String,
    duration: Number,
    callerId: mongoose.Schema.Types.ObjectId,
    disposition: String,
    direction: String,
    startedAt: Date,
    meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false, collection: 'call_logs' }));

// Shadow WhatsappMessage Model
const WhatsappMessage = whatsappConn.model('WhatsappMessage', new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, index: true },
    direction: String,
    status: String,
    meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false, collection: 'whatsapp_messages' }));

// Shadow User Model
const User = authConn.model('User', new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, index: true },
    name: String,
    firstName: String,
    lastName: String,
    email: String,
    isActive: Boolean,
    meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }));

module.exports = { Lead, CallLog, WhatsappMessage, User };
