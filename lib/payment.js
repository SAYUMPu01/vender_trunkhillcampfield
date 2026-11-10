import { createHash } from 'node:crypto'
import { CampError } from './camp'
import { database, transaction } from './db'
import { uploadMime } from './payment-rules'

function credentials(request) {
  const id = request.nextUrl.searchParams.get('id')
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  if (!id || !/^[A-F0-9]{20}$/.test(id) || !token) throw new CampError('ไม่พบข้อมูลชำระเงิน',404)
  return [id,createHash('sha256').update(token).digest('hex')]
}

export async function paymentDetails(request) {
  const [id,tokenHash] = credentials(request)
  const [[booking]] = await database().execute(
    `SELECT b.id,b.arrival,b.departure,b.total,b.status,b.adults,b.children,b.seniors,
      TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),p.expires_at) AS remaining,
      p.submitted_at IS NOT NULL AS submitted,config.recipient
     FROM booking_payments p JOIN bookings b ON b.id=p.booking
     LEFT JOIN payment_config config ON config.id=1 WHERE p.booking=? AND p.token_hash=?`,[id,tokenHash])
  if (!booking) throw new CampError('ไม่พบข้อมูลชำระเงิน',404)
  const [items] = await database().execute(
    'SELECT name,quantity,amount FROM booking_lines WHERE booking=? ORDER BY code',[id])
  return { ...booking, items }
}

export async function submitPayment(request) {
  const [id,tokenHash] = credentials(request)
  const length = Number(request.headers.get('content-length'))
  if (length > 6 * 1024 * 1024) throw new CampError('สลิปขนาดไม่เกิน 5 MB',413)
  const form = await request.formData()
  const file = form.get('slip')
  if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) {
    throw new CampError('แนบสลิปขนาดไม่เกิน 5 MB')
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = uploadMime(bytes,true)
  if (!mime) throw new CampError('รองรับสลิป JPG, PNG, WebP หรือ PDF')
  await transaction(async connection => {
    const [[booking]] = await connection.execute('SELECT status FROM bookings WHERE id=? FOR UPDATE',[id])
    const [[payment]] = await connection.execute(
      'SELECT submitted_at FROM booking_payments WHERE booking=? AND token_hash=?',[id,tokenHash])
    if (!payment || !booking) throw new CampError('ไม่พบข้อมูลชำระเงิน',404)
    if (booking.status === 'cancelled') throw new CampError('รายการจองถูกยกเลิกแล้ว',409)
    if (payment.submitted_at) return
    const [[config]] = await connection.query('SELECT id FROM payment_config WHERE id=1')
    if (!config) throw new CampError('แคมป์ยังไม่ได้ตั้งค่า QR รับเงิน',409)
    const [lines] = await connection.execute('SELECT code FROM booking_lines WHERE booking=? ORDER BY code',[id])
    for (const { code } of lines) {
      await connection.execute('SELECT code FROM inventory WHERE code=? FOR UPDATE',[code])
    }
    const [result] = await connection.execute(
      `UPDATE booking_payments SET submitted_at=UTC_TIMESTAMP(),mime=?,slip=?
       WHERE booking=? AND submitted_at IS NULL AND expires_at > UTC_TIMESTAMP()`,[mime,bytes,id])
    if (!result.affectedRows) throw new CampError('หมดเวลาชำระเงิน กรุณาจองใหม่',409)
  })
  return paymentDetails(request)
}
