import Card from '../../components/ui/Card'
import { Activity } from 'lucide-react'

export default function OwnerActivity() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xl font-black text-[var(--vz-heading)]">Activity Logs</h4>
        <p className="text-sm text-[var(--vz-text-muted)] mt-1">System-wide activity and audit trail</p>
      </div>

      <Card>
        <div className="text-center py-12 text-[var(--vz-text-muted)]">
          <Activity size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Activity Logs Coming Soon</p>
          <p className="text-xs mt-1">This feature will show real-time system activity across all tenants.</p>
        </div>
      </Card>
    </div>
  )
}
