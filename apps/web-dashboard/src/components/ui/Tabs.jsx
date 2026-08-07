export default function Tabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`flex border-b border-[var(--vz-border)] ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px
            ${activeTab === tab.key
              ? 'text-primary border-primary'
              : 'text-[var(--vz-text-muted)] border-transparent hover:text-[var(--vz-heading)] hover:border-[var(--vz-border)]'
            }`}
        >
          {tab.icon && <tab.icon size={16} className="inline mr-1.5 -mt-0.5" />}
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
