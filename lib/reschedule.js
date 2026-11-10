import { assertStock, bookingIdentity, CampError, dates, integer, lookup, phoneNumber, today } from './camp'
import { rescheduleLimit, rescheduleReason, stayNights } from './booking-dates'
import { transaction } from './db'

export async function rescheduleBooking({id,phone,arrival,departure,revision}) {
  const identity = bookingIdentity(id,phoneNumber(phone))
  if (!integer(revision,0,rescheduleLimit)) throw new CampError('ข้อมูลการจองเปลี่ยนแล้ว กรุณาค้นหาใหม่')
  const nights = dates(arrival,departure)
  try {
    await transaction(async connection => {
      const [[booking]] = await connection.execute(
        'SELECT id,status,arrival,departure,reschedule_count FROM bookings WHERE id=? AND phone=? FOR UPDATE',identity)
      if (!booking) throw new CampError('ไม่พบรายการจอง',404)
      const sameDates = booking.arrival === arrival && booking.departure === departure
      if (booking.reschedule_count === revision + 1 && sameDates) return
      if (booking.reschedule_count !== revision) throw new CampError('รายการถูกเลื่อนไปแล้ว กรุณาค้นหาใหม่ก่อนเลือกวันที่',409)
      const [[checkout]] = await connection.execute('SELECT booking FROM booking_checkouts WHERE booking=?',[booking.id])
      const reason = rescheduleReason({...booking,checked_out:!!checkout},today())
      if (reason) throw new CampError(reason,409)
      if (sameDates) throw new CampError('กรุณาเลือกวันเข้าพักใหม่')
      if (nights.length !== stayNights(booking.arrival,booking.departure)) throw new CampError('กรุณาคงจำนวนคืนเท่ากับการจองเดิม')

      const [lines] = await connection.execute('SELECT code,name,quantity FROM booking_lines WHERE booking=?',[booking.id])
      if (!lines.length) throw new CampError('รายการนี้ไม่มีข้อมูลล็อกหรืออุปกรณ์ กรุณาติดต่อแคมป์',409)
      lines.sort((a,b) => a.code < b.code ? -1 : 1)
      const stock = []
      for (const line of lines) {
        const [[item]] = await connection.execute('SELECT stock,active FROM inventory WHERE code=? FOR UPDATE',[line.code])
        if (!item?.active) throw new CampError(`${line.name} ไม่เปิดให้จองในวันใหม่ กรุณาติดต่อแคมป์`,409)
        stock.push({...line,stock:item.stock})
      }
      await assertStock(connection,stock,arrival,departure,booking.id)
      await connection.execute('DELETE FROM allocations WHERE booking=?',[booking.id])
      await connection.query('INSERT INTO allocations (code,night,booking,quantity) VALUES ?',[
        lines.flatMap(line => nights.map(night => [line.code,night,booking.id,line.quantity])),
      ])
      await connection.execute(
        'UPDATE bookings SET arrival=?,departure=?,reschedule_count=reschedule_count+1 WHERE id=?',
        [arrival,departure,booking.id])
    })
  } catch (error) {
    if (['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw new CampError('ระบบกำลังประมวลผล กรุณาลองอีกครั้ง',503)
    throw error
  }
  return lookup(...identity)
}
