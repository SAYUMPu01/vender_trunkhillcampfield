'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { money } from '../../lib/pricing'
import { displayDate } from '../booking-pickers'
import { PagedItems } from '../paged-items'
import { CampLoader } from '../camp-loader'
import { CampHeader, MobileCampMenu, useCampDetails } from '../camp-navigation'
import { BookingSteps } from '../booking-steps'

export function PaymentScreen({id}) {
  const [booking,setBooking] = useState(null)
  const [deadline,setDeadline] = useState(0)
  const [seconds,setSeconds] = useState(0)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [view,setView] = useState('pay')
  const {dialogs,...menuActions} = useCampDetails()

  async function load(body, signal) {
    const token = sessionStorage.getItem('trunkhill-payment-' + id)
    if (!token) throw new Error('เปิดรายการชำระเงินจากแท็บเดิม หรือใช้รหัสจองและเบอร์โทรค้นหาสถานะที่หน้าหลัก')
    const response = await fetch('/api/payment?' + new URLSearchParams({id}), {
      method:body ? 'POST' : 'GET',body,signal,
      headers:{Authorization:'Bearer ' + token},
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setBooking(data)
    setDeadline(Date.now() + Math.max(0,Number(data.remaining)) * 1000)
    setSeconds(Math.max(0,Number(data.remaining)))
  }

  useEffect(() => {
    const controller = new AbortController()
    load(undefined,controller.signal).catch(error => {
      if (!controller.signal.aborted) setError(error.message)
    })
    return () => controller.abort()
  },[id])

  useEffect(() => {
    if (!deadline || booking?.submitted) return
    const update = () => setSeconds(Math.max(0,Math.ceil((deadline - Date.now()) / 1000)))
    update()
    const timer = setInterval(update,250)
    return () => clearInterval(timer)
  },[deadline,booking?.submitted])

  async function confirm(event) {
    event.preventDefault()
    if (busy || !seconds) return
    const body = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await load(body)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const done = booking?.submitted && booking.status !== 'cancelled'
  const expired = booking && !booking.submitted && seconds === 0
  const cancelled = booking?.status === 'cancelled'
  const countdown = String(Math.floor(seconds / 60)).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0')
  const nights = booking ? (Date.parse(booking.departure) - Date.parse(booking.arrival)) / 86400000 : 0
  return <div className="camp-home customer-compact payment-home">
    <CampHeader onCampInfo={menuActions.onCampInfo}/>
    <main className="camp-shell payment-shell">
      <BookingSteps current={done ? 4 : 3}/>
      {!booking && <section className="panel stack payment-receipt">
        <h1>ชำระเงิน</h1>
        {error ? <p role="alert">{error}</p> : <CampLoader label="กำลังโหลดข้อมูลการจอง…"/>}
        {error && <Link className="button secondary" href="/">กลับหน้าหลัก</Link>}
      </section>}
      {done && <section className="panel stack payment-receipt">
        <span className="payment-check" aria-hidden="true">✓</span>
        <h1>{booking.total > 0 ? 'ส่งหลักฐานการชำระเงินแล้ว' : 'ส่งคำขอจองแล้ว'}</h1>
        <p>{booking.status === 'confirmed' ? 'แคมป์ยืนยันการจองแล้ว' : booking.total > 0
          ? 'แคมป์จะตรวจสอบสลิปก่อนยืนยันการจอง' : 'รอแคมป์ยืนยันการจอง'}</p>
        <div className="payment-code"><span>รหัสการจอง</span><strong>{booking.id}</strong></div>
        <p>{displayDate(booking.arrival)} – {displayDate(booking.departure)} · {nights} คืน · {money(booking.total)}</p>
        <p className="notice">แคปหน้าจอนี้ไว้เป็นหลักฐาน ใช้รหัสจองและเบอร์โทรที่ลงทะเบียนในหน้า <Link href="/booking">ตรวจสอบการจอง</Link></p>
        <button className="button" onClick={() => window.print()}>พิมพ์หรือบันทึกเป็น PDF</button>
        <Link className="button secondary" href="/">กลับหน้าหลัก</Link>
      </section>}
      {booking && !done && <>
        <h1 className="payment-title">ชำระเงิน</h1>
        <div className="customer-switch" aria-label="ข้อมูลการชำระเงิน">
          <button type="button" aria-pressed={view === 'pay'} onClick={() => setView('pay')}>ชำระเงิน</button>
          <button type="button" aria-pressed={view === 'summary'} onClick={() => setView('summary')}>สรุปการจอง</button>
        </div>
        <div className="payment-grid">
          <section className="panel stack payment-card" hidden={view !== 'pay'}>
            <h2>วิธีการชำระเงิน</h2>
            {!expired && !cancelled && booking.recipient && <div className="payment-qr">
              <img src="/api/payment/qr" alt="สแกน QR เพื่อชำระเงิน" width="180" height="180"/>
              <div><span>สแกน QR เพื่อโอนเงิน</span><strong>{booking.recipient}</strong></div>
            </div>}
            {!booking.recipient && !expired && !cancelled && <p className="notice error">แคมป์ยังไม่ได้ตั้งค่า QR รับเงิน</p>}
            <div className="review-total review-cost"><span>ยอดที่ต้องชำระ</span><strong>{money(booking.total)}</strong></div>
            {expired || cancelled ? <p className="notice error">{cancelled ? 'รายการจองถูกยกเลิกแล้ว' : 'หมดเวลาชำระเงิน ระบบคืนรายการที่กันไว้แล้ว'}</p>
              : <p className="payment-timer">กรุณาชำระและส่งสลิปภายใน <strong>{countdown}</strong></p>}
            {!expired && !cancelled && <form className="stack" onSubmit={confirm}>
              <label className="payment-upload">แนบสลิปการโอน
                <span className="small muted">JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 5 MB</span>
                <input type="file" name="slip" accept="image/jpeg,image/png,image/webp,application/pdf" required disabled={!booking.recipient || busy}/>
              </label>
              <button className="button" disabled={!booking.recipient || busy}>{busy ? 'กำลังส่งสลิป…' : 'ยืนยันการชำระเงิน →'}</button>
            </form>}
            {error && <p className="notice error" role="alert">{error}</p>}
            {(expired || cancelled) && <Link className="button secondary" href="/">กลับไปจองใหม่</Link>}
          </section>
          <section className="panel stack payment-card" hidden={view !== 'summary'}>
            <h2>สรุปการจอง</h2>
            <div className="notice"><small>เลขอ้างอิง</small><br/><strong>{booking.id}</strong></div>
            <div className="review-cost"><span>วันเข้าพัก</span><strong>{displayDate(booking.arrival)}</strong></div>
            <div className="review-cost"><span>วันออก</span><strong>{displayDate(booking.departure)} · {nights} คืน</strong></div>
            <p>ผู้ใหญ่ {booking.adults} · เด็ก {booking.children} · ผู้สูงอายุ {booking.seniors}</p>
            <h3>สรุปค่าใช้จ่าย</h3>
            <PagedItems items={booking.items} size={3} label="รายการค่าใช้จ่าย">{page => page.map((item,index) =>
              <div className="review-cost" key={index}><span>{item.name} × {item.quantity}</span><span>{money(item.amount)}</span></div>)}</PagedItems>
            <div className="review-total review-cost"><strong>รวมทั้งหมด</strong><strong>{money(booking.total)}</strong></div>
            <p className="small muted">หลังส่งสลิป แคมป์จะตรวจสอบการชำระเงินก่อนยืนยันรายการ</p>
          </section>
        </div>
      </>}
    </main>
    <MobileCampMenu page="flow" {...menuActions}/>
    {dialogs}
  </div>
}
