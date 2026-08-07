const axios = require('axios');

async function main() {
    try {
        const planSlug = 'professional';
        const tenantServiceUrl = 'http://localhost:8002';
        const planRes = await axios.get(`${tenantServiceUrl}/internal/plans/${planSlug}`);
        const plan = planRes.data?.data;
        console.log('Returned plan object keys:', Object.keys(plan));
        console.log('plan._id:', plan._id);
        console.log('plan.id:', plan.id);
        console.log('plan.slug:', plan.slug);
    } catch (err) {
        console.error(err.message);
    }
}

main();
