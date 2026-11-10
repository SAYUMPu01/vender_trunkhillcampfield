'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { money, stayTotal, zones } from '../lib/pricing'
import { DatePicker, GuestPicker, displayDate, guestTypes } from './booking-pickers'
import { BookingReview } from './booking-review'
import { BookingSteps } from './booking-steps'
import { CampHeader, campZoneLabel, MobileCampMenu, useCampDetails } from './camp-navigation'
import { draftKey, readBookingDraft } from './booking-draft'
import { PlotMap } from './plot-map'
import { readCamp as read } from './camp-request'
import { CampLoader } from './camp-loader'
import { mapPosition } from '../lib/plot-map'

const tabs = zones.map(zone => [zone,campZoneLabel(zone)])
const thaiDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' })
const nextDay = value => new Date(Date.parse(value) + 86400000).toISOString().slice(0,10)
const dayCount = (a,b) => (Date.parse(b) - Date.parse(a)) / 86400000
const compactDateRange = (arrival,departure) => arrival.slice(0,7) === departure.slice(0,7)
  ? Number(arrival.slice(-2)) + '–' + displayDate(departure)
  : displayDate(arrival) + ' – ' + displayDate(departure)

export default function CampPage({ review = false }) {
  const router = useRouter()
  const [zone,setZone] = useState('A')
  const [mapZone,setMapZone] = useState('')
  const [view,setView] = useState('map')
  const [arrival,setArrival] = useState('')
  const [departure,setDeparture] = useState('')
  const [today,setToday] = useState('')
  const [datePickerKey,setDatePickerKey] = useState(0)
  const [checked,setChecked] = useState(null)
  const [catalog,setCatalog] = useState(null)
  const [counts,setCounts] = useState({})
  const [rentalsByLock,setRentalsByLock] = useState({})
  const [guests,setGuests] = useState({adults:0,children:0,seniors:0})
  const [guestWarning,setGuestWarning] = useState(false)
  const [availabilityError,setAvailabilityError] = useState('')
  const [bookingError,setBookingError] = useState('')
  const [loading,setLoading] = useState(false)
  const [bookingBusy,setBookingBusy] = useState(false)
  const [receipt,setReceipt] = useState(null)
  const request = useRef(null)
  const activeCheck = useRef(null)
  const mapDialog = useRef(null)
  const dateDialog = useRef(null)
  const guestDialog = useRef(null)
  const guestWarningDialog = useRef(null)
  const {dialogs,...menuActions} = useCampDetails({zone,gear:catalog?.inventory.filter(row => row.kind === 'gear')})

  async function checkDates(start = arrival, end = departure, keepSelection = false) {
    activeCheck.current?.abort()
    const controller = new AbortController()
    activeCheck.current = controller
    setLoading(true)
    setAvailabilityError('')
    try {
      const data = await read('/api/camp?' + new URLSearchParams({arrival:start,departure:end}), null, controller.signal)
      if (controller.signal.aborted) return
      setCatalog(data)
      setChecked({arrival:start,departure:end})
      setCounts(previous => keepSelection ? Object.fromEntries(data.inventory
        .filter(row => previous[row.code] && Number(row.available) > 0)
        .map(row => [row.code, Math.min(previous[row.code], Number(row.available))])) : {})
      setRentalsByLock(previous => keepSelection ? previous : {})
    } catch (error) {
      if (!controller.signal.aborted) setAvailabilityError(error.message)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const currentDate = thaiDate.format(new Date())
    setToday(currentDate)
    const draft = readBookingDraft()
    const validDraft = draft?.arrival >= currentDate && dayCount(draft.arrival,draft.departure) >= 1 &&
      dayCount(draft.arrival,draft.departure) <= 30
    const start = validDraft ? draft.arrival : currentDate
    const end = validDraft ? draft.departure : nextDay(start)
    if (validDraft) {
      setGuests(draft.guests)
      setCounts(draft.counts)
      setRentalsByLock(draft.rentalsByLock || {})
      if (tabs.some(([id]) => id === draft.zone)) setZone(draft.zone)
    }
    setArrival(start)
    setDeparture(end)
    void checkDates(start,end,validDraft)
    return () => activeCheck.current?.abort()
  }, [])

  const ready = !!catalog && checked?.arrival === arrival && checked?.departure === departure && !loading
  const allRows = catalog?.inventory || []
  const visible = allRows.filter(row => row.zone === zone)
  const hasMap = zone !== 'BOX' && (!visible.length || visible.some(mapPosition))
  const activeView = hasMap ? view : 'list'
  const hosts = allRows.filter(row => row.kind !== 'gear' && counts[row.code])
    .map(row => ({ ...row, quantity:counts[row.code] }))
  const rentalLines = hosts.flatMap(host => allRows
    .filter(row => row.kind !== 'plot' && rentalsByLock[host.code]?.[row.code] > 0)
    .map(row => ({ host:host.code, code:row.code, quantity:rentalsByLock[host.code][row.code] })))
  const combined = { ...counts }
  for (const { code, quantity } of rentalLines) combined[code] = (combined[code] || 0) + quantity
  const selected = allRows.filter(row => combined[row.code]).map(row => ({ ...row, quantity:combined[row.code] }))
  const nights = ready ? dayCount(arrival,departure) : 0
  const total = ready ? stayTotal(selected,catalog.settings,guests.adults,nights) : 0
  const zoneLabel = campZoneLabel(zone)
  const guestCount = Object.values(guests).reduce((sum, count) => sum + count, 0)
  const guestSummary = guestCount + ' คน' + (guestCount > 0 ? ' · ' +
    guestTypes.filter(([key]) => guests[key]).map(([key,label]) => label + ' ' + guests[key]).join(' / ') : '')

  useEffect(() => {
    if (ready) sessionStorage.setItem(draftKey, JSON.stringify({ arrival, departure, guests, counts, zone, rentalsByLock }))
  }, [ready, arrival, departure, guests, counts, zone, rentalsByLock])

  function changeDates(start, end) {
    if (start === arrival && end === departure) return
    activeCheck.current?.abort()
    setLoading(false)
    setAvailabilityError('')
    setChecked(null)
    setCounts({})
    setRentalsByLock({})
    setArrival(start)
    setDeparture(end)
    void checkDates(start,end)
  }

  function select(code, quantity) {
    setCounts(previous => ({ ...previous, [code]: quantity }))
    if (!quantity) setRentalsByLock(previous => ({ ...previous, [code]: {} }))
    setBookingError('')
  }

  function selectFromMap(row, quantity) {
    if (tabs.some(([id]) => id === row.zone)) setZone(row.zone)
    select(row.code,quantity)
  }

  function confirmRentals(host, quantities) {
    setRentalsByLock(previous => ({ ...previous, [host]: quantities }))
    setBookingError('')
  }

  async function book(event) {
    event.preventDefault()
    if (!ready || !selected.length || bookingBusy) return
    if (!guestCount) {
      setBookingError('กรุณาเลือกจำนวนผู้เข้าพักก่อนยืนยันการจอง')
      return
    }
    const fields = new FormData(event.currentTarget)
    const payload = {
      ...guests, arrival, departure, guest:fields.get('guest'), phone:fields.get('phone'),
      items:selected.map(({code,quantity}) => ({code,quantity})), expectedTotal:total,
      ...(rentalLines.length ? { rentalLines } : {}),
    }
    const fingerprint = JSON.stringify(payload)
    if (request.current?.fingerprint !== fingerprint) request.current = {
      fingerprint,key:crypto.randomUUID(),
      token:(crypto.randomUUID() + crypto.randomUUID()).replaceAll('-',''),
    }
    setBookingBusy(true)
    setBookingError('')
    try {
      const {key,token} = request.current
      const booking = await read('/api/camp',{...payload,requestKey:key,paymentToken:token})
      sessionStorage.setItem('trunkhill-payment-' + booking.id,token)
      sessionStorage.removeItem(draftKey)
      request.current = null
      router.push('/payment?id=' + booking.id)
    } catch (error) {
      setBookingError(error.message)
      if (error.status === 409) await checkDates(arrival,departure,true)
    } finally {
      setBookingBusy(false)
    }
  }

  const selection = <div className="camp-selection">
    {hosts.length > 0 && <ul className="camp-selected-plots" role="list" aria-label="ล็อกและห้องพักที่เลือก">
      {hosts.map(row => <li key={row.code}>
        <div className="camp-selected-plot-title">
          <strong>{row.name}</strong>
          <button type="button" className="camp-selected-remove" aria-label={'นำ ' + row.name + ' ออก'}
            disabled={!ready || bookingBusy} onClick={() => select(row.code,0)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>
        {row.detail && <small>{row.detail}</small>}
      </li>)}
    </ul>}
    <div className="camp-selection-total">
      <div><strong>{money(total)}</strong><small>{selected.length} รายการ · {nights || '–'} คืน</small></div>
      <button className="button review-button" disabled={!ready || !selected.length} onClick={() => {
        if (!guestCount) {
          setGuestWarning(true)
          guestWarningDialog.current.showModal()
          return
        }
        sessionStorage.setItem(draftKey, JSON.stringify({ arrival, departure, guests, counts, zone, rentalsByLock }))
        router.push('/review')
      }}>สรุปการจอง →</button>
    </div>
  </div>

  return <div className={'camp-home customer-compact' + (review ? '' : ' camp-front')}>
    <CampHeader onCampInfo={menuActions.onCampInfo}/>

    <main className="camp-shell">
      {review ? <BookingReview {...{ ready, loading, availabilityError, selected, nights, total, arrival, departure, guestSummary,
        bookingBusy, bookingError, receipt, book, select, confirmRentals, hosts, rentalLines, combined }}
        gear={allRows.filter(row => row.kind === 'gear' || row.kind === 'room')} rentalsByLock={rentalsByLock}
        onRetry={() => checkDates(arrival, departure, true)}
        settings={catalog?.settings} adults={guests.adults}/> :
      <section className="camp-booking" id="booking" aria-label="จองลานและอุปกรณ์">
        <BookingSteps current={1}/>
        <div className="camp-controls">
          <button className="camp-control" disabled={!today || bookingBusy} onClick={() => {
            setDatePickerKey(key => key + 1)
            dateDialog.current.showModal()
            dateDialog.current.scrollTop = 0
          }}><span>เข้าพัก – วันออก</span><strong>{arrival && departure ? compactDateRange(arrival,departure) : 'เลือกวันที่'}</strong></button>
          <button className="camp-control" disabled={bookingBusy} aria-invalid={guestWarning && !guestCount ? true : undefined}
            aria-describedby={guestWarning && !guestCount ? 'camp-guest-warning' : undefined} onClick={() => {
              guestDialog.current.showModal()
              guestDialog.current.scrollTop = 0
            }}>
            <span>ผู้เข้าพัก</span><strong>{guestCount} คน</strong>
          </button>
        </div>
        {availabilityError && <div className="notice error actions" role="alert">{availabilityError}
          <button className="button secondary" onClick={() => checkDates(arrival,departure,true)}>ลองอีกครั้ง</button></div>}
        <div className="camp-zone-switch" aria-label="เลือกโซน">{tabs.map(([id]) =>
          <button key={id} type="button" aria-pressed={zone === id} onClick={() => setZone(id)}>{id === 'BOX' ? 'ห้องพัก' : 'Zone ' + id}</button>)}</div>

        <div className="panel stack camp-panel camp-picker-panel">
            <div className="camp-panel-head"><h2>{zoneLabel}</h2><button type="button" className="text-button camp-inline-zone-details"
              onClick={menuActions.onZoneDetails}>ดูรายละเอียดลาน</button></div>
            <div className="plot-map-toolbar">
              {hasMap && <div className="customer-switch" aria-label="รูปแบบการเลือกล็อก">
                <button type="button" aria-pressed={activeView === 'map'} onClick={() => setView('map')}>ผังลาน</button>
                <button type="button" aria-pressed={activeView === 'list'} onClick={() => setView('list')}>รายการล็อก</button>
              </div>}
              {activeView === 'map' && <button className="text-button" type="button" onClick={() => {
                setMapZone(zone)
                mapDialog.current.showModal()
                mapDialog.current.scrollTop = 0
              }}>ขยายผัง ↗</button>}
              {activeView === 'list' && ready && visible.some(row => Number(row.available) > 0) &&
                <button className="text-button" disabled={bookingBusy} onClick={() => {
                  setCounts(previous => ({ ...previous, ...Object.fromEntries(visible.filter(row => Number(row.available) > 0).map(row => [row.code,1])) }))
                  setBookingError('')
                }}>เลือกล็อกที่ว่างทั้งหมด</button>}
            </div>
            {loading ? <CampLoader label="กำลังตรวจสอบลานว่าง…"/> : activeView === 'map' ? <>
            <PlotMap rows={allRows} zone={zone} counts={counts} ready={ready} busy={bookingBusy} onSelect={selectFromMap}
              mapVersion={catalog?.settings.map_version}/>
            <div className="plot-map-legend" aria-label="สถานะล็อก">
              <span className="available">ว่าง</span><span className="booked">จองแล้ว</span><span className="selected">เลือกอยู่</span>
            </div></> : !ready ? <p className="empty">เลือกวันเข้าพักเพื่อดูรายการว่าง</p> :
              visible.length ? <div className="item-grid">{visible.map(row => {
                const available = Number(row.available)
                return <button key={row.code} className="slot" aria-pressed={!!counts[row.code]}
                  onClick={() => select(row.code, counts[row.code] ? 0 : 1)} disabled={!available || bookingBusy}>
                  <strong>{row.name}</strong><small>{!available ? 'จองแล้ว' : counts[row.code] ? '✓ เลือกแล้ว' : 'ว่าง'}</small>
                </button>
              })}</div> : <p className="empty">โซนนี้ยังไม่มีรายการเปิดให้จอง</p>}
        </div>
        <div className="camp-desktop-selection">{selection}</div>
      </section>}

    </main>

    <footer className="camp-footer"><div className="camp-shell footer"><span>Trunkhill Campfield</span>
      <div className="actions"><a href="tel:0992277700">ติดต่อแคมป์</a><Link href="/admin">ผู้ดูแล</Link></div>
    </div></footer>

    <MobileCampMenu page={review ? 'flow' : 'home'} summary={!review && selection} {...menuActions}/>

    <dialog ref={dateDialog} className="dialog booking-picker" aria-labelledby="date-title">
      <form method="dialog" className="dialog-close"><button className="button secondary" aria-label="ปิดตัวเลือกวันที่">×</button></form>
      {today && <DatePicker key={datePickerKey} dialog={dateDialog} arrival={arrival} departure={departure} today={today} onConfirm={changeDates}/>}
    </dialog>
    <dialog ref={guestDialog} className="dialog booking-picker" aria-labelledby="guest-title">
      <form method="dialog" className="dialog-close"><button className="button secondary" aria-label="ปิดตัวเลือกผู้เข้าพัก">×</button></form>
      <GuestPicker guests={guests} setGuests={setGuests} settings={catalog?.settings} dialog={guestDialog}/>
    </dialog>
    <dialog ref={guestWarningDialog} className="dialog camp-guest-warning" aria-labelledby="camp-guest-warning"
      onClose={() => setGuestWarning(false)}>
      <p id="camp-guest-warning" role="alert">กรุณาเลือกจำนวนผู้เข้าพักก่อนตรวจสอบการจอง</p>
      <div className="actions">
        <form method="dialog"><button className="button secondary">กลับ</button></form>
        <button className="button" type="button" onClick={() => {
          guestWarningDialog.current.close()
          guestDialog.current.showModal()
          guestDialog.current.scrollTop = 0
        }}>เลือกจำนวนคน</button>
      </div>
    </dialog>

    <dialog ref={mapDialog} className="dialog interactive-map-dialog" aria-labelledby="plot-map-title">
      <form method="dialog" className="dialog-close"><button className="button secondary" aria-label="ปิดผังลาน">×</button></form>
      <h2 id="plot-map-title">ผังลาน Trunkhill</h2>
      <div className="plot-map-toolbar">
        <div className="admin-filter-tabs" aria-label="เน้นโซนบนผัง">
          {[['','ทั้งหมด'],...tabs].map(([id,label]) => <button type="button" className="button secondary" key={id}
            aria-pressed={mapZone === id} onClick={() => setMapZone(id)}>{label}</button>)}
        </div>
        <div className="plot-map-legend" aria-label="สถานะล็อก">
          <span className="available">ว่าง</span><span className="booked">จองแล้ว</span><span className="selected">เลือกอยู่</span>
        </div>
      </div>
      <PlotMap rows={allRows} zone={mapZone} counts={counts} ready={ready} busy={bookingBusy} onSelect={selectFromMap}
        mapVersion={catalog?.settings.map_version}/>
    </dialog>
    {dialogs}
  </div>
}
