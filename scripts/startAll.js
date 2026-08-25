const { spawn } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');
const net = require('net');
const http = require('http');

const SERVICES = [
    { name: 'api-gateway', port: 8000 },
    { name: 'auth-service', port: 8001 },
    { name: 'tenant-service', port: 8002 },
    { name: 'lead-service', port: 8003 },
    { name: 'call-service', port: 8004 },
    { name: 'whatsapp-service', port: 8005 },
    { name: 'automation-service', port: 8006 },
    { name: 'analytics-service', port: 8007 },
    { name: 'billing-service', port: 8008 },
    { name: 'notification-service', port: 8009 },
    { name: 'form-service', port: 8010 },
    { name: 'meeting-service', port: 8011 },
    { name: 'upload-service', port: 8012 },
    { name: 'integration-service', port: 8013 },
];

const processes = new Map();
const serviceStates = new Map(); // 'STARTING', 'UP', 'DOWN'
let isShuttingDown = false;
let steadyStateInterval = null;

console.log('[SERVICE MANAGER] Starting SparkCRM services...\n');

// Polling settings
const STARTUP_POLL_INTERVAL = 2000;
const STARTUP_MAX_RETRIES = 30; // 60s max wait
const STEADY_STATE_INTERVAL = 30000;

async function checkPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') resolve(false);
            else resolve(true);
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

function checkHealth(name, port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
            // Consume response data to free up memory
            res.resume();
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        }).on('error', () => resolve(false));
        
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

function pollReadiness(name, port) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        const check = async () => {
            if (isShuttingDown) return reject(new Error('Shutting down'));
            attempts++;
            
            const isUp = await checkHealth(name, port);
            if (isUp) {
                resolve();
            } else {
                if (attempts >= STARTUP_MAX_RETRIES) {
                    reject(new Error(`Startup timeout after ${STARTUP_MAX_RETRIES} attempts`));
                } else {
                    setTimeout(check, STARTUP_POLL_INTERVAL);
                }
            }
        };

        check();
    });
}

function startSteadyStateMonitor() {
    if (steadyStateInterval) return; // Exactly one centralized mechanism
    
    steadyStateInterval = setInterval(async () => {
        if (isShuttingDown) return;
        
        for (const s of SERVICES) {
            const state = serviceStates.get(s.name);
            if (state === 'STARTING' || !state) continue; // Handled by startup poller
            
            const isUp = await checkHealth(s.name, s.port);
            if (isUp && serviceStates.get(s.name) === 'DOWN') {
                serviceStates.set(s.name, 'UP');
                console.log(`[Health] ${s.name} RECOVERED`);
            } else if (!isUp && serviceStates.get(s.name) === 'UP') {
                serviceStates.set(s.name, 'DOWN');
                console.log(`[Health] ${s.name} DOWN`);
            }
        }
    }, STEADY_STATE_INTERVAL);
}

async function startService(serviceConfig) {
    const { name, port } = serviceConfig;
    
    if (processes.has(name)) {
        await stopService(name);
    }
    
    console.log(`[${name}] Starting...`);
    serviceStates.set(name, 'STARTING');
    
    const isAvailable = await checkPortAvailable(port);
    if (!isAvailable) {
        console.error(`[${name}] FAILED TO START\nReason: EADDRINUSE :${port}`);
        serviceStates.set(name, 'DOWN');
        return;
    }
    
    const p = spawn('node', ['src/main.js'], {
        cwd: `apps/${name}`,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'development' }
    });
    
    processes.set(name, p);
    
    p.stdout.on('data', (d) => {
        d.toString().trim().split('\n').forEach((line) => {
            if (!line) return;
            // Filter out successful health check logs to avoid spam
            if (line.includes('GET /health') && line.match(/200|304/)) return;
            console.log(`[${name}] ${line}`);
        });
    });
    
    p.stderr.on('data', (d) => {
        d.toString().trim().split('\n').forEach((line) => {
            if (line) console.log(`[${name}:WARN] ${line}`);
        });
    });
    
    p.on('close', (code) => {
        if (!isShuttingDown) {
            console.log(`[${name}] EXITED with code ${code}`);
            processes.delete(name);
            if (serviceStates.get(name) === 'UP') {
                serviceStates.set(name, 'DOWN');
                console.log(`[Health] ${name} DOWN`);
            }
        }
    });

    console.log(`[${name}] Waiting for port ${port}...`);
    
    try {
        await pollReadiness(name, port);
        serviceStates.set(name, 'UP');
        console.log(`[Health] ${name} UP`);
    } catch (err) {
        serviceStates.set(name, 'DOWN');
        console.error(`[${name}] FAILED TO START\nReason: ${err.message}`);
    }
}

function stopService(name) {
    return new Promise((resolve) => {
        const p = processes.get(name);
        if (!p) return resolve();
        
        serviceStates.set(name, 'STARTING'); // Prevent steady-state monitor from flagging as DOWN during intentional restart
        
        p.removeAllListeners('close');
        p.on('close', () => {
            processes.delete(name);
            resolve();
        });
        
        try {
            p.kill('SIGTERM');
        } catch (e) {
            resolve();
        }
    });
}

// Start all initial services
(async () => {
    // Start them all concurrently
    const startPromises = SERVICES.map(s => startService(s));
    await Promise.all(startPromises);
    
    // Once all initial startup attempts finish, start steady state monitor
    startSteadyStateMonitor();
})();

// File watcher
const watcher = chokidar.watch(['apps/**/src/**', 'libs/**/src/**'], {
    ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.nx/**',
        '**/coverage/**',
        '**/dist/**',
        '**/logs/**',
        '**/tmp/**'
    ],
    persistent: true,
    ignoreInitial: true,
});

watcher.on('change', async (filePath) => {
    // Normalize path separators to forward slashes for matching
    const normalizedPath = filePath.split(path.sep).join('/');
    
    let targetService = null;
    
    const appsMatch = normalizedPath.match(/apps\/([^\/]+)\/src\//);
    if (appsMatch) {
        targetService = appsMatch[1];
    }
    
    if (targetService) {
        const config = SERVICES.find(s => s.name === targetService);
        if (config) {
            console.log(`\n[${targetService}] Source change detected:`);
            console.log(`${normalizedPath}`);
            console.log(`[${targetService}] Restarting...`);
            await startService(config);
        }
    } else if (normalizedPath.includes('/libs/')) {
        console.log(`\n[SERVICE MANAGER] Shared library change detected:`);
        console.log(`${normalizedPath}`);
        console.log(`[SERVICE MANAGER] Restarting all services...`);
        for (const s of SERVICES) {
            await startService(s); // Restart sequentially to avoid completely tanking system on mass shared-lib change
        }
    }
});

process.on('SIGINT', async () => {
    isShuttingDown = true;
    if (steadyStateInterval) clearInterval(steadyStateInterval);
    console.log('\n[SERVICE MANAGER] Shutting down all services...');
    
    for (const [name, p] of processes.entries()) {
        try {
            p.kill();
            console.log(`  Stopped ${name}`);
        } catch (e) {}
    }
    process.exit(0);
});
