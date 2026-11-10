import Link from 'next/link'
import { today } from '../../lib/camp'
import { electricityFormula, extraCharge } from '../../lib/checkout-pricing'
import { money } from '../../lib/pricing'
import { checkoutQr } from '../../lib/promptpay'
import { AdminDialog } from './admin-dialog'
import { bookingItems } from './booking-items'
import { saveCheckout } from './checkout-actions'
import { checkoutCursor, checkoutDetail, checkoutFilters, checkoutPageSize, checkoutPosition, checkoutRows, checkoutSettings, checkoutStatuses, checkoutSummaries } from './checkout-data'
import { CheckoutForm, CheckoutSettingsForm } from './checkout-form'
import { adminUrl } from './navigation'

function CheckoutItems({items, nights}) {
  const lodging = items.filter(item => item.lodging)
  const rentals = items.filter(item => !item.lodging)
  const unassigned = rentals.flatMap(item => {
    const quantity = item.quantity - item.assignments.reduce((sum, assignment) => sum + assignment.quantity,0)
    return quantity > 0 ? [{ ...item, quantity, amount:Math.round(item.amount * quantity / item.quantity) }] : []
  })
  return <div className="stack checkout-body">
    {lodging.map(site => {
      const attached = rentals.flatMap(item => {
        const assignment = item.assignments.find(row => row.host_code === site.code)
        if (!assignment) return []
        return [{ ...item, quantity:assignment.quantity, amount:Math.round(item.amount * assignment.quantity / item.quantity) }]
      })
      return <section className="checkout-item stack" key={site.code}>
        <h3>{site.name}{site.detail && <small>{site.detail}</small>}</h3>
        <div className="checkout-line"><span>ค่าที่พัก {nights} คืน</span><strong>{money(site.amount)}</strong></div>
        {attached.length > 0 && <>
          <strong>อุปกรณ์และบริการที่จอง</strong>
          {attached.map(item => <div className="checkout-line" key={item.code}><span>{item.name} × {item.quantity}</span><strong>{money(item.amount)}</strong></div>)}
        </>}
        <div className="checkout-line checkout-item-total"><strong>รวม</strong><strong>{money(site.amount + attached.reduce((sum,item) => sum + item.amount,0))}</strong></div>
      </section>
    })}
    {unassigned.length > 0 && <section className="checkout-item stack">
      <h3>อุปกรณ์และบริการอื่น ๆ</h3>
      {unassigned.map(item => <div className="checkout-line" key={item.code}><span>{item.name} × {item.quantity}</span><strong>{money(item.amount)}</strong></div>)}
    </section>}
  </div>
}

async function CheckoutDialog({booking, query}) {
  const [items, settings] = await Promise.all([bookingItems(booking.id),checkoutSettings()])
  const formula = electricityFormula(booking,settings)
  const currentFormula = electricityFormula(booking,settings,true)
  const extra = extraCharge(booking)
  const qr = !booking.completed_at && extra > 0 && booking.promptpay ? await checkoutQr(booking.promptpay,extra) : null
  const nights = (Date.parse(booking.departure) - Date.parse(booking.arrival)) / 86400000
  const { promptpay, ...summary } = booking
  return <AdminDialog title="Check-out" closeUrl={adminUrl('checkout',query)}>
    <dl className="admin-booking-detail checkout-guest">
      <div><dt>ชื่อผู้จอง</dt><dd>{booking.guest}</dd></div>
      <div><dt>เบอร์โทร</dt><dd>{booking.phone}</dd></div>
      <div><dt>วันเข้าพัก – วันออก</dt><dd>{booking.arrival} → {booking.departure}</dd></div>
      <div><dt>รหัสจอง</dt><dd><code>{booking.id}</code></dd></div>
      <div className="checkout-guest-count"><dt>จำนวนผู้เข้าพัก</dt><dd><strong>{booking.guest_count} คน</strong><br/>
        <small>ผู้ใหญ่ {booking.adults} · เด็ก {booking.children} · ผู้สูงอายุ {booking.seniors}</small>
      </dd></div>
    </dl>
    <CheckoutItems items={items} nights={nights}/>
    <CheckoutForm key={booking.id + ':' + (booking.version ?? 0) + ':' + (booking.completed_at || '')}
      action={saveCheckout.bind(null,booking.id,query)} booking={summary}
      lodging={items.filter(item => item.lodging).map(({code,name}) => ({code,name}))} savedFormula={formula}
      currentFormula={currentFormula} qr={qr} canCharge={booking.arrival <= today()}/>
  </AdminDialog>
}

