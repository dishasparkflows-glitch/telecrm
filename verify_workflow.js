const mongoose = require('mongoose');
const IORedis = require('ioredis');
const { env } = require('@sparkcrm/shared-config');
const { AutomationRule, AutomationLog } = require('./apps/automation-service/src/models/AutomationRule');

async function testWorkflow() {
    await mongoose.connect(env.MONGO_URI || 'mongodb://localhost:27017/sparkcrm');
    console.log('Connected to DB');

    const tenantId = new mongoose.Types.ObjectId().toString();

    // 1. Create a Workflow Rule
    const rule = await AutomationRule.create({
        name: 'Test Lead Processing',
        tenantId,
        type: 'workflow',
        status: 'active',
        trigger: {
            event: 'lead.created',
            conditions: [{ field: 'source', operator: 'equals', value: 'api' }]
        },
        nodes: [
            { id: 'trigger_1', type: 'trigger' },
            { id: 'condition_1', type: 'condition', conditions: [{ field: 'score', operator: 'greater_than', value: '50' }] },
            { id: 'action_true', type: 'action', actionType: 'add_tag', config: { tag: 'hot-lead' } },
            { id: 'action_false', type: 'action', actionType: 'add_tag', config: { tag: 'cold-lead' } },
        ],
        edges: [
            { id: 'edge_1', source: 'trigger_1', target: 'condition_1' },
            { id: 'edge_2', source: 'condition_1', target: 'action_true', sourceHandle: 'true' },
            { id: 'edge_3', source: 'condition_1', target: 'action_false', sourceHandle: 'false' },
        ]
    });

    console.log('Created rule:', rule._id);

    // 2. Publish Event
    const redis = new IORedis(env.REDIS_URL || 'redis://localhost:6379');
    
    // The shared-events package publishes to `events` channel with a specific payload format
    const eventPayload = JSON.stringify({
        channel: 'lead.created',
        data: {
            tenantId,
            leadId: new mongoose.Types.ObjectId().toString(),
            source: 'api',
            score: 75, // Should trigger true path
        },
        timestamp: new Date().toISOString()
    });

    await redis.publish('events', eventPayload);
    console.log('Event published');

    // Wait a few seconds for queues to process
    await new Promise(r => setTimeout(r, 5000));

    // 3. Verify Log
    const logs = await AutomationLog.find({ ruleId: rule._id }).lean();
    console.log('Logs found:', logs.length);
    if (logs.length > 0) {
        console.log('Latest Log Status:', logs[0].status);
        console.log('Nodes Executed:', logs[0].nodeExecutions);
    }

    process.exit(0);
}

testWorkflow().catch(console.error);
