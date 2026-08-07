import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export default function Table({ columns, data, onRowClick, emptyMessage = 'No data found' }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (!key) return
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = a[sortKey] ?? ''
        const bVal = b[sortKey] ?? ''
        const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--vz-table-header-bg)]">
            {columns.map((col) => (
              <th
                key={col.key || col.label}
                onClick={() => col.sortable && handleSort(col.key)}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide
                  ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--vz-heading)]' : ''}
                  ${col.className || ''}`}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--vz-text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, i) => (
              <tr
                key={row._id || i}
                onClick={() => onRowClick?.(row)}
                className={`border-t border-[var(--vz-border)] hover:bg-[var(--vz-table-hover-bg)] transition-colors
                  ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key || col.label} className={`px-4 py-3 ${col.cellClassName || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