export async function CheckoutList({query}) {
  const filters = checkoutFilters(query)
  const position = checkoutPosition(query)
  const current = { ...filters,...position }
  const [rows, detail] = await Promise.all([checkoutRows(filters,position),checkoutDetail(query.view)])
  const page = rows.slice(0,checkoutPageSize)
  const summaries = await checkoutSummaries(page)
  const more = rows.length > checkoutPageSize
  if (position.before) page.reverse()
  const previous = position.before ? more : Boolean(position.after)
  const next = position.before ? Boolean(page.length) : more
  const exportQuery = new URLSearchParams(filters)
  return <section className="panel stack admin-content">
    <form action="/admin" className="admin-filters checkout-filters">
      <input type="hidden" name="section" value="checkout"/>
      <label>วันเช็กอินตั้งแต่<input type="date" name="from" defaultValue={filters.from}/></label>
      <label>ถึงวันที่<input type="date" name="to" defaultValue={filters.to}/></label>
      <label>ชื่อผู้จอง / เบอร์โทร<input name="q" defaultValue={filters.q} maxLength={120}/></label>
      <label>สถานะ<select name="status" defaultValue={filters.status}>
        {Object.entries(checkoutStatuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className="button">ค้นหา</button>
      <a className="button secondary" href={'/admin/checkout-export?' + exportQuery}>ส่งออก CSV</a>
    </form>
    <div className="admin-table-scroll" tabIndex={0} aria-label="ตารางรายการ Check-out">
      <table className="admin-table checkout-table">
        <thead><tr>{['Check-out','วันที่','ล็อก / ห้อง','อุปกรณ์','ผู้จอง','สถานะ / การชำระเงิน','จำนวนเงิน'].map(label =>
          <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{page.map(row => {
          const { lodging, rentals } = summaries.get(row.id)
          const extra = extraCharge(row)
          return <tr key={row.id}>
            <td><Link className="button secondary" scroll={false} href={adminUrl('checkout',{...current,view:row.id})}
              aria-label={(row.completed_at ? 'ดู Check-out ของ ' : 'เปิด Check-out ของ ') + row.guest}>
              {row.completed_at ? 'ดูรายละเอียด' : 'เปิด Check-out'}</Link></td>
            <td className="admin-booking-date"><strong>{row.departure}</strong><br/><small>เข้าพัก {row.arrival}</small></td>
            <td>{lodging.join(', ') || '—'}</td>
            <td>{rentals.length > 0 ? <ul>{rentals.map((item,index) => <li key={index}>{item}</li>)}</ul> : '—'}</td>
            <td><strong>{row.guest}</strong><br/><small>{row.phone}</small></td>
            <td><span className={'admin-status ' + (row.completed_at ? 'confirmed' : 'pending')}>
              {row.completed_at ? checkoutStatuses.done : checkoutStatuses.open}</span>
              {extra > 0 && <><br/><small>{row.completed_at ? 'รับยอดเพิ่มแล้ว' : 'รอรับยอดเพิ่ม'}</small></>}</td>
            <td className="admin-amount"><strong>{money(row.total + extra / 100)}</strong>
              {extra > 0 && <><br/><small>ยอดเพิ่ม {money(extra / 100)}</small></>}</td>
          </tr>
        })}
        {!page.length && <tr><td colSpan={7} className="admin-empty-cell">ไม่พบรายการ Check-out</td></tr>}
        </tbody>
      </table>
    </div>
    {(previous || next || (!page.length && position.before)) && <nav className="admin-pagination actions" aria-label="แบ่งหน้ารายการ">
      {(previous || !page.length) && <Link className="button secondary" href={adminUrl('checkout',page.length
        ? {...filters,before:checkoutCursor(page[0])} : filters)}>← หน้าก่อนหน้า</Link>}
      {next && page.length > 0 && <Link className="button secondary" href={adminUrl('checkout',{...filters,after:checkoutCursor(page.at(-1))})}>หน้าถัดไป →</Link>}
    </nav>}
    {detail && <CheckoutDialog booking={detail} query={current}/>}
  </section>
}

export async function CheckoutSettings() {
  const settings = await checkoutSettings()
  return <CheckoutSettingsForm rate={settings.electricity_rate} freePerGuest={settings.free_units_per_guest} promptpay={settings.promptpay}/>
}
