import Link from 'next/link'
import { Fragment } from 'react'
import { database } from '../../lib/db'
import { money, statuses } from '../../lib/pricing'
import { changeStatus, saveInventory, savePaymentConfig, saveSettings } from './actions'
import { effectiveStatus } from '../../lib/payment-rules'
import { adminSections, adminUrl, inventoryKinds } from './navigation'
import { AdminDialog } from './admin-dialog'
import { BookingBreakdown, BookingItemsTable, bookingItems, lodgingLine } from './booking-items'

const pageSize = 30
const zones = { plot:['A','B','C','D'], room:['BOX'], gear:['GEAR'] }
const bookingCursor = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\|[A-F0-9]{20}$/
const inventoryCursor = /^[A-Z0-9][A-Z0-9-]{0,23}$/

function searchText(query) {
  return typeof query.q === 'string' ? query.q.trim().slice(0,120) : ''
}

function prefix(value) {
  return value.replace(/[!%_]/g, '!$&') + '%'
}

function cursor(query, pattern) {
  if (typeof query.before === 'string' && pattern.test(query.before)) return { value:query.before, backwards:true }
  if (typeof query.after === 'string' && pattern.test(query.after)) return { value:query.after, backwards:false }
  return { value:'', backwards:false }
}

function pageRows(rows, position) {
  const hasMore = rows.length > pageSize
  const visible = rows.slice(0,pageSize)
  if (position.backwards) visible.reverse()
  return {
    visible,
    previous: position.backwards ? hasMore : !!position.value,
    next: position.backwards ? !!position.value : hasMore,
  }
}

function Pagination({ section, filters, page, rowCursor }) {
  const { visible, previous, next } = page
  if (!previous && !next) return null
  return <nav className="admin-pagination actions" aria-label="แบ่งหน้ารายการ">
    {previous && <Link className="button secondary" href={visible.length
      ? adminUrl(section,{...filters,before:rowCursor(visible[0])}) : adminUrl(section,filters)}>← หน้าก่อนหน้า</Link>}
    {next && visible.length > 0 && <Link className="button secondary" href={adminUrl(section,{...filters,after:rowCursor(visible.at(-1))})}>หน้าถัดไป →</Link>}
  </nav>
}

