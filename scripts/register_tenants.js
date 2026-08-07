const http = require('http');

async function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function registerTenant(companyName, email, phone, planSlug) {
    console.log(`\n🚀 Registering ${companyName} (${planSlug})...`);

    // 1. Send OTP
    console.log(`  1. Sending OTP to ${email}...`);
    const otpRes = await request('POST', '/api/auth/send-otp', { email, phone });
    if (otpRes.status !== 200) {
        throw new Error(`OTP send failed: ${JSON.stringify(otpRes.data)}`);
    }

    // 2. Verify OTP (DEV_OTP is 123456)
    console.log(`  2. Verifying OTP (123456)...`);
    const verifyRes = await request('POST', '/api/auth/verify-otp', {
        email, phone, emailOtp: '123456', phoneOtp: '123456'
    });
    if (verifyRes.status !== 200) {
        throw new Error(`OTP verify failed: ${JSON.stringify(verifyRes.data)}`);
    }

    // 3. Register Tenant
    console.log(`  3. Registering tenant...`);
    const regRes = await request('POST', '/api/auth/register-tenant', {
        name: `${companyName} Admin`,
        email,
        phone,
        password: 'Password@123',
        companyName,
        planSlug
    });

    if (regRes.status === 201) {
        console.log(`  ✅ Successfully registered: ${companyName} (${email} / Password@123)`);
    } else {
        throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
    }
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   SparkCRM Tenant Registration Script                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    await delay(2000); // Give API time to settle

    try {
        await registerTenant('Acme Corp', 'admin@acmecorp.com', '9876543210', 'basic');
        await delay(1000);
        await registerTenant('Global Tech', 'admin@globaltech.com', '9876543211', 'free');

        console.log('\n🎉 All tenants registered successfully!');
    } catch (err) {
        console.error('\n❌ Script failed:', err.message);
    }
}

main().catch(console.error);
