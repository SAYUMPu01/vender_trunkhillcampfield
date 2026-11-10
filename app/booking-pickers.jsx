'use client'

import { useState } from 'react'
import { money } from '../lib/pricing'
import { shiftDate } from '../lib/booking-dates'

const day = 86400000
const monthLabel = new Intl.DateTimeFormat('th-TH-u-ca-gregory', { month: 'long', year: 'numeric', timeZone: 'UTC' })
export const guestTypes = [
  ['adults', 'ผู้ใหญ่', 'อายุ 14–64 ปี'],
  ['children', 'เด็ก', 'อายุไม่เกิน 13 ปี (ฟรี)'],
  ['seniors', 'ผู้สูงอายุ', 'อายุ 65 ปีขึ้นไป (ฟรี)'],
]

export function displayDate(value) {
  if (!value) return 'เลือกวันที่'
  const [year, month, date] = value.split('-')
  return Number(date) + '/' + Number(month) + '/' + year
}

export function DatePicker({ dialog, arrival, departure, today, onConfirm, fixedNights }) {
  const [start, setStart] = useState(arrival)
  const [end, setEnd] = useState(departure)
  const [choosingEnd, setChoosingEnd] = useState(false)
  const [month, setMonth] = useState((arrival || today).slice(0, 7))
  const first = new Date(month + '-01T00:00:00Z')
  const offset = first.getUTCDay()
  const adjacent = delta => new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1)).toISOString().slice(0, 7)
  const length = (Date.parse(adjacent(1) + '-01') - first.getTime()) / day
  const nights = (Date.parse(end) - Date.parse(start)) / day

  function select(date) {
    if (fixedNights) {
      setStart(date)
      setEnd(shiftDate(date,fixedNights))
    } else if (!choosingEnd || date <= start) {
      setStart(date)
      setEnd('')
      setChoosingEnd(true)
    } else {
      setEnd(date)
      setChoosingEnd(false)
    }
  }

  return <div className="stack picker-content">
    <h2 id="date-title">เลือกวันที่เข้าพัก - วันออก</h2>
    <div className="date-preview"><span>วันเข้าพัก <strong>{displayDate(start)}</strong></span>
      <span>วันออก <strong>{displayDate(end)}</strong></span>
      <b>{nights > 0 ? nights + ' คืน' : '– คืน'}</b></div>
    <div className="month-nav">
      <button className="button secondary" aria-label="เดือนก่อน" disabled={month <= today.slice(0, 7)} onClick={() => setMonth(adjacent(-1))}>‹</button>
      <strong>{monthLabel.format(first)}</strong>
      <button className="button secondary" aria-label="เดือนถัดไป" onClick={() => setMonth(adjacent(1))}>›</button>
    </div>
    <div className="calendar-grid weekdays" aria-hidden="true">{['อา','จ','อ','พ','พฤ','ศ','ส'].map(label => <b key={label}>{label}</b>)}</div>
    <div className="calendar-grid">
      {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
      {Array.from({ length }, (_, index) => {
        const date = month + '-' + String(index + 1).padStart(2, '0')
        const endpoint = date === start || date === end
        const inRange = date > start && date < end
        return <button key={date} aria-label={displayDate(date)} aria-pressed={endpoint}
          className={endpoint ? 'endpoint' : inRange ? 'in-range' : ''}
          disabled={date < today || (choosingEnd && (Date.parse(date) - Date.parse(start)) / day > 30)}
          onClick={() => select(date)}>{index + 1}{endpoint && <small>{date === start ? 'เข้าพัก' : 'ออก'}</small>}</button>
      })}
    </div>
    <p className="small muted" aria-live="polite">{fixedNights ? `เลือกวันเข้าพักใหม่ ระบบจะคงระยะเวลาเดิม ${fixedNights} คืน` :
      choosingEnd ? 'เลือกวันออกภายใน 30 คืน' : 'แตะวันที่เพื่อเริ่มเลือกช่วงเข้าพัก'}</p>
    <div className="picker-actions"><button className="button secondary" onClick={() => dialog.current.close()}>ยกเลิก</button>
      <button className="button" disabled={!(nights >= 1 && nights <= 30)} onClick={() => { onConfirm(start, end); dialog.current.close() }}>ยืนยันวันที่</button></div>
  </div>
}

export function GuestPicker({ guests, setGuests, settings, dialog }) {
  function adjust(key, amount) {
    setGuests(previous => ({ ...previous, [key]: Math.max(0, Math.min(100, previous[key] + amount)) }))
  }
  return <div className="stack picker-content">
    <h2 id="guest-title">เลือกจำนวนผู้เข้าพัก</h2>
    {guestTypes.map(([key, label, detail]) => <div className="guest-row" key={key}>
      <div><strong>{label}</strong><small>{detail}</small></div>
      <div className="guest-counter">
        <button aria-label={'ลดจำนวน' + label} disabled={guests[key] === 0} onClick={() => adjust(key, -1)}>−</button>
        <output aria-label={label}>{guests[key]}</output>
        <button aria-label={'เพิ่มจำนวน' + label} disabled={guests[key] === 100} onClick={() => adjust(key, 1)}>+</button>
        <span>คน</span>
      </div>
    </div>)}
    <div className="guest-rate"><strong>อัตราค่าเข้าพัก</strong><span>ผู้ใหญ่ {guests.adults} คน</span>
      <b>{settings?.mode === 'plot' ? 'คิดราคาตามล็อก' : settings ? money(settings.person_price) + ' / คน / คืน' : 'รอตรวจสอบราคา'}</b></div>
    <div className="picker-actions"><button className="button" onClick={() => dialog.current.close()}>เสร็จสิ้น</button></div>
  </div>
}
