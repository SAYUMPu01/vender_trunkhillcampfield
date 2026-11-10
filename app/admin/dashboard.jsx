import Link from 'next/link'
import { today } from '../../lib/camp'
import { database } from '../../lib/db'
import { effectiveStatus } from '../../lib/payment-rules'
import { checkoutSummaries } from './checkout-data'
import { adminUrl } from './navigation'

const dayMs = 86_400_000
const fullDate = new Intl.DateTimeFormat('th-TH-u-ca-gregory',{ dateStyle:'long', timeZone:'UTC' })
const shortDate = new Intl.DateTimeFormat('th-TH-u-ca-gregory',{ day:'numeric', month:'short', timeZone:'UTC' })
const number = new Intl.NumberFormat('th-TH')

async function dashboardData(date) {
  const start = Date.parse(date)
  const dates = Array.from({length:7},(_,index) => new Date(start + index * dayMs).toISOString().slice(0,10))
  const end = dates.at(-1)
  const db = database()
  const [ [queue], [arrivals], [departures], [scheduled] ] = await Promise.all([
    db.execute(`SELECT
      (SELECT COUNT(*) FROM bookings b LEFT JOIN booking_payments p ON p.booking=b.id
       WHERE b.status='pending' AND ${effectiveStatus}='pending') AS pending,
      (SELECT COUNT(*) FROM bookings b LEFT JOIN booking_checkouts c ON c.booking=b.id
       WHERE b.status='confirmed' AND b.arrival<=? AND b.departure>? AND c.completed_at IS NULL) AS staying`,[date,date]),
    db.execute(`SELECT id,guest,departure,COUNT(*) OVER () AS matching
      FROM bookings WHERE status='confirmed' AND arrival=? ORDER BY id LIMIT 6`,[date]),
    db.execute(`SELECT b.id,b.guest,b.arrival,COUNT(*) OVER () AS matching
      FROM bookings b LEFT JOIN booking_checkouts c ON c.booking=b.id
      WHERE b.status='confirmed' AND b.departure=? AND c.completed_at IS NULL ORDER BY b.id LIMIT 6`,[date]),
    db.execute(`SELECT arrival AS day, COUNT(*) AS arrivals, 0 AS departures
      FROM bookings WHERE status='confirmed' AND arrival BETWEEN ? AND ? GROUP BY arrival
      UNION ALL
      SELECT departure AS day, 0 AS arrivals, COUNT(*) AS departures
      FROM bookings WHERE status='confirmed' AND departure BETWEEN ? AND ? GROUP BY departure`,[date,end,date,end]),
  ])
  const week = new Map(dates.map(day => [day,{day,arrivals:0,departures:0}]))
  for (const row of scheduled) {
    const counts = week.get(row.day)
    counts.arrivals += Number(row.arrivals)
    counts.departures += Number(row.departures)
  }
  const summaries = await checkoutSummaries([...arrivals,...departures])
  return { ...queue[0], arrivals, departures, week:[...week.values()], summaries }
}

function DashboardMetric({label, value, detail, tone}) {
  return <div className={'panel dashboard-metric ' + tone}>
    <dt>{label}</dt>
    <dd><strong>{number.format(value)}</strong><small>{detail}</small></dd>
  </div>
}

function DashboardSchedule({week}) {
  const maximum = Math.max(1,...week.flatMap(day => [day.arrivals,day.departures]))
  return <section className="panel stack dashboard-schedule" aria-labelledby="dashboard-week">
    <div className="dashboard-section-head">
      <div><h2 id="dashboard-week">กำหนดการ 7 วัน</h2><p className="muted small">จำนวนรายการจองที่ยืนยันแล้วตามวันที่เข้าพักและวันออก</p></div>
      <div className="dashboard-legend"><span>เช็กอิน</span><span>Check-out</span></div>
    </div>
    <ol className="dashboard-chart">
      {week.map(({day,arrivals,departures}) => <li key={day}>
        <div className="dashboard-bar-pair">
          {[[arrivals,'เช็กอิน','arrival'],[departures,'Check-out','departure']].map(([count,label,tone]) =>
            <div className={'dashboard-bar ' + tone} key={tone} role="img" aria-label={label + ' ' + count + ' รายการ'}>
              <span className="dashboard-bar-track" aria-hidden="true"><span style={{height:(count / maximum * 100) + '%'}}/></span>
              <strong aria-hidden="true">{number.format(count)}</strong>
            </div>)}
        </div>
        <time dateTime={day}>{shortDate.format(new Date(day))}</time>
      </li>)}
    </ol>
  </section>
}

