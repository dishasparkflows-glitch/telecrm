
const bcrypt = require('bcryptjs');
const Owner = require('../models/Owner');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function seedOwner({ email, password, name }) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
        throw new Error('OWNER_BOOTSTRAP_EMAIL must be a valid email address');
    }
    if (password.length < 12) {
        throw new Error('OWNER_BOOTSTRAP_PASSWORD must contain at least 12 characters');
    }
    if (!normalizedName) {
        throw new Error('OWNER_BOOTSTRAP_NAME is required');
    }

    const existingOwner = await Owner.exists({});
    if (existingOwner) {
        throw new Error('An owner account already exists; bootstrap was not applied');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    return Owner.create({
        email: normalizedEmail,
        password: hashedPassword,
        name: normalizedName,
        role: 'owner',
    });
}

module.exports = { seedOwner };
