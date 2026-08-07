const test = require('node:test');
const assert = require('node:assert/strict');

const { SmartForm, FormSubmission } = require('../src/models/SmartForm');
const formController = require('../src/controllers/form.controller');
const { pickFormWriteInput, pagination } = require('../src/utils/formDto');

const TENANT_ID = '64c000000000000000000001';
const USER_BRANCH_ID = '64c000000000000000000002';
const SELECTED_BRANCH_ID = '64c000000000000000000003';
const USER_ID = '64c000000000000000000004';
const FORM_ID = '64c000000000000000000005';

function scopedHeaders() {
    return {
        'x-tenant-id': TENANT_ID,
        'x-user-id': USER_ID,
        'x-user-role': 'agent',
        'x-user-branch-id': USER_BRANCH_ID,
        'x-branch-id': SELECTED_BRANCH_ID,
        'x-user-permissions': JSON.stringify({ forms: { isOwn: true, isGlobal: false } }),
    };
}

function invokeExpectingError(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            status() { return this; },
            json() { reject(new Error('Expected request to be rejected')); },
        };
        handler(req, res, (error) => {
            if (!error) return reject(new Error('Expected an error'));
            resolve(error);
        });
    });
}

test('form DTO rejects scope, counters, embed code, timestamps, and unknown nested fields', () => {
    for (const field of ['tenantId', 'branchId', 'submissionCount', 'embedCode', 'createdAt', 'updatedAt', 'active']) {
        assert.throws(
            () => pickFormWriteInput({ name: 'Contact', [field]: 'attacker-controlled' }),
            (error) => error.statusCode === 400 && error.message.includes(field)
        );
    }

    assert.throws(
        () => pickFormWriteInput({ fields: [{ label: 'Email', name: 'email', _id: FORM_ID }] }),
        /Unsupported fields\[0\] fields/
    );
    assert.throws(
        () => pickFormWriteInput({ settings: { tenantId: TENANT_ID } }),
        /Unsupported settings fields/
    );
    assert.throws(
        () => pickFormWriteInput({ styling: { script: 'alert(1)' } }),
        /Unsupported styling fields/
    );
});

test('form DTO preserves dashboard-supported definitions and active state', () => {
    const input = {
        name: 'Website contact',
        description: 'Main contact form',
        fields: [{
            label: 'Email',
            name: 'email',
            type: 'email',
            placeholder: 'you@example.test',
            required: true,
            options: [],
            order: 0,
        }],
        settings: {
            submitButtonText: 'Send',
            successMessage: 'Received',
            redirectUrl: '',
            notifyEmails: ['owner@example.test'],
            assignTo: USER_ID,
            leadSource: 'smart_form',
            autoTag: ['website'],
        },
        styling: { theme: 'light', primaryColor: '#6366f1', fontFamily: 'Inter' },
        isActive: false,
    };
    assert.deepEqual(pickFormWriteInput(input), input);
});

test('form pagination is bounded', () => {
    assert.deepEqual(pagination({ page: '2', limit: '25' }), { page: 2, limit: 25, skip: 25 });
    assert.throws(() => pagination({ limit: '101' }), (error) => error.statusCode === 400);
});

test('protected form lookup uses the verified user branch instead of selected branch', async (t) => {
    const originalFindOne = SmartForm.findOne;
    let capturedFilter;
    SmartForm.findOne = async (filter) => {
        capturedFilter = filter;
        return null;
    };
    t.after(() => { SmartForm.findOne = originalFindOne; });

    const error = await invokeExpectingError(formController.getForm, {
        headers: scopedHeaders(),
        params: { id: FORM_ID },
        query: {},
        body: {},
    });

    assert.equal(error.statusCode, 404);
    assert.deepEqual(capturedFilter, {
        _id: FORM_ID,
        tenantId: TENANT_ID,
        branchId: USER_BRANCH_ID,
    });
});

test('public submission rejects undeclared data before persistence', async (t) => {
    const originalFindOne = SmartForm.findOne;
    const originalCreate = FormSubmission.create;
    let createCalls = 0;
    SmartForm.findOne = async () => ({
        _id: FORM_ID,
        tenantId: TENANT_ID,
        branchId: USER_BRANCH_ID,
        fields: [{ name: 'email', label: 'Email', type: 'email', required: true, options: [] }],
    });
    FormSubmission.create = async () => {
        createCalls += 1;
        return { _id: 'submission' };
    };
    t.after(() => {
        SmartForm.findOne = originalFindOne;
        FormSubmission.create = originalCreate;
    });

    const error = await invokeExpectingError(formController.submitForm, {
        headers: { 'user-agent': 'test' },
        params: { id: FORM_ID },
        query: {},
        body: { email: 'safe@example.test', tenantId: 'injected' },
        ip: '127.0.0.1',
    });

    assert.equal(error.statusCode, 400);
    assert.match(error.message, /Unknown field: tenantId/);
    assert.equal(createCalls, 0);
});
