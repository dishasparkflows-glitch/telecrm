'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;

function fail(message) {
    failures += 1;
    console.error(`ERROR: ${message}`);
}

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    });
}

const parsedJson = {};
for (const file of ['package.json', 'nx.json', 'SparkCRM_Postman_Collection.json']) {
    try {
        parsedJson[file] = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    } catch (error) {
        fail(`${file} is invalid JSON: ${error.message}`);
    }
}

for (const file of walk(path.join(root, 'scripts')).filter((item) => item.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) fail(`${path.relative(root, file)} failed node --check: ${result.stderr.trim()}`);
}

const sourceFiles = [
    ...walk(path.join(root, 'scripts')).filter((item) => item.endsWith('.js')),
    path.join(root, 'Dockerfile'),
    path.join(root, 'docker-compose.yml'),
    path.join(root, 'README.md'),
    ...walk(path.join(root, 'docs')),
];
const forbidden = [
    ['credentialed MongoDB URI', /mongodb(?:\+srv)?:\/\/[^\s:/]+:[^\s@]+@/i],
    ['literal Razorpay key', /rzp_(?:test|live)_[A-Za-z0-9]{8,}/],
    ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const [label, pattern] of forbidden) {
        if (pattern.test(content)) fail(`${path.relative(root, file)} contains a ${label}`);
    }
}

const postman = parsedJson['SparkCRM_Postman_Collection.json'];
if (postman) {
    const definedVariables = new Set((postman.variable || []).map((item) => item.key));
    const references = new Set([...JSON.stringify(postman).matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g)].map((match) => match[1]));
    for (const variable of references) {
        if (!definedVariables.has(variable)) fail(`Postman variable ${variable} is referenced but not defined`);
    }
}

const compose = spawnSync('docker', ['compose', '--env-file', '.env.example', 'config', '--quiet'], {
    cwd: root,
    encoding: 'utf8',
});
if (compose.error?.code === 'ENOENT') {
    try {
        const YAML = require('yaml');
        const config = YAML.parse(fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8'));
        const published = Object.entries(config.services || {}).filter(([, service]) => service.ports).map(([name]) => name);
        if (published.length !== 1 || published[0] !== 'api-gateway') {
            fail(`Only api-gateway may publish ports; found: ${published.join(', ') || 'none'}`);
        }
        if (config.networks?.data?.internal !== true) fail('Compose data network must be internal');
        for (const [name, service] of Object.entries(config.services || {})) {
            if (!service.healthcheck) fail(`Compose service ${name} has no healthcheck`);
        }
        console.warn('WARN: Docker is unavailable; validated Compose with the local YAML parser instead');
    } catch (error) {
        fail(`Docker and YAML fallback validation are unavailable: ${error.message}`);
    }
} else if (compose.status !== 0) {
    fail(`docker compose config --quiet failed: ${(compose.stderr || compose.stdout).trim()}`);
}

if (failures > 0) process.exit(1);
console.log('Static operations checks passed');
