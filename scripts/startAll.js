const { spawn } = require('child_process');

const services = [
    'api-gateway',
    'auth-service',
    'tenant-service',
    'lead-service',
    'call-service',
    'whatsapp-service',
    'automation-service',
    'analytics-service',
    'billing-service',
    'notification-service',
    'form-service',
    'meeting-service',
    'upload-service',
];

console.log('Starting all SparkCRM services in watch mode...\n');

const procs = [];

services.forEach((s) => {
    const p = spawn('node', ['--watch', '--watch-preserve-output', 'src/main.js'], {
        cwd: `apps/${s}`,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'development' },
    });

    p.stdout.on('data', (d) => {
        d.toString().trim().split('\n').forEach((line) => {
            if (line) console.log(`[${s}] ${line}`);
        });
    });

    p.stderr.on('data', (d) => {
        d.toString().trim().split('\n').forEach((line) => {
            if (line) console.log(`[${s}:WARN] ${line}`);
        });
    });

    p.on('close', (code) => {
        if (code) console.log(`[${s}] EXITED with code ${code}`);
    });

    procs.push({ name: s, proc: p });
});

// Keep running until killed
process.on('SIGINT', () => {
    console.log('\nShutting down all services...');
    procs.forEach(({ name, proc }) => {
        proc.kill();
        console.log(`  Stopped ${name}`);
    });
    process.exit(0);
});

// Give 30s for startup, then print status
setTimeout(async () => {
    console.log('\n--- Checking service status after 30s ---\n');
    const net = require('net');
    const ports = [8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008, 8009, 8010, 8011, 8012];
    const names = ['gateway', 'auth', 'tenant', 'lead', 'call', 'whatsapp', 'automation', 'analytics', 'billing', 'notification', 'form', 'meeting', 'upload'];

    for (let i = 0; i < ports.length; i++) {
        await new Promise((resolve) => {
            const s = net.createConnection(ports[i], 'localhost');
            s.on('connect', () => {
                console.log(`  ${names[i]}:${ports[i]} = UP`);
                s.destroy();
                resolve();
            });
            s.on('error', () => {
                console.log(`  ${names[i]}:${ports[i]} = DOWN`);
                resolve();
            });
            s.setTimeout(2000, () => {
                console.log(`  ${names[i]}:${ports[i]} = TIMEOUT`);
                s.destroy();
                resolve();
            });
        });
    }

    console.log('\n--- Services are running. Press Ctrl+C to stop. ---\n');
}, 30000);
