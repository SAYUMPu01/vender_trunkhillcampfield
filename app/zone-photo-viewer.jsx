'use client'

import { useEffect, useRef, useState } from 'react'
import './zone-photo-viewer.css'

export function ZonePhotoViewer({photos,index,onChange,onClose}) {
  const dialog = useRef(null)
  const stage = useRef(null)
  const [zoomed,setZoomed] = useState(false)
  const {src,alt} = photos[index]
  const multiple = photos.length > 1

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal()
  },[])

  useEffect(() => {
    const element = stage.current
    element.scrollLeft = zoomed ? (element.scrollWidth - element.clientWidth) / 2 : 0
    element.scrollTop = zoomed ? (element.scrollHeight - element.clientHeight) / 2 : 0
  },[index,zoomed])

  function move(step) {
    setZoomed(false)
    onChange((index + step + photos.length) % photos.length)
  }

  function handleKeys(event) {
    if (!multiple || (zoomed && event.target === stage.current)) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      move(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  return <dialog ref={dialog} className="zone-photo-viewer" aria-label="ดูภาพขนาดใหญ่"
    onKeyDown={handleKeys} onClose={event => {
      event.stopPropagation()
      onClose()
    }}>
    <div className="zone-photo-viewer-layout">
      <header className="zone-photo-viewer-header">
        <p>{alt}</p>
        <form method="dialog">
          <button className="zone-photo-viewer-button" aria-label="ปิดภาพขนาดใหญ่">×</button>
        </form>
      </header>
      <div ref={stage} className="zone-photo-viewer-stage" data-zoomed={zoomed} tabIndex={zoomed ? 0 : undefined}
        role={zoomed ? 'region' : undefined} aria-label={zoomed ? 'เลื่อนดูภาพที่ซูม' : undefined}>
        <img src={src} alt={alt}/>
      </div>
      <div className="zone-photo-viewer-controls">
        {multiple && <div className="zone-photo-viewer-navigation">
          <button type="button" className="zone-photo-viewer-button" aria-label="ภาพก่อนหน้า" onClick={() => move(-1)}>‹</button>
          <span aria-live="polite">{index + 1} / {photos.length}</span>
          <button type="button" className="zone-photo-viewer-button" aria-label="ภาพถัดไป" onClick={() => move(1)}>›</button>
        </div>}
        <button type="button" className="zone-photo-viewer-button" onClick={() => setZoomed(value => !value)}>
          {zoomed ? 'ย่อภาพ' : 'ซูมภาพ'}
        </button>
      </div>
    </div>
  </dialog>
}
