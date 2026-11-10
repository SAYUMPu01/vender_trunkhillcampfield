'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { zones } from '../lib/pricing'
import { readBookingDraft } from './booking-draft'
import { ZoneDetailsDialog } from './zone-details-dialog'

export const campZoneLabel = zone => zone === 'BOX' ? 'Trunkbox' : 'Zone ' + zone

function CampInfoDialog({dialog}) {
  return <dialog ref={dialog} className="dialog zone-details-dialog camp-info-dialog" aria-labelledby="camp-info-title">
    <form method="dialog" className="dialog-close"><button className="button secondary" aria-label="ปิดรายละเอียดแคมป์">×</button></form>
    <header className="zone-dialog-heading"><h2 id="camp-info-title">รายละเอียดแคมป์</h2></header>
    <div className="stack">
      <img src="/camp-field.webp" alt="บรรยากาศลานกางเต็นท์และภูเขาที่ Trunkhill" loading="lazy"/>
      <p>Zone A เป็นลานขนาด 10 × 10 เมตรต่อล็อก มองเห็นวิวภูเขาด้านหน้าและด้านข้าง</p>
      <p>เด็กอายุไม่เกิน 13 ปีและผู้สูงอายุ 65 ปีขึ้นไปเข้าพักฟรีตามราคาต่อคน</p>
      <p>เลื่อนวันเข้าพักได้ไม่เกิน 3 ครั้ง โดยเลื่อนล่วงหน้าอย่างน้อย 3 วันก่อนวันเข้าพักเดิม</p>
      <div className="actions"><Link href="/booking" onClick={() => dialog.current.close()}>ตรวจสอบหรือเลื่อนการจอง</Link><a href="tel:0992277700">โทร 099-227-7700</a></div>
    </div>
  </dialog>
}

export function useCampDetails({zone,gear} = {}) {
  const campDialog = useRef(null)
  const [detailsZone,setDetailsZone] = useState(null)

  function openZoneDetails() {
    const selected = zone ?? readBookingDraft()?.zone
    setDetailsZone(zones.includes(selected) ? selected : zones[0])
  }

  return {
    onZoneDetails:openZoneDetails,
    onCampInfo:() => {
      campDialog.current.showModal()
      campDialog.current.scrollTop = 0
    },
    dialogs:<>
      <CampInfoDialog dialog={campDialog}/>
      {detailsZone && <ZoneDetailsDialog zone={detailsZone} label={campZoneLabel(detailsZone)}
        gear={gear} onClose={() => setDetailsZone(null)}/>}
    </>,
  }
}

export function CampHeader({onCampInfo,lookup = false}) {
  return <header className="camp-header"><div className="camp-shell camp-header-inner">
    <Link href="/" className="brand" aria-label="Trunkhill Campfield · หน้าจองลาน">
      <img src="/camp-logo-transparent.webp" alt="Trunkhill Campfield" width="145" height="92"/>
    </Link>
    <nav className="actions camp-header-actions" aria-label="ข้อมูลการจอง">
      <Link className="button secondary" href="/booking" aria-current={lookup ? 'page' : undefined}>ตรวจสอบการจอง</Link>
      <button type="button" className="button secondary" aria-haspopup="dialog" onClick={onCampInfo}>รายละเอียดแคมป์</button>
    </nav>
  </div></header>
}

export function MobileCampMenu({page,onZoneDetails,onCampInfo,summary}) {
  const bookingCurrent = page === 'home' ? 'page' : page === 'flow' ? 'location' : undefined
  return <div className="camp-mobile-dock">
    {summary && <div className="camp-shell camp-mobile-summary">{summary}</div>}
    <nav className="camp-shell camp-mobile-actions" aria-label="เมนูลูกค้า">
      <Link className="button secondary" href="/" aria-current={bookingCurrent}>
        <svg className="camp-menu-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-12 5 2 2 4-4"/></svg>
        <span className="camp-menu-label">การจอง</span>
      </Link>
      <button type="button" className="button secondary" onClick={onZoneDetails} aria-haspopup="dialog">
        <svg className="camp-menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/></svg>
        <span className="camp-menu-label"><span>ดูรายละเอียด</span><span>ลาน</span></span>
      </button>
      <Link className="button secondary" href="/booking" aria-current={page === 'lookup' ? 'page' : undefined}>
        <svg className="camp-menu-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/></svg>
        <span className="camp-menu-label"><span>ตรวจสอบ</span><span>การจอง</span></span>
      </Link>
      <button type="button" className="button secondary" onClick={onCampInfo} aria-haspopup="dialog">
        <svg className="camp-menu-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>
        <span className="camp-menu-label"><span>รายละเอียด</span><span>แคมป์</span></span>
      </button>
    </nav>
  </div>
}
