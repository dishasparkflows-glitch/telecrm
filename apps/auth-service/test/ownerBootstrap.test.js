'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Owner = require('../src/models/Owner');
const { seedOwner } = require('../src/seeds/seedOwner');

const originalExists = Owner.exists;
const originalCreate = Owner.create;

test.afterEach(() => {
    Owner.exists = originalExists;
    Owner.create = originalCreate;
});

test('owner bootstrap validates runtime credentials before database access', async () => {
    Owner.exists = async () => {
        throw new Error('database should not be queried');
    };

    await assert.rejects(
        seedOwner({ email: 'invalid', password: 'short', name: '' }),
        /valid email address/,
    );
});

test('owner bootstrap refuses to create a second owner', async () => {
    Owner.exists = async () => ({ _id: 'existing-owner' });
    Owner.create = async () => {
        throw new Error('owner should not be created');
    };

    await assert.rejects(
        seedOwner({
            email: 'owner@example.com',
            password: 'a-secure-password',
            name: 'System Owner',
        }),
        /already exists/,
    );
});

test('owner bootstrap hashes the password before creating the owner', async () => {
    let createdOwner;
    Owner.exists = async () => null;
    Owner.create = async (owner) => {
        createdOwner = owner;
        return owner;
    };

    await seedOwner({
        email: ' Owner@Example.com ',
        password: 'a-secure-password',
        name: ' System Owner ',
    });

    assert.equal(createdOwner.email, 'owner@example.com');
    assert.equal(createdOwner.name, 'System Owner');
    assert.equal(createdOwner.role, 'owner');
    assert.notEqual(createdOwner.password, 'a-secure-password');
    assert.match(createdOwner.password, /^\$2[aby]\$/);
});
