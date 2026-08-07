const { spawn } = require('child_process');
const fs = require('fs');
const svc = process.argv[2] || 'tenant-service';
console.log(`--- Debug: starting ${svc} ---\n`);
const p = spawn('node', ['src/main.js'], {
    cwd: `apps/${svc}`,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' },
});
let out = '';
p.stdout.on('data', d => { const s = d.toString(); out += s; process.stdout.write(s); });
p.stderr.on('data', d => { const s = d.toString(); out += '[STDERR] ' + s; process.stderr.write(s); });
p.on('close', code => {
    console.log(`\n--- ${svc} exited with code ${code} ---`);
    fs.writeFileSync(`debug_${svc}.log`, out);
    process.exit(code || 0);
});
setTimeout(() => {
    console.log(`\n--- ${svc} still running after 20s (OK) ---`);
    fs.writeFileSync(`debug_${svc}.log`, out);
    p.kill();
    process.exit(0);
}, 20000);
