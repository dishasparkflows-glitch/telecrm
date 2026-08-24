const ReminderSettings = require('../models/ReminderSettings');

const getReminderSettings = async (req, res, next) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];
        
        let settings = await ReminderSettings.findOne({ tenantId, userId });
        
        if (!settings) {
            // Return defaults if none exist
            settings = {
                defaultReminders: {
                    meeting: { enabled: true, offsetMinutes: 60 },
                    followUp: { enabled: true, offsetMinutes: 15 },
                    task: { enabled: true, offsetMinutes: 30 }
                }
            };
        }
        
        res.json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

const updateReminderSettings = async (req, res, next) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];
        const { defaultReminders } = req.body;
        
        if (!defaultReminders) {
            return res.status(400).json({ success: false, message: 'defaultReminders is required' });
        }
        
        const settings = await ReminderSettings.findOneAndUpdate(
            { tenantId, userId },
            { 
                $set: { 
                    defaultReminders,
                    'meta.updatedBy': userId,
                    'meta.updatedAt': new Date()
                } 
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        
        res.json({ success: true, message: 'Reminder settings updated successfully', data: settings });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getReminderSettings,
    updateReminderSettings
};
