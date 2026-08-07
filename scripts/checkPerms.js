const { env } = require('@sparkcrm/shared-config');
const mongoose = require('mongoose');

(async () => {
    try {
        // Connect to auth DB for users
        const authConn = await mongoose.createConnection(env.MONGO.AUTH).asPromise();
        const users = await authConn.db.collection('users')
            .find({}, { projection: { email: 1, name: 1, role: 1, roleId: 1, tenantId: 1 } })
            .limit(10).toArray();

        console.log('=== USERS ===');
        users.forEach(u => console.log(JSON.stringify({
            email: u.email, name: u.name, role: u.role,
            roleId: u.roleId ? u.roleId.toString() : 'NULL',
        })));

        // Connect to tenant DB for roles
        const tenantConn = await mongoose.createConnection(env.MONGO.TENANT).asPromise();
        const roleIds = users.map(u => u.roleId).filter(Boolean);
        const roles = await tenantConn.db.collection('roles')
            .find({ _id: { $in: roleIds } })
            .toArray();

        console.log('\n=== ROLES (matched to users) ===');
        roles.forEach(r => {
            const map = {};
            (r.permissions || []).forEach(p => { map[p.moduleKey] = p.actions; });
            console.log(JSON.stringify({
                id: r._id.toString(), name: r.name, slug: r.slug,
                leads: map.leads || 'NOT_SET',
                calls: map.calls || 'NOT_SET',
            }));
        });

        await authConn.close();
        await tenantConn.close();
        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
