const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');

module.exports = [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/.nx/**',
            '**/sessions/**',
            '**/test-results.json',
            'clients/mobile-app/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.{js,jsx,mjs,cjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: { ...globals.browser, ...globals.node, ...globals.es2024 },
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react/jsx-uses-react': 'warn',
            'react/jsx-uses-vars': 'warn',
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^(Icon|[A-Z_][A-Z0-9_]*)$',
                caughtErrorsIgnorePattern: '^_',
            }],
            'no-useless-escape': 'warn',
            'no-prototype-builtins': 'warn',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        },
    },
    {
        files: ['apps/web-dashboard/**/*.{js,jsx}', 'clients/mobile-app/**/*.{js,jsx,ts,tsx}'],
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
    {
        files: ['apps/*-service/**/*.js', 'apps/api-gateway/**/*.js', 'libs/**/*.js', 'scripts/**/*.js'],
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'off',
            'react-hooks/exhaustive-deps': 'off',
            'react-hooks/set-state-in-effect': 'off',
        },
    },
    {
        files: ['apps/whatsapp-web-extension/**/*.js'],
        languageOptions: {
            globals: { ...globals.browser, chrome: 'readonly' },
        },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'off',
            'react-hooks/exhaustive-deps': 'off',
            'react-hooks/set-state-in-effect': 'off',
        },
    },
];
