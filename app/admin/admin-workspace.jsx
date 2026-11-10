'use client'

import { useState } from 'react'

export function AdminWorkspace({ sidebar, title, section, children }) {
  const [menuOpen, setMenuOpen] = useState(true)

  return <main className="admin-workspace" data-menu-open={menuOpen} data-section={section}>
    <aside id="admin-sidebar" className="admin-sidebar" hidden={!menuOpen}>{sidebar}</aside>
    <div className="admin-main">
      <header className="admin-top">
        <div className="admin-top-title">
          <button type="button" className="button secondary admin-menu-toggle"
            aria-controls="admin-sidebar" aria-expanded={menuOpen}
            aria-label={menuOpen ? 'ย่อเมนู' : 'ขยายเมนู'}
            title={menuOpen ? 'ย่อเมนู' : 'ขยายเมนู'}
            onClick={() => setMenuOpen(open => !open)}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1>{title}</h1>
        </div>
        <span className="admin-status confirmed">ผู้ดูแลระบบ</span>
      </header>
      {children}
    </div>
  </main>
}
