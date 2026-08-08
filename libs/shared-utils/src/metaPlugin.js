const { requestContext } = require('@sparkcrm/shared-middleware/src/contextMiddleware');

function metaPlugin(schema, options) {
    schema.pre('save', function (next) {
        const store = requestContext.getStore();
        const userId = store?.userId;

        if (userId) {
            if (this.isNew) {
                if (!this.meta) this.meta = {};
                if (!this.meta.createdBy) this.meta.createdBy = userId;
                this.meta.updatedBy = userId;
            } else if (this.isModified()) {
                if (!this.meta) this.meta = {};
                this.meta.updatedBy = userId;
            }
        }
        next();
    });

    schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
        const store = requestContext.getStore();
        const userId = store?.userId;

        if (userId) {
            const update = this.getUpdate();
            if (update) {
                if (!update.$set) update.$set = {};
                
                // Only set updatedBy if it's not explicitly set in the update query
                if (!update.$set['meta.updatedBy']) {
                    update.$set['meta.updatedBy'] = userId;
                }
            }
        }
        next();
    });
    
    schema.pre('insertMany', function (next, docs) {
        const store = requestContext.getStore();
        const userId = store?.userId;

        if (userId) {
            if (Array.isArray(docs)) {
                docs.forEach(doc => {
                    if (!doc.meta) doc.meta = {};
                    if (!doc.meta.createdBy) doc.meta.createdBy = userId;
                    doc.meta.updatedBy = userId;
                });
            }
        }
        next();
    });
}

module.exports = metaPlugin;
