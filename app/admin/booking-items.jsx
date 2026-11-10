import { database } from '../../lib/db'
import { money } from '../../lib/pricing'

export const lodgingLine = `(i.kind = 'plot' OR (i.kind = 'room' AND NOT EXISTS (
  SELECT 1 FROM booking_rentals attached WHERE attached.booking = l.booking AND attached.code = l.code
)))`

export async function bookingItems(id) {
  const [items] = await database().execute(
    `SELECT l.code,l.name,l.quantity,l.amount,i.detail,${lodgingLine} AS lodging
     FROM booking_lines l JOIN inventory i ON i.code=l.code WHERE l.booking=?
     ORDER BY lodging DESC,l.code`,[id])
  const [assignments] = await database().execute(
    `SELECT r.code,r.host AS host_code,h.name AS host,r.quantity FROM booking_rentals r
     JOIN booking_lines h ON h.booking=r.booking AND h.code=r.host
     WHERE r.booking=? ORDER BY r.host`,[id])
  const hostsByItem = new Map()
  for (const row of assignments) {
    const hosts = hostsByItem.get(row.code) || []
    hosts.push(row)
    hostsByItem.set(row.code,hosts)
  }
  return items.map(item => {
    const assignments = hostsByItem.get(item.code) || []
    return { ...item, assignments, hosts:assignments.map(row => row.host + ' × ' + row.quantity) }
  })
}

export function BookingItemsTable({ items, label }) {
  return <table className="admin-items-table" aria-label={label}>
    <thead><tr><th scope="col">รายการ</th><th scope="col">จำนวน</th><th scope="col">ยอดรายการ</th></tr></thead>
    <tbody>{items.map(item => <tr key={item.code}>
      <th scope="row">{item.name}{item.hosts.length > 0 && <small>{item.hosts.join(' · ')}</small>}</th>
      <td>{item.quantity}</td><td><strong>{money(item.amount)}</strong></td>
    </tr>)}
    {!items.length && <tr><td colSpan={3}>ไม่มีรายการ</td></tr>}
    </tbody>
  </table>
}

export function BookingBreakdown({ items, nights }) {
  const groups = [
    { label:'ลาน / ห้องพัก', tone:'lodging', items:items.filter(item => item.lodging) },
    { label:'อุปกรณ์เช่าและบริการเสริม', tone:'rental', items:items.filter(item => !item.lodging) },
  ]
  return <section className="admin-breakdown">
    <header><strong>รายการจำแนกตามประเภท</strong><span className="muted">พัก {nights} คืน</span></header>
    <div className="admin-breakdown-grid">{groups.map(group => <section key={group.tone} className={'admin-item-group ' + group.tone}>
      <h3>{group.label}<span>{group.items.length} รายการ</span></h3>
      <BookingItemsTable items={group.items} label={group.label}/>
    </section>)}</div>
  </section>
}
