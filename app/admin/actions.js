'use server'

import { redirect } from 'next/navigation'
import { authenticate, clearSession, isAdmin } from '../../lib/auth'
import { database, transaction } from '../../lib/db'
import { codePattern, integer } from '../../lib/camp'
import { adminUrl, inventorySections } from './navigation'
import { liveAllocation, uploadMime } from '../../lib/payment-rules'

async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin')
}

export async function login(data) {
  redirect((await authenticate(data.get('password'))) ? '/admin' : '/admin?error=login')
}

export async function logout() {
  await clearSession()
  redirect('/admin')
}

export async function changeStatus(data) {
  await requireAdmin()
  const id = data.get('id')
  const status = data.get('status')
  if (typeof id !== 'string' || !/^[A-F0-9]{20}$/.test(id) || !['confirmed','cancelled'].includes(status)) redirect('/admin?error=invalid')
  const updated = await transaction(async connection => {
    const [[booking]] = await connection.execute('SELECT status FROM bookings WHERE id = ? FOR UPDATE', [id])
    if (!booking || booking.status === 'cancelled') return false
    if (status === 'confirmed') {
      const [[payment]] = await connection.execute('SELECT submitted_at FROM booking_payments WHERE booking=?',[id])
      if (payment && !payment.submitted_at) return false
    }
    if (status === 'cancelled') {
      const [[checkout]] = await connection.execute('SELECT completed_at FROM booking_checkouts WHERE booking=?',[id])
      if (checkout?.completed_at) return false
      const [lines] = await connection.execute('SELECT code FROM booking_lines WHERE booking = ? ORDER BY code', [id])
      for (const { code } of lines) await connection.execute('SELECT code FROM inventory WHERE code = ? FOR UPDATE', [code])
      await connection.execute('DELETE FROM allocations WHERE booking = ?', [id])
    }
    await connection.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, id])
    return true
  })
  redirect(adminUrl('bookings', { ...(updated ? {saved:'booking'} : {error:'invalid'}), q:data.get('q'), status:data.get('filterStatus') }))
}

export async function savePaymentConfig(data) {
  await requireAdmin()
  const recipient = String(data.get('recipient') || '').trim()
  const file = data.get('qr')
  if (!recipient || recipient.length > 120 || !(file instanceof File) || !file.size || file.size > 750 * 1024) {
    redirect(adminUrl('payment',{error:'invalid'}))
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = uploadMime(bytes)
  if (!mime) redirect(adminUrl('payment',{error:'photo'}))
  await database().execute(
    'INSERT INTO payment_config (id,recipient,mime,qr) VALUES (1,?,?,?) ON DUPLICATE KEY UPDATE recipient=?,mime=?,qr=?',
    [recipient,mime,bytes,recipient,mime,bytes],
  )
  redirect(adminUrl('payment',{saved:'payment'}))
}

export async function saveSettings(data) {
  await requireAdmin()
  const mode = data.get('mode')
  const price = Number(data.get('price'))
  const minimum = Number(data.get('minimum'))
  if (!['person','plot'].includes(mode) || !integer(price, 0, 100000) || !integer(minimum, 0, 20)) redirect(adminUrl('pricing', { error:'invalid' }))
  await database().execute('UPDATE settings SET mode = ?, person_price = ?, minimum_per_plot = ? WHERE id = 1', [mode, price, minimum])
  redirect(adminUrl('pricing', { saved:'settings' }))
}

export async function saveInventory(data) {
  await requireAdmin()
  const original = data.get('original')
  const code = String(data.get('code')).trim().toUpperCase()
  const kind = data.get('kind')
  const zone = data.get('zone')
  const name = String(data.get('name')).trim()
  const detail = String(data.get('detail')).trim()
  const price = Number(data.get('price'))
  const stock = kind === 'gear' ? Number(data.get('stock')) : 1
  const active = data.has('active')
  const allowedZones = { plot: ['A','B','C','D'], room: ['BOX'], gear: ['GEAR'] }
  const section = Object.hasOwn(inventorySections,kind) ? inventorySections[kind] : 'plots'
  const filters = { q:data.get('q'), zone:data.get('filterZone') }
  const file = data.get('photo')
  let photo
  let mime
  if (file instanceof File && file.size > 0) {
    if (file.size > 750 * 1024 || kind === 'plot') redirect(adminUrl(section, { ...filters, error:'photo' }))
    photo = Buffer.from(await file.arrayBuffer())
    if (photo.subarray(0,3).equals(Buffer.from([255,216,255]))) mime = 'image/jpeg'
    else if (photo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png'
    else if (photo.toString('ascii',0,4) === 'RIFF' && photo.toString('ascii',8,12) === 'WEBP') mime = 'image/webp'
    if (!mime) redirect(adminUrl(section, { ...filters, error:'photo' }))
  }
  if (!codePattern.test(code) || (original && original !== code) ||
      !Object.hasOwn(allowedZones, kind) || !allowedZones[kind].includes(zone) ||
      !name || name.length > 120 || detail.length > 240 || !integer(price, 0, 100000) || !integer(stock, 0, 1000)) {
    redirect(adminUrl(section, { ...filters, error:'invalid' }))
  }

  let result
  try {
    result = await transaction(async connection => {
      const [[current]] = await connection.execute('SELECT * FROM inventory WHERE code = ? FOR UPDATE', [code])
      if (!current && !original) {
        await connection.execute('INSERT INTO inventory VALUES (?,?,?,?,?,?,?,?)', [code,kind,zone,name,detail,price,stock,active])
      } else {
      if (!current || !original || current.kind !== kind) return 'invalid'
      const [[{ peak }]] = await connection.execute(
        `SELECT COALESCE(MAX(used),0) AS peak FROM (
           SELECT SUM(quantity) AS used FROM allocations a WHERE code = ? AND night >= CURRENT_DATE
             AND ${liveAllocation} GROUP BY night
         ) nightly`, [code])
      if (stock < Number(peak)) return 'stock'
      await connection.execute('UPDATE inventory SET zone=?,name=?,detail=?,price=?,stock=?,active=? WHERE code=?', [zone,name,detail,price,stock,active,code])
      }
      if (photo) {
        await connection.execute(
          'INSERT INTO inventory_photos (code,mime,photo) VALUES (?,?,?) ON DUPLICATE KEY UPDATE mime=?, photo=?',
          [code,mime,photo,mime,photo],
        )
      }
      return 'saved'
    })
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error
    result = 'invalid'
  }
  redirect(adminUrl(section, { ...filters, ...(result === 'saved' ? { saved:'inventory' } : { error:result }) }))
}