export async function BookingList({ query }) {
  const q = searchText(query)
  const status = typeof query.status === 'string' && Object.hasOwn(statuses,query.status) ? query.status : ''
  const position = cursor(query,bookingCursor)
  const clauses = []
  const values = []
  if (status) {
    clauses.push(`${effectiveStatus} = ?`)
    values.push(status)
  }
  if (q) {
    const phone = q.replace(/[ ()-]/g,'')
    if (/^[A-Fa-f0-9]{20}$/.test(q)) {
      clauses.push('id = ?')
      values.push(q.toUpperCase())
    } else if (/^\+?\d{8,15}$/.test(phone)) {
      clauses.push('phone = ?')
      values.push(phone)
    } else {
      clauses.push("guest LIKE ? ESCAPE '!'")
      values.push(prefix(q))
    }
  }
  const direction = position.backwards ? 'ASC' : 'DESC'
  if (position.value) {
    const [time,id] = position.value.split('|')
    const operator = position.backwards ? '>' : '<'
    clauses.push(`(created_at ${operator} ? OR (created_at = ? AND id ${operator} ?))`)
    values.push(time,time,id)
  }
  const [rows] = await database().execute(
    `SELECT b.*,
       (SELECT COUNT(*) FROM booking_lines WHERE booking=b.id) AS item_count,
       (SELECT COUNT(*) FROM booking_lines l JOIN inventory i ON i.code=l.code
        WHERE l.booking=b.id AND ${lodgingLine}) AS lodging_count
     FROM (SELECT b.id,b.guest,b.phone,b.arrival,b.departure,b.total,${effectiveStatus} AS status,b.created_at,
       (p.booking IS NOT NULL) AS payment_required,(p.submitted_at IS NOT NULL) AS payment_submitted,
       (p.mime IS NOT NULL) AS has_slip,
       EXISTS (SELECT 1 FROM booking_checkouts c WHERE c.booking=b.id AND c.completed_at IS NOT NULL) AS checked_out
       FROM bookings b LEFT JOIN booking_payments p ON p.booking=b.id
       ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
       ORDER BY created_at ${direction}, id ${direction} LIMIT ?) b
     ORDER BY b.created_at ${direction}, b.id ${direction}`, [...values,pageSize+1])
  const page = pageRows(rows,position)
  const filters = {q,status}
  const current = { ...filters, [position.backwards ? 'before' : 'after']:position.value }
  const detail = page.visible.find(row => row.id === query.view)
  const expanded = page.visible.find(row => row.id === query.expand)
  const target = detail || expanded
  const items = target ? await bookingItems(target.id) : []
  const nights = target ? (Date.parse(target.departure) - Date.parse(target.arrival)) / 86400000 : 0
  return <section className="panel stack admin-content">
    <form action="/admin" className="admin-filters">
      <input type="hidden" name="section" value="bookings"/>
      <label>ค้นหารายการจอง<input name="q" defaultValue={q} maxLength={120} placeholder="ชื่อขึ้นต้น เบอร์โทร หรือรหัสจอง"/></label>
      <label>สถานะ<select name="status" defaultValue={status}><option value="">ทุกสถานะ</option>
        {Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button className="button">ค้นหา</button>
      {(q || status) && <Link className="button secondary" href={adminUrl('bookings')}>ล้างตัวกรอง</Link>}
    </form>
    <div className="admin-table-toolbar">
      <span className="muted small">แสดง {page.visible.length} รายการในหน้านี้</span>
      <nav className="admin-filter-tabs" aria-label="กรองสถานะ">
        {[['','ทั้งหมด'], ...Object.entries(statuses)].map(([key,label]) =>
          <Link key={key} href={adminUrl('bookings',{q,status:key})} aria-current={status === key ? 'page' : undefined}>{label}</Link>)}
      </nav>
    </div>
    <div className="admin-table-scroll" tabIndex={0} aria-label="ตารางรายการจอง"><table className="admin-table">
      <thead><tr>{['รหัสจอง','ผู้จอง','เช็กอิน','เช็กเอาต์','สรุปรายการจอง','ยอดรวม','สถานะ','จัดการ'].map(label =>
        <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{page.visible.map(row => {
        const open = expanded?.id === row.id
        const lodging = Number(row.lodging_count)
        const rentals = Number(row.item_count) - lodging
        return <Fragment key={row.id}><tr>
      <td><div className="admin-booking-id">
        <Link href={adminUrl('bookings',open ? current : {...current,expand:row.id})} scroll={false}
          className="admin-expand-booking" aria-expanded={open} aria-label={(open ? 'ย่อ ' : 'ขยาย ') + row.id}>{open ? '⌄' : '›'}</Link>
        <code>{row.id}</code></div></td>
      <td><strong>{row.guest}</strong><br/><small>{row.phone}</small></td>
      <td className="admin-booking-date">{row.arrival}</td><td className="admin-booking-date">{row.departure}</td>
      <td><div className="admin-item-badges">
        {lodging > 0 && <span className="lodging">ลาน / ห้อง ({lodging})</span>}
        {rentals > 0 && <span className="rental">อุปกรณ์ ({rentals})</span>}
        {!lodging && !rentals && '—'}
      </div></td>
      <td className="admin-amount"><strong>{money(row.total)}</strong></td>
      <td><span className={'admin-status ' + row.status}>{row.status === 'pending' && row.payment_required
        ? (row.payment_submitted ? 'รอตรวจสลิป' : 'รอชำระเงิน') : statuses[row.status]}</span></td>
      <td><div className="actions admin-row-actions">
      <Link href={adminUrl('bookings',{...current,view:row.id})} scroll={false} className="button secondary">ดูรายละเอียด</Link>
      {row.status !== 'cancelled' && !row.checked_out && <form action={changeStatus} className="actions admin-row-actions">
        <input type="hidden" name="id" value={row.id}/>
        <input type="hidden" name="q" value={q}/><input type="hidden" name="filterStatus" value={status}/>
        {row.status === 'pending' && (!row.payment_required || row.payment_submitted) && <button className="button secondary" name="status" value="confirmed">ยืนยัน</button>}
        <button className="button secondary admin-cancel" name="status" value="cancelled">ยกเลิก</button>
      </form>}</div></td>
      </tr>{open && !detail && <tr className="admin-expanded-row"><td colSpan={8}>
        <BookingBreakdown items={items} nights={nights}/>
      </td></tr>}</Fragment>
      })}
      {!page.visible.length && <tr><td colSpan={8} className="admin-empty-cell">ไม่พบรายการจอง</td></tr>}
      </tbody>
    </table></div>
    <Pagination section="bookings" filters={filters} page={page} rowCursor={row => row.created_at + '|' + row.id}/>
    {detail && <AdminDialog title="รายละเอียดการจอง" closeUrl={adminUrl('bookings',current)}>
      <dl className="admin-booking-detail">
        <div><dt>รหัสจอง</dt><dd><code>{detail.id}</code></dd></div>
        <div><dt>ผู้จอง</dt><dd>{detail.guest}</dd></div>
        <div><dt>เบอร์โทร</dt><dd>{detail.phone}</dd></div>
        <div><dt>วันเข้าพัก – วันออก</dt><dd>{detail.arrival} → {detail.departure} ({nights} คืน)</dd></div>
        <div><dt>สถานะ</dt><dd>{statuses[detail.status]}</dd></div>
      </dl>
      <section className="admin-detail-items">
        {!!detail.has_slip && <a className="button secondary" href={'/admin/slip/' + detail.id} target="_blank" rel="noreferrer">เปิดสลิปการโอน</a>}
        <h3>รายการที่จองทั้งหมด</h3>
        <div className="admin-item-group"><BookingItemsTable items={items} label="รายการที่จองทั้งหมด"/></div>
        <div className="admin-detail-total"><span>ยอดรวมสุทธิทั้งสิ้น</span><strong>{money(detail.total)}</strong></div>
      </section>
    </AdminDialog>}
  </section>
}

function InventoryForm({ row = {}, kind, q, zone, closeUrl }) {
  return <form action={saveInventory} className="admin-edit-form">
    <input type="hidden" name="original" value={row.code || ''}/>
    <input type="hidden" name="kind" value={kind}/>
    <input type="hidden" name="q" value={q}/><input type="hidden" name="filterZone" value={zone}/>
    <label>รหัส<input name="code" defaultValue={row.code} readOnly={!!row.code} maxLength={24} required /></label>
    <label>โซน<select name="zone" defaultValue={row.zone || zone || zones[kind][0]}>{zones[kind].map(value => <option key={value}>{value}</option>)}</select></label>
    <label>ชื่อ<input name="name" defaultValue={row.name} required maxLength={120}/></label>
    <label>รายละเอียด<input name="detail" defaultValue={row.detail} maxLength={240}/></label>
    <label>บาท/คืน<input name="price" type="number" min="0" max="100000" defaultValue={row.price ?? 0} required/></label>
    {kind === 'gear' && <label>จำนวน<input name="stock" type="number" min="0" max="1000" defaultValue={row.stock ?? 1} required/></label>}
    {kind !== 'plot' && <label>รูป{kind === 'gear' ? 'อุปกรณ์' : 'ห้องพัก'}
      <input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/>
      <small>JPG, PNG หรือ WebP ขนาดไม่เกิน 750 KB</small>
      {row.has_photo > 0 && <img src={'/admin/inventory-photo/' + row.code} alt="รูปปัจจุบัน" width="80" height="56"/>}
    </label>}
    <label className="checkbox"><input type="checkbox" name="active" defaultChecked={row.active ?? true}/> เปิดให้จอง</label>
    <div className="admin-edit-footer">
      <Link href={closeUrl} scroll={false} className="button secondary">ยกเลิก</Link>
      <button className="button">{row.code ? 'บันทึก' : 'เพิ่มรายการ'}</button>
    </div>
  </form>
}

export async function InventoryList({ section, query }) {
  const kind = inventoryKinds[section]
  const q = searchText(query)
  const zone = zones[kind].includes(query.zone) ? query.zone : ''
  const position = cursor(query,inventoryCursor)
  const clauses = ['kind = ?']
  const values = [kind]
  if (zone) {
    clauses.push('zone = ?')
    values.push(zone)
  }
  if (q) {
    clauses.push("(code LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!')")
    values.push(prefix(q),prefix(q))
  }
  if (position.value) {
    clauses.push(position.backwards ? 'code < ?' : 'code > ?')
    values.push(position.value)
  }
  const [rows] = await database().execute(
    `SELECT code,zone,name,detail,price,stock,active,
       EXISTS(SELECT 1 FROM inventory_photos p WHERE p.code=inventory.code) AS has_photo
     FROM inventory WHERE ${clauses.join(' AND ')}
     ORDER BY code ${position.backwards ? 'DESC' : 'ASC'} LIMIT ?`,[...values,pageSize+1])
  const page = pageRows(rows,position)
  const filters = {q,zone}
  const current = { ...filters, [position.backwards ? 'before' : 'after']:position.value }
  const closeUrl = adminUrl(section,current)
  const editing = page.visible.find(row => row.code === query.edit)
  const adding = query.add === '1'
  return <section className="panel stack admin-content">
    <form action="/admin" className="admin-filters">
      <input type="hidden" name="section" value={section}/>
      <label>ค้นหาจากรหัสหรือชื่อ<input name="q" defaultValue={q} maxLength={120} placeholder="พิมพ์รหัสหรือชื่อขึ้นต้น"/></label>
      {kind === 'plot' && <label>โซน<select name="zone" defaultValue={zone}><option value="">ทุกโซน</option>{zones.plot.map(value => <option key={value}>{value}</option>)}</select></label>}
      <button className="button">ค้นหา</button>
      {(q || zone) && <Link className="button secondary" href={adminUrl(section)}>ล้างตัวกรอง</Link>}
    </form>
    <div className="admin-table-toolbar"><span className="muted small">แสดง {page.visible.length} รายการในหน้านี้</span>
      <Link href={adminUrl(section,{...current,add:'1'})} scroll={false} className="button">+ เพิ่มรายการ</Link>
    </div>
    <div className="admin-table-scroll" tabIndex={0} aria-label={'ตาราง' + adminSections[section]}><table className="admin-table">
      <thead><tr>{['จัดการ','รหัส','ชื่อรายการ','โซน','ราคา / คืน','จำนวน','สถานะ',...(kind === 'plot' ? [] : ['รูป'])].map(label =>
        <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{page.visible.map(row => <tr key={row.code}>
        <td><Link href={adminUrl(section,{...current,edit:row.code})} scroll={false} className="button secondary">แก้ไข</Link></td>
        <td><code>{row.code}</code></td><td><strong>{row.name}</strong>{row.detail && <><br/><small>{row.detail}</small></>}</td>
        <td>{row.zone}</td><td className="admin-amount">{money(row.price)}</td><td>{row.stock}</td>
        <td><span className={'admin-status ' + (row.active ? 'confirmed' : 'cancelled')}>{row.active ? 'เปิดจอง' : 'ปิดจอง'}</span></td>
        {kind !== 'plot' && <td>{row.has_photo > 0 ? <img className="admin-thumb" src={'/admin/inventory-photo/' + row.code}
          alt={'รูป ' + row.name} width="48" height="36" loading="lazy"/> : <span className="muted">—</span>}</td>}
      </tr>)}
      {!page.visible.length && <tr><td colSpan={kind === 'plot' ? 7 : 8} className="admin-empty-cell">ไม่พบรายการ</td></tr>}
      </tbody>
    </table></div>
    <Pagination section={section} filters={filters} page={page} rowCursor={row => row.code}/>
    {(adding || editing) && <AdminDialog title={editing ? 'แก้ไข ' + editing.name : 'เพิ่มรายการ' } closeUrl={closeUrl}>
      <InventoryForm row={editing} {...{kind,q,zone,closeUrl}}/>
    </AdminDialog>}
  </section>
}

export async function PricingSettings() {
  const [[settings]] = await database().query('SELECT * FROM settings WHERE id=1')
  return <section className="panel stack admin-content"><h2>ตั้งราคาลาน</h2><form action={saveSettings} className="form-grid">
    <label>วิธีคิดราคา<select name="mode" defaultValue={settings.mode}><option value="person">ตามคน</option><option value="plot">ตามล็อก</option></select></label>
    <label>บาทต่อคนต่อคืน<input name="price" type="number" min="0" max="100000" defaultValue={settings.person_price} required/></label>
    <label>ขั้นต่ำต่อคนต่อล็อกเมื่อจองหลายล็อก<input name="minimum" type="number" min="0" max="20" defaultValue={settings.minimum_per_plot} required/></label>
    <button className="button">บันทึกราคา</button>
  </form></section>
}

export async function PaymentSettings() {
  const [[config]] = await database().query('SELECT recipient FROM payment_config WHERE id=1')
  return <section className="panel stack admin-content">
    <h2>ตั้งค่า QR รับเงิน</h2>
    <p>แนบ QR สำหรับรับเงินของแคมป์ และระบุชื่อผู้รับที่ลูกค้าจะเห็นในหน้าชำระเงิน</p>
    {config && <img src="/api/payment/qr" alt="QR รับเงินปัจจุบัน" width="180" height="180"/>}
    <form action={savePaymentConfig} className="admin-edit-form">
      <label>ชื่อผู้รับเงิน<input name="recipient" defaultValue={config?.recipient} maxLength={120} required/></label>
      <label>รูป QR รับเงิน<input name="qr" type="file" accept="image/jpeg,image/png,image/webp" required/>
        <small>JPG, PNG หรือ WebP ขนาดไม่เกิน 750 KB</small></label>
      <div className="admin-edit-footer"><button className="button">บันทึก QR รับเงิน</button></div>
    </form>
  </section>
}

