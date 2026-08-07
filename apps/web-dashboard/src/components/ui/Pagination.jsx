import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }) {
  if (totalPages <= 1) return null

  const pages = []
  const showEllipsis = totalPages > 7

  if (showEllipsis) {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  } else {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
      {totalItems !== undefined && (
        <p className="text-xs text-[var(--vz-text-muted)]">
          Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to{' '}
          {Math.min(currentPage * pageSize, totalItems)} of {totalItems} Results
        </p>
      )}

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-md text-[var(--vz-text-muted)] hover:bg-[var(--vz-input-bg)] disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-[var(--vz-text-muted)]">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors
                ${currentPage === page
                  ? 'bg-primary text-white'
                  : 'text-[var(--vz-text)] hover:bg-[var(--vz-input-bg)]'
                }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md text-[var(--vz-text-muted)] hover:bg-[var(--vz-input-bg)] disabled:opacity-40 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
