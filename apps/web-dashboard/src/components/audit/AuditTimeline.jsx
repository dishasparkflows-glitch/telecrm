import AuditTimelineItem from './AuditTimelineItem'

export default function AuditTimeline({ events = [], onViewChanges }) {
  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--vz-text-muted)] text-xs">
        No history events recorded yet for this record.
      </div>
    )
  }

  return (
    <div className="pt-2">
      {events.map((event, idx) => (
        <AuditTimelineItem
          key={event._id || idx}
          event={event}
          isLast={idx === events.length - 1}
          onViewChanges={onViewChanges}
        />
      ))}
    </div>
  )
}
