const mongoose = require('mongoose');

const paymentConfigSchema = new mongoose.Schema({
    provider: {
        type: String,
        required: [true, 'Payment provider is required'],
        enum: ['razorpay', 'stripe', 'paypal'],
        unique: true // Only one config per provider at the global/owner level
    },
    isActive: {
        type: Boolean,
        default: false
    },
    // Common display name
    displayName: {
        type: String,
        required: true
    },
    // Credentials (these will be encrypted before saving)
    credentials: {
        type: Map,
        of: String,
        required: true
    },
    // Webhook secrets (also encrypted)
    webhookSecret: {
        type: String,
        default: ''
    },
    // Any extra non-sensitive config
    settings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { 
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, 
        versionKey: false,
        toJSON: { flattenMaps: true },
        collection: 'payment_configs'
});

module.exports = mongoose.model('PaymentConfig', paymentConfigSchema);
