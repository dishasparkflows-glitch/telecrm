'use strict';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'mongo', 'redis']);

function requiredEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function requiredEnvList(names) {
    return Object.fromEntries(names.map((name) => [name, requiredEnv(name)]));
}

function flagValue(name) {
    const prefix = `--${name}=`;
    const argument = process.argv.find((item) => item.startsWith(prefix));
    return argument ? argument.slice(prefix.length) : undefined;
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function assertNonProduction(operation) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error(`${operation} is disabled when NODE_ENV=production`);
    }
}

function parsedUrl(value, label) {
    try {
        return new URL(value);
    } catch {
        throw new Error(`${label} must be a valid URL`);
    }
}

function describeUrl(value, label = 'URL') {
    const url = parsedUrl(value, label);
    const port = url.port ? `:${url.port}` : '';
    return `${url.protocol}//${url.hostname}${port}${url.pathname}`;
}

function assertLocalUrl(value, label) {
    const url = parsedUrl(value, label);
    if (!LOCAL_HOSTS.has(url.hostname)) {
        throw new Error(`${label} must target a local/container host; received ${describeUrl(value, label)}`);
    }
    return url;
}

function assertExactConfirmation(expected) {
    const actual = flagValue('confirm');
    if (actual !== expected) {
        throw new Error(`Pass --confirm=${expected} to acknowledge this operation`);
    }
}

function mutationMode({ operation, confirmation, allowRemote = false, urls = [] }) {
    assertNonProduction(operation);

    const apply = hasFlag('apply');
    if (!apply) return { apply: false };

    assertExactConfirmation(confirmation);
    if (process.env.ALLOW_OPS_MUTATIONS !== 'true') {
        throw new Error('Set ALLOW_OPS_MUTATIONS=true in the invoking process to permit writes');
    }

    if (!allowRemote) {
        urls.forEach(({ value, label }) => assertLocalUrl(value, label));
    }

    return { apply: true };
}

function assertApiMutationTest(baseUrl) {
    assertNonProduction('API mutation test');
    assertLocalUrl(baseUrl, 'API base URL');
    if (!hasFlag('allow-mutations') || process.env.ALLOW_TEST_MUTATIONS !== 'true') {
        throw new Error('Mutation tests require --allow-mutations and ALLOW_TEST_MUTATIONS=true');
    }
}

function assertExternalUpload() {
    assertNonProduction('external upload test');
    if (!hasFlag('allow-upload') || process.env.ALLOW_TEST_UPLOADS !== 'true') {
        throw new Error('External uploads require --allow-upload and ALLOW_TEST_UPLOADS=true');
    }
}

function setFailureExitCode(failures) {
    if (failures > 0) process.exitCode = 1;
}

module.exports = {
    assertApiMutationTest,
    assertExactConfirmation,
    assertExternalUpload,
    assertLocalUrl,
    assertNonProduction,
    describeUrl,
    flagValue,
    hasFlag,
    mutationMode,
    requiredEnv,
    requiredEnvList,
    setFailureExitCode,
};
