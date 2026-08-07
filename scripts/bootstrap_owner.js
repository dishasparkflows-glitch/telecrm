'use strict';

const mongoose = require('mongoose');
const { connectDB, env } = require('../libs/shared-config/src');
const { seedOwner } = require('../apps/auth-service/src/seeds/seedOwner');
const { assertExactConfirmation, hasFlag, requiredEnvList } = require('./_safety');

async function main() {
    if (!hasFlag('apply')) {
        throw new Error('Pass --apply to create the initial owner account');
    }
    assertExactConfirmation('CREATE_INITIAL_OWNER');

    const values = requiredEnvList([
        'OWNER_BOOTSTRAP_EMAIL',
        'OWNER_BOOTSTRAP_PASSWORD',
        'OWNER_BOOTSTRAP_NAME',
    ]);

    await connectDB(env.MONGO.AUTH, 'owner-bootstrap');

    try {
        await seedOwner({
            email: values.OWNER_BOOTSTRAP_EMAIL,
            password: values.OWNER_BOOTSTRAP_PASSWORD,
            name: values.OWNER_BOOTSTRAP_NAME,
        });
        console.log('Initial owner account created successfully');
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((err) => {
    console.error('Owner bootstrap failed:', err.message);
    process.exitCode = 1;
});
