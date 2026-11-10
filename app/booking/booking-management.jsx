'use client'

import { useRef, useState } from 'react'
import { rescheduleLimit, rescheduleNotice, stayNights } from '../../lib/booking-dates'
import { money, statuses } from '../../lib/pricing'
import { DatePicker, displayDate, guestTypes } from '../booking-pickers'
import { readCamp } from '../camp-request'
import { PlotMap } from '../plot-map'
import { CampLoader } from '../camp-loader'
import { CampHeader, MobileCampMenu, useCampDetails } from '../camp-navigation'

const dateRange = ({arrival,departure}) => displayDate(arrival) + ' – ' + displayDate(departure)

function BookingSummary({booking}) {
  const status = booking.checked_out ? 'Check-out แล้ว' : booking.status === 'pending' && booking.payment_required
    ? (booking.payment_submitted ? 'รอตรวจสอบการชำระเงิน' : 'รอชำระเงิน') : statuses[booking.status]
  const guests = guestTypes.map(([key,label]) => label + ' ' + booking[key]).join(' · ')
  return <section className="panel stack booking-summary" aria-labelledby="booking-summary-title">
    <div className="section-head"><h2 id="booking-summary-title">รายละเอียดการจอง</h2><span className="notice">{status}</span></div>
    <dl className="booking-summary-fields">
      <div className="booking-summary-code"><dt>รหัสการจอง</dt><dd><code>{booking.id}</code></dd></div>
      <div><dt>ชื่อผู้จอง</dt><dd>{booking.guest}</dd></div>
      <div><dt>วันที่จองไว้</dt><dd>{dateRange(booking)} · {stayNights(booking.arrival,booking.departure)} คืน</dd></div>
      <div className="booking-summary-guests"><dt>จำนวนผู้เข้าพัก</dt><dd>{booking.adults + booking.children + booking.seniors} คน<br/><small>{guests}</small></dd></div>
    </dl>
    <div>
      <h3>ล็อก ห้องพัก และอุปกรณ์</h3>
      <ul className="booking-summary-lines" role="list">
        {booking.lines.map(line => <li key={line.code}>
          <div><strong>{line.name} × {line.quantity}</strong>
            <small>{booking.rentalLines.filter(rental => rental.code === line.code)
              .map(rental => rental.host + ' × ' + rental.quantity).join(' · ')}</small>
          </div>
          <span>{money(line.amount)}</span>
        </li>)}
      </ul>
    </div>
    <div className="review-cost review-total"><strong>ยอดจอง</strong><strong>{money(booking.total)}</strong></div>
  </section>
}

