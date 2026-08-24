import DatePicker from './DatePicker'
import TimePicker from './TimePicker'

export default function Input({
  label, type = 'text', placeholder, value, onChange, error, className = '',
  icon: Icon, disabled = false, ...props
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-[var(--vz-heading)]">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && type !== 'date' && type !== 'time' && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]">
            <Icon size={16} />
          </div>
        )}
        
        {type === 'date' ? (
          <DatePicker 
            value={value} 
            onChange={onChange} 
            placeholder={placeholder} 
            disabled={disabled}
          />
        ) : type === 'time' ? (
          <TimePicker 
            value={value} 
            onChange={onChange} 
            placeholder={placeholder} 
            disabled={disabled}
          />
        ) : (
          <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`w-full rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)]
              text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)]
              px-3 py-2 outline-none transition-all duration-200
              focus:border-primary focus:ring-1 focus:ring-primary/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${Icon ? 'pl-9' : ''}
              ${error ? 'border-danger focus:border-danger focus:ring-danger/30' : ''}`}
            {...props}
          />
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
