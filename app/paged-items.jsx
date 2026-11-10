'use client'

import { useState } from 'react'

export function PagedItems({items, size, label, paginate = true, children}) {
  const [index,setIndex] = useState(0)
  if (!paginate) return children(items)
  const last = Math.max(0,Math.ceil(items.length / size) - 1)
  const page = Math.min(index,last)
  return <>
    {children(items.slice(page * size,(page + 1) * size))}
    {last > 0 && <nav className="customer-pagination" aria-label={label}>
      <button type="button" className="button secondary" aria-label={label + ' ก่อนหน้า'} disabled={page === 0} onClick={() => setIndex(page - 1)}>‹</button>
      <span aria-live="polite">{page + 1} / {last + 1}</span>
      <button type="button" className="button secondary" aria-label={label + ' ถัดไป'} disabled={page === last} onClick={() => setIndex(page + 1)}>›</button>
    </nav>}
  </>
}