export function BookingManagement() {
  const [booking,setBooking] = useState(null)
  const [phone,setPhone] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [dates,setDates] = useState(null)
  const [pickerKey,setPickerKey] = useState(0)
  const [editView,setEditView] = useState('map')
  const dialog = useRef(null)
  const {dialogs,...menuActions} = useCampDetails()

  async function search(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const searchPhone = String(fields.get('phone'))
    setBusy(true)
    setBooking(null)
    setError('')
    setMessage('')
    try {
      setBooking(await readCamp('/api/camp',{action:'lookup',id:String(fields.get('id')).trim(),phone:searchPhone}))
      setPhone(searchPhone)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirm(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await readCamp('/api/camp',{
        action:'reschedule',id:booking.id,phone,revision:booking.reschedule_count,...dates,
      })
      setBooking(updated)
      setDates(null)
      setMessage('เลื่อนวันเข้าพักสำเร็จ')
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const editing = !!dates
  const changed = editing && dates.arrival !== booking.arrival
  const remaining = booking ? Math.max(0,rescheduleLimit - booking.reschedule_count) : 0
  const originalPlots = booking?.lines.filter(line => line.kind === 'plot') ?? []
  return <div className="camp-home customer-compact booking-management">
    <CampHeader onCampInfo={menuActions.onCampInfo} lookup/>
    <main className={'camp-shell stack manage-booking' + (booking ? '' : ' manage-booking-search')}>
      {!booking && <form onSubmit={search} className="panel stack booking-lookup" aria-labelledby="booking-lookup-title">
        <div className="booking-lookup-intro">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/>
          </svg>
          <h1 id="booking-lookup-title">ตรวจสอบการจอง</h1>
          <p>กรอกรหัสการจองและเบอร์โทรผู้จองเพื่อดูรายละเอียด</p>
        </div>
        <div className="booking-lookup-fields">
          <label>รหัสการจอง<input name="id" required maxLength={20} autoCapitalize="characters" spellCheck={false}
            placeholder="รหัส 20 ตัวอักษร" disabled={busy}/></label>
          <label>เบอร์โทรผู้จอง<input name="phone" type="tel" autoComplete="tel" required maxLength={24}
            placeholder="เบอร์ที่ใช้ตอนจอง" disabled={busy}/></label>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button type="submit" className="button" disabled={busy}>{busy ? 'กำลังค้นหา…' : 'ค้นหาการจอง'}</button>
        {busy && <CampLoader label="กำลังค้นหาการจอง…"/>}
      </form>}
      {booking && <>
        <h1>{editing ? 'เลือกวันเข้าพักใหม่' : 'ตรวจสอบการจอง'}</h1>
        {error && <p className="notice error" role="alert">{error}</p>}
        {busy && <CampLoader label="กำลังตรวจสอบวันใหม่…"/>}
        {message && <p className="notice" role="status">{message}</p>}
        <p className="notice">เลื่อนได้ไม่เกิน {rescheduleLimit} ครั้ง · เหลือ {remaining} ครั้ง
          <br/>เลื่อนอย่างน้อย {rescheduleNotice} วันก่อนวันเข้าพักเดิม</p>
        {editing && <div className="customer-switch" aria-label="การเลื่อนวันเข้าพัก">
          <button type="button" aria-pressed={editView === 'map'} onClick={() => setEditView('map')}>เลือกวันใหม่</button>
          <button type="button" aria-pressed={editView === 'details'} onClick={() => setEditView('details')}>การจองเดิม</button>
          <button type="button" disabled={busy} onClick={() => { setDates(null); setError('') }}>ยกเลิกการเลื่อน</button>
        </div>}
        {editing && editView === 'map' && <form onSubmit={confirm} className="panel stack camp-panel">
          <div className="camp-controls">
            <button type="button" className="camp-control" disabled={busy} onClick={() => {
              setPickerKey(key => key + 1)
              dialog.current.showModal()
              dialog.current.scrollTop = 0
            }}><span>เลือกวันเข้าพักใหม่</span><strong>{changed ? dateRange(dates) : 'เลือกวันที่'}</strong></button>
            <div className="camp-control"><span>จำนวนคืนตามการจองเดิม</span><strong>{stayNights(booking.arrival,booking.departure)} คืน</strong></div>
            <button className="button" disabled={!changed || busy}>{busy ? 'กำลังตรวจสอบและบันทึก…' : 'ยืนยันเลื่อนวันเข้าพัก'}</button>
          </div>
          {originalPlots.length > 0 && <div className="stack">
            <h2>ผังล็อกที่จองไว้</h2>
            <PlotMap rows={originalPlots} counts={Object.fromEntries(originalPlots.map(row => [row.code,row.quantity]))}
              ready readOnly mapVersion={booking.map_version}/>
          </div>}
        </form>}
        {!editing && <div className="actions">
          {booking.reschedule_block
          ? <p className="muted">{booking.reschedule_block}</p>
          : <button className="button" type="button" disabled={busy} onClick={() => {
            setDates({arrival:booking.arrival,departure:booking.departure})
            setEditView('map')
            setMessage('')
            setError('')
          }}>เลื่อนวันเข้าพัก</button>}
          <button type="button" className="button secondary" disabled={busy} onClick={() => {
            setBooking(null)
            setPhone('')
            setMessage('')
            setError('')
          }}>ค้นหาอีกครั้ง</button>
        </div>}
        {(!editing || editView === 'details') && <BookingSummary key={booking.id} booking={booking}/>}
        {editing && <dialog ref={dialog} className="dialog booking-picker" aria-labelledby="date-title">
          <form method="dialog" className="dialog-close"><button className="button secondary" aria-label="ปิดตัวเลือกวันที่">×</button></form>
          <DatePicker key={pickerKey} dialog={dialog} {...dates} today={booking.today} fixedNights={stayNights(booking.arrival,booking.departure)}
            onConfirm={(arrival,departure) => {setDates({arrival,departure}); setError('')}}/>
        </dialog>}
      </>}
    </main>
    <MobileCampMenu page="lookup" {...menuActions}/>
    {dialogs}
  </div>
}