function DashboardQueue({rows, summaries, outgoing = false}) {
  const title = outgoing ? 'ถึงกำหนด Check-out วันนี้' : 'เช็กอินวันนี้'
  const id = outgoing ? 'dashboard-departures' : 'dashboard-arrivals'
  const total = rows[0]?.matching ?? 0
  const destination = outgoing ? adminUrl('checkout',{status:'open'}) : adminUrl('bookings',{status:'confirmed'})
  return <section className="panel stack dashboard-queue" aria-labelledby={id}>
    <div className="dashboard-section-head">
      <h2 id={id}>{title}</h2><span className="small muted">{number.format(total)} รายการ</span>
    </div>
    {rows.length ? <ul className="dashboard-bookings">
      {rows.map(row => {
        const lodging = summaries.get(row.id)?.lodging.join(' · ')
        const href = outgoing ? adminUrl('checkout',{view:row.id}) : adminUrl('bookings',{q:row.id,view:row.id})
        return <li key={row.id}>
          <div>
            <strong>{row.guest}</strong>
            <small>{[lodging,(outgoing ? 'เข้าพัก ' : 'ออก ') + shortDate.format(new Date(outgoing ? row.arrival : row.departure))].filter(Boolean).join(' · ')}</small>
          </div>
          <Link className="button secondary" href={href} aria-label={(outgoing ? 'เปิด Check-out ของ ' : 'ดูการจองของ ') + row.guest}>
            {outgoing ? 'Check-out' : 'ดูการจอง'}
          </Link>
        </li>
      })}
    </ul> : <p className="dashboard-empty muted">{outgoing ? 'ไม่มีรายการที่ต้อง Check-out วันนี้' : 'ไม่มีรายการเช็กอินวันนี้'}</p>}
    <div className="actions">
      {total > rows.length && <span className="small muted">แสดง {rows.length} จาก {number.format(total)} รายการ</span>}
      <Link className="text-button" href={destination}>{outgoing ? 'เปิดรายการ Check-out' : 'เปิดรายการจองที่ยืนยันแล้ว'} →</Link>
    </div>
  </section>
}

export async function Dashboard() {
  const date = today()
  const {pending,staying,arrivals,departures,week,summaries} = await dashboardData(date)
  return <div className="stack admin-dashboard">
    <section className="dashboard-banner">
      <div>
        <span className="eyebrow">TRUNKHILL CAMPFIELD</span>
        <h2>ภาพรวมการเข้าพัก</h2>
        <p>วันนี้ <time dateTime={date}>{fullDate.format(new Date(date))}</time> · เวลาไทย</p>
      </div>
      <div className="actions">
        <Link className="button secondary" href={adminUrl('bookings',{status:'pending'})}>ดูรายการรอตรวจสอบ</Link>
        <Link className="button secondary" href={adminUrl('checkout')}>เปิด Check-out</Link>
      </div>
    </section>
    <dl className="dashboard-metrics" aria-label="สรุปรายการจอง">
      <DashboardMetric label="เช็กอินวันนี้" value={arrivals[0]?.matching ?? 0} detail="รายการจองที่ยืนยันแล้ว" tone="arrival"/>
      <DashboardMetric label="ต้อง Check-out วันนี้" value={departures[0]?.matching ?? 0} detail="ถึงกำหนดออกและยังไม่ปิดรายการ" tone="departure"/>
      <DashboardMetric label="อยู่ในช่วงเข้าพัก" value={staying} detail="ตามวันที่จองและยังไม่ Check-out" tone="staying"/>
      <DashboardMetric label="รอตรวจสอบ" value={pending} detail="รายการจองที่ยังมีผล" tone="pending"/>
    </dl>
    <DashboardSchedule week={week}/>
    <div className="dashboard-queues">
      <DashboardQueue rows={arrivals} summaries={summaries}/>
      <DashboardQueue rows={departures} summaries={summaries} outgoing/>
    </div>
  </div>
}
