import { createHash, randomBytes } from 'node:crypto'
import { database, transaction } from './db'
import { stayTotal } from './pricing'
import { isRentalStay } from './rentals'
import { effectiveStatus, liveAllocation } from './payment-rules'
import { rescheduleReason } from './booking-dates'

export class CampError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const day = 86400000
const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' })
export const today = () => dateFormat.format(new Date())

export function dates(arrival, departure) {
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const time = Date.parse(value)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN
  }
  const start = parse(arrival)
  const nights = (parse(departure) - start) / day
  if (arrival < today() || !(nights >= 1 && nights <= 30)) {
    throw new CampError('เลือกวันที่ปัจจุบันหรือวันถัดไป และจองได้ครั้งละ 1–30 คืน')
  }
  return Array.from({ length: nights }, (_, i) => new Date(start + i * day).toISOString().slice(0, 10))
}

export const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
export const codePattern = /^[A-Z0-9][A-Z0-9-]{0,23}$/
export const phoneNumber = value => typeof value === 'string' ? value.replace(/[ ()-]/g, '') : ''

export async function assertStock(connection, rows, arrival, departure, ignoreBooking) {
  for (const row of rows) {
    const [[{ peak }]] = await connection.execute(
      `SELECT COALESCE(MAX(used),0) AS peak FROM (
         SELECT SUM(quantity) AS used FROM allocations a WHERE code = ? AND night >= ? AND night < ?
           ${ignoreBooking ? 'AND booking <> ?' : ''} AND ${liveAllocation} GROUP BY night
       ) nightly`, [row.code,arrival,departure,...(ignoreBooking ? [ignoreBooking] : [])])
    if (Number(peak) + row.quantity > row.stock) {
      throw new CampError(`${row.name} ไม่ว่างหรือเหลือไม่พอ ${ignoreBooking ? 'กรุณาเลือกวันใหม่' : 'กรุณาเลือกรายการใหม่'}`,409)
    }
  }
}

export async function catalog(arrival, departure) {
  const selectedDates = arrival || departure
  if (selectedDates) dates(arrival, departure)
  const connection = await database().getConnection()
  try {
    const [[settings]] = await connection.query(
      `SELECT mode, person_price, minimum_per_plot,
       (SELECT revision FROM plot_map_background WHERE id=1) AS map_version FROM settings WHERE id=1`)
    const [inventory] = selectedDates
      ? await connection.execute(`SELECT i.*, m.x AS map_x, m.y AS map_y, m.shape_json AS map_shape,
          GREATEST(0, i.stock - COALESCE(a.peak,0)) AS available,
          EXISTS(SELECT 1 FROM inventory_photos p WHERE p.code=i.code) AS has_photo
          FROM inventory i LEFT JOIN plot_map_positions m ON m.code=i.code LEFT JOIN (
            SELECT code, MAX(used) AS peak FROM (
              SELECT code, night, SUM(quantity) AS used FROM allocations a
              WHERE night >= ? AND night < ? AND ${liveAllocation} GROUP BY code, night
            ) nightly GROUP BY code
          ) a ON a.code = i.code WHERE i.active = 1 ORDER BY i.code`, [arrival, departure])
      : await connection.query(`SELECT i.*, m.x AS map_x, m.y AS map_y, m.shape_json AS map_shape, stock AS available,
          EXISTS(SELECT 1 FROM inventory_photos p WHERE p.code=i.code) AS has_photo
          FROM inventory i LEFT JOIN plot_map_positions m ON m.code=i.code WHERE active = 1 ORDER BY i.code`)
    return { settings, inventory }
  } finally {
    connection.release()
  }
}

