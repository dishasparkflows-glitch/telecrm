const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        hostId: { type: mongoose.Schema.Types.ObjectId, required: true },
        hostName: { type: String, default: '' },
        leadId: { type: mongoose.Schema.Types.ObjectId, default: null },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        guestName: { type: String, default: '' },
        guestEmail: { type: String, default: '' },
        guestPhone: { type: String, default: '' },
        scheduledAt: { type: Date, required: true },
        duration: { type: Number, default: 30 }, // minutes
        // ─── Collaborative Features ───
        attendees: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                name: String,
                email: String,
                role: { type: String, enum: ['host', 'participant'], default: 'participant' },
                status: { type: String, enum: ['invited', 'accepted', 'declined', 'attended'], default: 'invited' },
            }
        ],
        meetingUrl: { type: String, default: '' },
        comments: [
            {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                userName: String,
                text: { type: String, required: true },
                createdAt: { type: Date, default: Date.now },
            }
        ],
        attachments: [
            {
                name: String,
                url: String,
                fileType: String,
                uploadedBy: mongoose.Schema.Types.ObjectId,
                uploadedAt: { type: Date, default: Date.now },
            }
        ],

        // ─── Custom Fields ───
        customFields: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
        },
        location: { type: String, default: '' }, // 'phone', 'video', address
        meetingLink: { type: String, default: '' },
        status: { type: String, enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'], default: 'scheduled' },
        notes: { type: String, default: '' },
        reminderSent: { type: Boolean, default: false },
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }
);

meetingSchema.index({ tenantId: 1, hostId: 1, scheduledAt: 1 });
meetingSchema.index({ tenantId: 1, scheduledAt: 1 });

const bookingLinkSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, required: true },
        slug: { type: String, required: true, unique: true },
        title: { type: String, default: 'Book a Meeting' },
        description: { type: String, default: '' },
        durationOptions: { type: [Number], default: [15, 30, 60] },
        availability: {
            days: { type: [String], default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
            startTime: { type: String, default: '09:00' },
            endTime: { type: String, default: '18:00' },
            timezone: { type: String, default: 'Asia/Kolkata' },
        },
        isActive: { type: Boolean, default: true },
    
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
        collection: 'booking_links'
    }
);

const Meeting = mongoose.model('Meeting', meetingSchema);
const BookingLink = mongoose.model('BookingLink', bookingLinkSchema);

module.exports = { Meeting, BookingLink };
