'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { money, statuses, stayTotal } from '../lib/pricing'
import { isRentalStay } from '../lib/rentals'
import { displayDate } from './booking-pickers'
import { RentalPicker } from './rental-picker'
import { CampLoader } from './camp-loader'
import { BookingSteps } from './booking-steps'

function ReviewCostLabel({stay,children}) {
  return <span className="review-cost-label">
    <svg role="img" aria-label={stay ? 'ที่พัก' : 'อุปกรณ์'} width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={stay ? 'M2 20h20L12 4 2 20Zm6 0 4-7 4 7' : 'M3 8h18v12H3zM8 8V5h8v3M3 12h18m-11 0v3h4v-3'}/>
    </svg>
    <span>{children}</span>
  </span>
}

function RemoveAction({row,disabled,select}) {
  return <button type="button" disabled={disabled} onClick={() => select(row.code, 0)}>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16m-10 0V4h4v3M6 7l1 13h10l1-13M10 11v5m4-5v5"/>
    </svg>
    <span>นำ {row.name} ออก</span>
  </button>
}

export function BookingReview({
  ready, loading, availabilityError, selected, nights, total, arrival, departure,
  guestSummary, bookingBusy, bookingError, receipt, book, select, gear, onRetry,
  settings, adults, confirmRentals, hosts, rentalLines, combined, rentalsByLock,
}) {
  const rentalDialog = useRef(null)
  const [rentalDraft, setRentalDraft] = useState({})
  const [activeHost, setActiveHost] = useState(null)
  const [view,setView] = useState('items')
  const lodging = hosts
  const rentals = selected.filter(row => row.kind === 'gear' && !rentalLines.some(line => line.code === row.code))
  const hostRentals = rentalsByLock[activeHost?.code] || {}
  const options = gear.map(row => ({
    ...row,
    available: Math.max(0, Number(row.available) - (combined[row.code] || 0) + (hostRentals[row.code] || 0)),
  }))
  const lodgingTotal = ready ? stayTotal(lodging, settings, adults, nights) : 0
  const personPricing = settings?.mode === 'person'
  const plotCount = lodging.filter(row => row.kind === 'plot').length

  return <section className="review-page" aria-labelledby="review-title">
    <BookingSteps current={2}/>
    <header className="review-heading">
      <h1 id="review-title">ตรวจสอบการจอง</h1>
      <div className="review-badges">
        <span>{arrival ? displayDate(arrival) + ' – ' + displayDate(departure) : 'วันเข้าพัก – วันออก'}</span>
        <span>{guestSummary}</span>
      </div>
    </header>

    {availabilityError && <div className="notice error actions" role="alert">
      <span>{availabilityError}</span><button type="button" className="button secondary" onClick={onRetry}>ลองอีกครั้ง</button>
    </div>}

    <div className="customer-switch" aria-label="ขั้นตอนตรวจสอบการจอง">
      <button type="button" aria-pressed={view === 'items'} onClick={() => setView('items')}>รายการที่จอง</button>
      <button type="button" aria-pressed={view === 'guest'} onClick={() => setView('guest')}>ข้อมูลผู้จองและยอดรวม</button>
    </div>
    <div className="review-grid">
      <section className="panel review-card stack" hidden={view !== 'items'}>
        <h2>รายการที่จอง ({lodging.length} ล็อก / ห้อง)</h2>
        {loading && <CampLoader label="กำลังตรวจสอบรายการที่เลือก…"/>}
        {ready && !selected.length && !receipt && <p className="muted">ยังไม่มีรายการที่เลือก <Link href="/">กลับไปเลือกล็อก</Link></p>}

        {lodging.map(row => <article key={row.code} className="review-line stack">
          <div className="rental-heading">
            <div><h3>{row.kind === 'plot' ? 'Zone ' + row.zone + ' - ' : ''}{row.name}</h3>
              {row.detail && <p className="muted small">{row.detail}</p>}</div>
            {ready && gear.length > 0 && !receipt && <button type="button" className="button secondary rental-open"
              disabled={bookingBusy} aria-label={'+ เช่าอุปกรณ์เพิ่มสำหรับ ' + row.name} onClick={() => {
                setActiveHost(row)
                const current = rentalsByLock[row.code] || {}
                setRentalDraft(Object.fromEntries(gear.map(item => [
                  item.code, Math.min(current[item.code] || 0, Math.max(0, Number(item.available) - (combined[item.code] || 0) + (current[item.code] || 0))),
                ])))
                rentalDialog.current.showModal()
                rentalDialog.current.scrollTop = 0
              }}>+ เช่าอุปกรณ์เพิ่ม</button>}
          </div>
          <div className="review-cost">
            <ReviewCostLabel stay>{personPricing && row.kind === 'plot'
              ? money(settings.person_price) + ' / คน / คืน'
              : money(row.price) + ' / คืน'} × {nights || '–'} คืน</ReviewCostLabel>
            {(!personPricing || row.kind !== 'plot') && <strong>{money(row.price * nights * (row.kind === 'room' ? row.quantity : 1))}</strong>}
          </div>
          {rentalLines.filter(line => line.host === row.code).map(line => {
            const rental = gear.find(item => item.code === line.code)
            return <div className="review-cost small" key={line.code}>
              <ReviewCostLabel stay={isRentalStay(rental)}>{rental.name} × {line.quantity}</ReviewCostLabel>
              <strong>{money(rental.price * line.quantity * nights)}</strong>
            </div>
          })}
          <div className="review-line-actions">
            <Link href="/" aria-label={'แก้ไข ' + row.name}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14 6 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>
              </svg>
              <span>แก้ไข</span>
            </Link>
            <RemoveAction row={row} disabled={bookingBusy} select={select}/>
          </div>
        </article>)}
        {personPricing && plotCount > 0 && <div className="review-cost review-lodging-subtotal">
          <span>รวมค่าลานตามจำนวนคน{plotCount > 1 && settings.minimum_per_plot > 0
            ? ' · ขั้นต่ำ ' + settings.minimum_per_plot + ' คนต่อล็อก' : ''}</span>
          <span>{money(lodgingTotal - lodging.filter(row => row.kind === 'room').reduce((sum, row) => sum + row.price * row.quantity * nights, 0))}</span>
        </div>}

        {rentals.map(row => <article key={row.code} className="review-line stack">
          <h3>{row.name} × {row.quantity}</h3>
          <div className="review-cost">
            <ReviewCostLabel stay={isRentalStay(row)}>{money(row.price)} / คืน × {nights || '–'} คืน</ReviewCostLabel>
            <strong>{money(row.price * row.quantity * nights)}</strong>
          </div>
          <div className="review-line-actions"><RemoveAction row={row} disabled={bookingBusy} select={select}/></div>
        </article>)}

        <div className="review-cost review-total"><strong>ยอดรวม</strong><strong>{money(total)}</strong></div>
        <button type="button" className="button" onClick={() => setView('guest')}>กรอกข้อมูลผู้จอง →</button>
      </section>

      <form className="review-form stack" onSubmit={book} hidden={view !== 'guest'}>
        <section className="panel review-card stack">
          <h2>ข้อมูลผู้จอง</h2>
          <label className="review-field">ชื่อผู้จอง<input name="guest" autoComplete="name" maxLength={120} required disabled={bookingBusy || !!receipt}/></label>
          <label className="review-field">เบอร์โทร<input name="phone" type="tel" autoComplete="tel" maxLength={24} required disabled={bookingBusy || !!receipt}/></label>
        </section>
        <section className="panel review-card stack">
          <h2>สรุปค่าใช้จ่าย</h2>
          <div className="review-breakdown">
            <div className="review-cost"><span>ค่าล็อก / ห้องพัก</span><span>{money(lodgingTotal)}</span></div>
            <div className="review-cost"><span>ค่าอุปกรณ์</span><span>{money(total - lodgingTotal)}</span></div>
          </div>
          <div className="review-cost review-total"><strong>รวมค่าเข้าพักทั้งหมด</strong><strong>{money(receipt?.total ?? total)}</strong></div>
          <p className="small">เลื่อนวันเข้าพักได้ไม่เกิน 3 ครั้ง โดยแจ้งล่วงหน้าอย่างน้อย 3 วัน</p>
          {receipt ? <div className="notice" role="status"><strong>บันทึกคำขอแล้ว</strong><br/>รหัสจอง <code>{receipt.id}</code><br/>{statuses[receipt.status]}</div>
            : <button className="button" disabled={!ready || !selected.length || bookingBusy}>
              {bookingBusy ? 'กำลังบันทึก…' : 'ยืนยันการจอง ' + money(total) + ' →'}
            </button>}
          {bookingError && <p className="notice error" role="alert">{bookingError}</p>}
        </section>
      </form>
    </div>
    <RentalPicker dialog={rentalDialog} rows={options} draft={rentalDraft} setDraft={setRentalDraft}
      hostName={activeHost?.name} onConfirm={quantities => confirmRentals(activeHost.code, quantities)}/>
  </section>
}
