import Link from 'next/link'
import { isAdmin } from '../../lib/auth'
import { login, logout } from './actions'
import { BookingList, InventoryList, PaymentSettings, PricingSettings } from './sections'
import { adminSections, adminUrl } from './navigation'
import { AdminWorkspace } from './admin-workspace'
import { ZoneMediaSettings } from './zone-media-settings'
import { PlotMapSettings } from './plot-map-settings'
import { CheckoutList, CheckoutSettings } from './checkout'
import { Dashboard } from './dashboard'

export const dynamic = 'force-dynamic'

export default async function Admin({ searchParams }) {
  const query = await searchParams
  if (!(await isAdmin())) return <main className="container admin-login">
    <Link href="/">← กลับหน้าจอง</Link>
    <form action={login} className="panel stack">
      <span className="eyebrow">TRUNKHILL / ADMIN</span><h1>เข้าสู่ระบบผู้ดูแล</h1>
      {query.error && <p className="notice error" role="alert">เข้าสู่ระบบไม่สำเร็จ</p>}
      <label>รหัสผ่าน<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>
      <button className="button">เข้าสู่ระบบ</button>
    </form>
  </main>

  const section = typeof query.section === 'string' && Object.hasOwn(adminSections,query.section) ? query.section : 'dashboard'
  return <AdminWorkspace title={adminSections[section]} section={section} sidebar={<>
      <div className="admin-brand"><img src="/camp-logo-transparent.webp" alt="" width="48" height="48"/><div>
        <strong>Trunkhill</strong><small>จัดการแคมป์</small></div></div>
      <nav className="admin-menu" aria-label="เมนูผู้ดูแล">
        {Object.entries(adminSections).map(([key,label]) =>
          <Link key={key} href={adminUrl(key)} aria-current={section === key ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <div className="admin-sidebar-footer"><Link href="/">← หน้าจอง</Link>
        <form action={logout}><button className="text-button">ออกจากระบบ</button></form></div>
    </>}>
      <div className="stack admin-content admin-main-content">
        {query.saved && <p className="notice" role="status">บันทึกแล้ว</p>}
        {query.error && <p className="notice error" role="alert">{query.error === 'zoneMedia'
          ? 'ตรวจสอบประเภทไฟล์และขนาด รูปไม่เกิน 750 KB วิดีโอไม่เกิน 12 MB'
          : query.error === 'zoneLimit' ? 'จำนวนรูปเกิน 8 รูปต่อโซน กรุณาเลือกไฟล์ให้น้อยลงหรือนำรูปเดิมออก'
          : query.error === 'photo'
          ? 'ใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 750 KB'
          : query.error === 'stock' ? 'จำนวนใหม่ต่ำกว่ายอดจองที่ยังใช้งานอยู่' : 'ตรวจสอบข้อมูลที่ระบุอีกครั้ง'}</p>}
        {section === 'dashboard' ? <Dashboard/> :
          section === 'bookings' ? <BookingList query={query}/> :
          section === 'checkout' ? <CheckoutList query={query}/> :
          section === 'checkoutSettings' ? <CheckoutSettings/> :
          section === 'pricing' ? <PricingSettings/> :
          section === 'payment' ? <PaymentSettings/> :
          section === 'zoneMedia' ? <ZoneMediaSettings query={query}/> :
          section === 'plotMap' ? <PlotMapSettings query={query}/> : <InventoryList section={section} query={query}/>}
      </div>
  </AdminWorkspace>
}
