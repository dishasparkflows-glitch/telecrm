const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const { env } = require(path.resolve(__dirname, '../libs/shared-config/src/env'));
const Tenant = require(path.resolve(__dirname, '../apps/tenant-service/src/models/Tenant'));


(async () => {
    try {
        await mongoose.connect(env.MONGO.TENANT);

        const tenant = await Tenant.findOne({ email: 'invoice@gmail.com' }).populate('planId');
        if (!tenant) {
            fs.writeFileSync(path.resolve(__dirname, 'tenant_features_diag.txt'), 'Tenant not found!');
            process.exit(0);
        }

        const lines = [];
        lines.push('--- Tenant Details ---');
        lines.push('ID: ' + tenant._id.toString());
        lines.push('Status: ' + tenant.status);

        lines.push('\n--- Plan Details ---');
        if (tenant.planId) {
            lines.push('Plan ID: ' + tenant.planId._id.toString());
            lines.push('Plan Name: ' + tenant.planId.name);
            lines.push('Plan Features Count: ' + (tenant.planId.features ? tenant.planId.features.length : 0));
            lines.push('Includes analytics_basic? ' + tenant.planId.features?.includes('analytics_basic'));
            lines.push('All Features: ' + JSON.stringify(tenant.planId.features));
        } else {
            lines.push('NO PLAN ID POPULATED!');
        }

        lines.push('\n--- Purchased Add-ons ---');
        lines.push(JSON.stringify(tenant.purchasedFeatures));

        fs.writeFileSync(path.resolve(__dirname, 'tenant_features_diag.txt'), lines.join('\n'));

    } catch (err) {
        fs.writeFileSync(path.resolve(__dirname, 'tenant_features_diag.txt'), 'Error: ' + err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
})();
