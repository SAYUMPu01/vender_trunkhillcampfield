import { database } from '../../lib/db'
import { defaultElectricity } from '../../lib/checkout-pricing'
import { lodgingLine } from './booking-items'

export const checkoutPageSize = 30
export const checkoutStatuses = { open:'ยังไม่ Check-out', done:'Check-out แล้ว', all:'ทุกสถานะ' }
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const cursorPattern = /^\d{4}-\d{2}-\d{2}\|[A-F0-9]{20}$/

function dateFilter(value) {
  if (typeof value !== 'string' || !datePattern.test(value) || value < '1000-01-01') return ''
  const parsed = new Date(value)
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0,10) === value ? value : ''
}

export function checkoutFilters(query) {
  return {
    from:dateFilter(query.from),
    to:dateFilter(query.to),
    q:typeof query.q === 'string' ? query.q.trim().slice(0,120) : '',
    status:typeof query.status === 'string' && Object.hasOwn(checkoutStatuses,query.status) ? query.status : 'open',
  }
}

export function checkoutPosition(query) {
  if (typeof query.before === 'string' && cursorPattern.test(query.before)) return { before:query.before }
  if (typeof query.after === 'string' && cursorPattern.test(query.after)) return { after:query.after }
  return {}
}

export const checkoutCursor = row => row.departure + '|' + row.id
const checkoutColumns = `b.id,b.arrival,b.departure,b.guest,b.phone,b.total,
  c.version,c.units_milli,c.electricity_rate,c.free_units_per_guest,c.electricity_amount,c.damage_amount,c.other_amount,c.note,c.promptpay,c.completed_at`

export const checkoutOccupancy = `b.adults + b.children + b.seniors AS guest_count,
  (SELECT COALESCE(SUM(l.quantity),0) FROM booking_lines l JOIN inventory i ON i.code=l.code
   WHERE l.booking=b.id AND i.kind='plot') AS plot_count`

export async function checkoutSettings(connection = database()) {
  const [[settings]] = await connection.query('SELECT electricity_rate,free_units_per_guest,promptpay FROM checkout_settings WHERE id=1')
  return settings || { ...defaultElectricity, promptpay:null }
}

export async function checkoutRows(filters, position = {}) {
  const clauses = ["b.status='confirmed'"]
  const params = []
  if (filters.status !== 'all') clauses.push(filters.status === 'done' ? 'c.completed_at IS NOT NULL' : 'c.completed_at IS NULL')
  if (filters.from) {
    clauses.push('b.arrival >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    clauses.push('b.arrival <= ?')
    params.push(filters.to)
  }
  if (filters.q) {
    const search = value => '%' + value.replace(/[!%_]/g,'!$&') + '%'
    const phone = filters.q.replace(/[ ()-]/g,'')
    clauses.push("(b.guest LIKE ? ESCAPE '!' OR b.phone LIKE ? ESCAPE '!' OR b.id = ?)")
    params.push(search(filters.q),search(phone || filters.q),filters.q.toUpperCase())
  }
  const direction = position.before ? 'DESC' : 'ASC'
  const value = position.before || position.after
  if (value) {
    const [date,id] = value.split('|')
    const operator = position.before ? '<' : '>'
    clauses.push(`(b.departure ${operator} ? OR (b.departure = ? AND b.id ${operator} ?))`)
    params.push(date,date,id)
  }
  const [rows] = await database().execute(
    `SELECT ${checkoutColumns}
     FROM bookings b LEFT JOIN booking_checkouts c ON c.booking=b.id
     WHERE ${clauses.join(' AND ')} ORDER BY b.departure ${direction}, b.id ${direction} LIMIT ?`,[...params,checkoutPageSize+1])
  return rows
}

export async function checkoutDetail(id) {
  if (typeof id !== 'string' || !/^[A-F0-9]{20}$/.test(id)) return null
  const [[row]] = await database().execute(
    `SELECT ${checkoutColumns},c.lodging_charges,b.adults,b.children,b.seniors,${checkoutOccupancy}
     FROM bookings b LEFT JOIN booking_checkouts c ON c.booking=b.id
     WHERE b.id=? AND b.status='confirmed'`,[id])
  return row
}

export async function checkoutLodgingCodes(connection, id) {
  const [rows] = await connection.execute(
    `SELECT l.code FROM booking_lines l JOIN inventory i ON i.code=l.code
     WHERE l.booking=? AND ${lodgingLine} ORDER BY l.code`,[id])
  return rows.map(row => row.code)
}

export async function checkoutSummaries(rows) {
  if (!rows.length) return new Map()
  const ids = rows.map(row => row.id)
  const [items] = await database().execute(
    `SELECT l.booking,l.name,l.quantity,${lodgingLine} AS lodging
     FROM booking_lines l JOIN inventory i ON i.code=l.code
     WHERE l.booking IN (${ids.map(() => '?').join(',')}) ORDER BY l.code`,ids)
  const byBooking = new Map(rows.map(row => [row.id,{ lodging:[], rentals:[] }]))
  for (const item of items) {
    byBooking.get(item.booking)[item.lodging ? 'lodging' : 'rentals'].push(
      item.quantity > 1 ? item.name + ' × ' + item.quantity : item.name)
  }
  return byBooking
}