export async function reserve(body) {
  const { arrival, departure, adults, children, seniors, items, requestKey } = body
  const guest = typeof body.guest === 'string' ? body.guest.trim() : ''
  const phone = phoneNumber(body.phone)
  const paymentToken = body.paymentToken
  if (typeof paymentToken !== 'string' || !/^[a-f0-9]{64}$/.test(paymentToken)) {
    throw new CampError('รหัสชำระเงินไม่ถูกต้อง')
  }
  if (!guest || guest.length > 120 || !/^\+?\d{8,15}$/.test(phone)) throw new CampError('กรอกชื่อและเบอร์โทรให้ถูกต้อง')
  if (![adults, children, seniors].every(value => integer(value, 0, 100))) throw new CampError('จำนวนผู้เข้าพักไม่ถูกต้อง')
  if (!Array.isArray(items) || !items.length || items.length > 40 ||
      !items.every(item => item && typeof item.code === 'string' && codePattern.test(item.code) && integer(item.quantity, 1, 100))) {
    throw new CampError('เลือกลาน ห้องพัก หรืออุปกรณ์อย่างน้อยหนึ่งรายการ')
  }
  if (typeof requestKey !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(requestKey)) {
    throw new CampError('รหัสคำขอไม่ถูกต้อง')
  }
  const ordered = items.map(({ code, quantity }) => ({ code, quantity })).sort((a, b) => a.code < b.code ? -1 : 1)
  if (new Set(ordered.map(item => item.code)).size !== ordered.length) throw new CampError('พบรายการซ้ำ')
  const rentals = body.rentalLines ?? []
  if (!Array.isArray(rentals) || rentals.length > 1600 || !rentals.every(line =>
    line && typeof line.host === 'string' && codePattern.test(line.host) &&
    typeof line.code === 'string' && codePattern.test(line.code) && integer(line.quantity, 1, 100))) {
    throw new CampError('ข้อมูลอุปกรณ์ประจำล็อกไม่ถูกต้อง')
  }
  const rentalLines = rentals.map(({ host, code, quantity }) => ({ host, code, quantity }))
    .sort((a, b) => a.host.localeCompare(b.host) || a.code.localeCompare(b.code))
  if (new Set(rentalLines.map(line => line.host + ':' + line.code)).size !== rentalLines.length) {
    throw new CampError('พบอุปกรณ์ซ้ำในล็อกเดียวกัน')
  }
  const identity = [arrival, departure, adults, children, seniors, ordered, guest, phone]
  if (rentalLines.length) identity.push(rentalLines)
  identity.push(paymentToken)
  const hash = createHash('sha256').update(JSON.stringify(identity)).digest('hex')
  const existing = async connection => {
    const [[booking]] = await connection.execute('SELECT id, total, status, request_hash FROM bookings WHERE request_key = ?', [requestKey])
    if (!booking) return null
    if (booking.request_hash !== hash) throw new CampError('คำขอนี้ถูกใช้แล้ว กรุณาเริ่มรายการใหม่', 409)
    return { id: booking.id, total: booking.total, status: booking.status }
  }

  try {
    return await transaction(async connection => {
      const previous = await existing(connection)
      if (previous) return previous
      const nights = dates(arrival, departure)
      const rows = []
      for (const item of ordered) {
        const [[row]] = await connection.execute('SELECT * FROM inventory WHERE code = ? FOR UPDATE', [item.code])
        if (row) rows.push({ ...row, quantity: item.quantity })
      }

      const retry = await existing(connection)
      if (retry) return retry
      if (rows.length !== ordered.length || rows.some(row => !row.active || (row.kind !== 'gear' && row.quantity !== 1))) {
        throw new CampError('รายการที่เลือกเปิดให้จองไม่ครบแล้ว', 409)
      }
      const inventory = new Map(rows.map(row => [row.code, row]))
      const attachedRooms = new Set(rentalLines.filter(line => inventory.get(line.code)?.kind === 'room').map(line => line.code))
      const assigned = new Map()
      const staysByHost = new Map()
      for (const { host, code, quantity } of rentalLines) {
        const owner = inventory.get(host)
        const rental = inventory.get(code)
        if (!owner || owner.kind === 'gear' || attachedRooms.has(host) || !rental || rental.kind === 'plot') {
          throw new CampError('อุปกรณ์ต้องอยู่ในล็อกหรือห้องพักที่เลือก')
        }
        const assignedQuantity = (assigned.get(code) || 0) + quantity
        if (assignedQuantity > rental.quantity) throw new CampError('จำนวนอุปกรณ์ประจำล็อกเกินยอดจอง')
        assigned.set(code, assignedQuantity)
        if (isRentalStay(rental)) {
          if (quantity !== 1 || staysByHost.has(host)) {
            throw new CampError('เลือกเต็นท์หรือบ้านพักได้เพียง 1 รายการต่อหนึ่งล็อก')
          }
          staysByHost.set(host, code)
        }
      }
      if (rows.some(row => row.kind === 'gear' && isRentalStay(row) && row.quantity > (assigned.get(row.code) || 0)) &&
          rows.filter(isRentalStay).reduce((sum, row) => sum + row.quantity - (assigned.get(row.code) || 0), 0) > 1) {
        throw new CampError('ระบุล็อกสำหรับเต็นท์หรือบ้านพักที่เช่าเพิ่ม')
      }
      if (rows.some(row => row.kind !== 'gear') && adults + children + seniors < 1) {
        throw new CampError('ระบุจำนวนผู้เข้าพักอย่างน้อย 1 คน')
      }

      const [[settings]] = await connection.query('SELECT * FROM settings WHERE id = 1')
      await assertStock(connection,rows,arrival,departure)

      const total = stayTotal(rows, settings, adults, nights.length)
      if (body.expectedTotal !== total) throw new CampError('ราคาเปลี่ยน กรุณาตรวจสอบยอดรวมแล้วส่งคำขออีกครั้ง', 409)
      const id = randomBytes(10).toString('hex').toUpperCase()
      await connection.execute(
        `INSERT INTO bookings (id,request_key,request_hash,guest,phone,arrival,departure,adults,children,seniors,total)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [id, requestKey, hash, guest, phone, arrival, departure, adults, children, seniors, total])
      await connection.execute(
        `INSERT INTO booking_payments (booking,token_hash,expires_at,submitted_at)
         VALUES (?,?,UTC_TIMESTAMP() + INTERVAL 5 MINUTE,IF(?=0,UTC_TIMESTAMP(),NULL))`,
        [id,createHash('sha256').update(paymentToken).digest('hex'),total],
      )
      const plots = rows.filter(row => row.kind === 'plot')
      const plotTotal = stayTotal(plots, settings, adults, nights.length)
      const perPerson = settings.mode === 'person' && plots.length > 0
      await connection.query('INSERT INTO booking_lines (booking,code,name,quantity,amount) VALUES ?', [rows.map(row =>
        [id, row.code, row.name, row.quantity,
          perPerson && row.kind === 'plot' ? (row === plots[0] ? plotTotal : 0) : row.price * row.quantity * nights.length])])
      if (rentalLines.length) {
        await connection.query('INSERT INTO booking_rentals (booking,host,code,quantity) VALUES ?',
          [rentalLines.map(line => [id, line.host, line.code, line.quantity])])
      }
      await connection.query('INSERT INTO allocations (code,night,booking,quantity) VALUES ?', [
        rows.flatMap(row => nights.map(night => [row.code, night, id, row.quantity])),
      ])
      return { id, total, status: 'pending' }
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const retry = await existing(database())
      if (retry) return retry
    }
    if (['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw new CampError('ระบบกำลังประมวลผล กรุณาลองส่งคำขอเดิมอีกครั้ง', 503)
    throw error
  }
}

export function bookingIdentity(id, phone) {
  if (typeof id !== 'string' || !/^[A-Fa-f0-9]{20}$/.test(id) || !/^\+?\d{8,15}$/.test(phone)) throw new CampError('กรอกรหัสจองและเบอร์โทรให้ถูกต้อง')
  return [id.toUpperCase(),phone]
}

export async function lookup(id, phone) {
  const identity = bookingIdentity(id,phone)
  const [[booking]] = await database().execute(
    `SELECT b.id,b.guest,b.arrival,b.departure,b.adults,b.children,b.seniors,b.total,b.reschedule_count,
       ${effectiveStatus} AS status,(c.completed_at IS NOT NULL) AS checked_out,
       (p.booking IS NOT NULL) AS payment_required,(p.submitted_at IS NOT NULL) AS payment_submitted
     FROM bookings b LEFT JOIN booking_payments p ON p.booking=b.id LEFT JOIN booking_checkouts c ON c.booking=b.id
     WHERE b.id = ? AND b.phone = ?`, identity)
  if (!booking) throw new CampError('ไม่พบรายการจอง', 404)
  const [lines] = await database().execute(
    `SELECT l.code,l.name,l.quantity,l.amount,i.kind,i.zone,m.x AS map_x,m.y AS map_y,m.shape_json AS map_shape
     FROM booking_lines l JOIN inventory i ON i.code=l.code LEFT JOIN plot_map_positions m ON m.code=l.code
     WHERE l.booking=? ORDER BY l.code`,[booking.id])
  const [rentalLines] = await database().execute(
    `SELECT r.host AS host_code,r.code,host.name AS host,rental.name,r.quantity FROM booking_rentals r
     JOIN booking_lines host ON host.booking = r.booking AND host.code = r.host
     JOIN booking_lines rental ON rental.booking = r.booking AND rental.code = r.code
     WHERE r.booking = ? ORDER BY r.host, r.code`, [booking.id])
  const [[map]] = await database().query('SELECT revision FROM plot_map_background WHERE id=1')
  const date = today()
  return { ...booking, lines, rentalLines, map_version:map?.revision, today:date, reschedule_block:rescheduleReason(booking,date) }
}

