import { UserCheck, Filter } from 'lucide-react'

export default function AuditUserView({ history = [], onSelectUser }) {
  // Group actions by user
  const userMap = {}

  history.forEach((event) => {
    const userId = event.userId || event.userName || 'System'
    if (!userMap[userId]) {
      userMap[userId] = {
        userId,
        userName: event.userName || 'System',
        userRole: event.userRole || 'User',
        totalChanges: 0,
        latestActivity: event.createdAt,
        creates: 0,
        updates: 0,
        deletes: 0,
      }
    }

    userMap[userId].totalChanges += 1
    const act = (event.action || '').toUpperCase()
    if (act === 'CREATE') userMap[userId].creates += 1
    else if (act === 'UPDATE') userMap[userId].updates += 1
    else if (act === 'DELETE') userMap[userId].deletes += 1
  })

  // Add sample demo users if empty
  if (Object.keys(userMap).length === 0) {
    userMap['Disha Radadiya'] = {
      userId: '65f1a2b3c4d5e6f7a8b9c0d1',
      userName: 'Disha Radadiya',
      userRole: 'super admin',
      totalChanges: 8,
      latestActivity: '2025-05-08T15:25:00Z',
      creates: 1,
      updates: 6,
      deletes: 1,
    }
    userMap['Amit Patel'] = {
      userId: '65f1a2b3c4d5e6f7a8b9c0d2',
      userName: 'Amit Patel',
      userRole: 'manager',
      totalChanges: 5,
      latestActivity: '2025-05-08T15:20:00Z',
      creates: 2,
      updates: 3,
      deletes: 0,
    }
    userMap['Priya Sharma'] = {
      userId: '65f1a2b3c4d5e6f7a8b9c0d3',
      userName: 'Priya Sharma',
      userRole: 'team lead',
      totalChanges: 3,
      latestActivity: '2025-05-08T15:15:00Z',
      creates: 0,
      updates: 3,
      deletes: 0,
    }
    userMap['Rahul Mehta'] = {
      userId: '65f1a2b3c4d5e6f7a8b9c0d4',
      userName: 'Rahul Mehta',
      userRole: 'executive',
      totalChanges: 2,
      latestActivity: '2025-05-08T15:10:00Z',
      creates: 0,
      updates: 1,
      deletes: 1,
    }
  }

  const usersList = Object.values(userMap)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {usersList.map((user) => (
        <div
          key={user.userId}
          onClick={() => onSelectUser?.(user.userId)}
          className="p-4 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] hover:border-primary/50 transition-all cursor-pointer shadow-xs space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {user.userName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--vz-heading)] group-hover:text-primary transition-colors">
                  {user.userName}
                </h4>
                <div className="text-[11px] text-[var(--vz-text-muted)] capitalize">
                  {user.userRole}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-extrabold text-primary">
                {user.totalChanges} changes
              </div>
              <div className="text-[10px] text-[var(--vz-text-muted)]">
                Latest: {new Date(user.latestActivity).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--vz-border)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[11px] text-[var(--vz-text-muted)]">
              {user.updates > 0 && <span className="text-emerald-600 font-semibold">{user.updates} Updates</span>}
              {user.creates > 0 && <span className="text-blue-600 font-semibold">{user.creates} Creates</span>}
              {user.deletes > 0 && <span className="text-rose-600 font-semibold">{user.deletes} Deletes</span>}
            </div>

            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Filter size={11} />
              <span>Filter Timeline</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
