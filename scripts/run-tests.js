#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function findTests(directory) {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return findTests(target);
        return /\.test\.js$/.test(entry.name) ? [target] : [];
    });
}

const tests = [
    ...findTests(path.join(root, 'apps')),
    ...findTests(path.join(root, 'libs')),
].sort();

if (tests.length === 0) {
    console.error('No *.test.js files were found under apps/ or libs/.');
    process.exit(1);
}

console.log(`Running ${tests.length} Node test files.`);
const result = spawnSync(process.execPath, ['--test', ...tests], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'inherit',
});
if (result.error) {
    console.error(`Unable to start Node test runner: ${result.error.message}`);
    process.exit(1);
}
process.exit(result.status ?? 1);
