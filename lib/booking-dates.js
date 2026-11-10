const day = 86_400_000
export const stayNights = (arrival, departure) => (Date.parse(departure) - Date.parse(arrival)) / day
export const shiftDate = (date, days) => new Date(Date.parse(date) + days * day).toISOString().slice(0,10)
export const rescheduleLimit = 3
export const rescheduleNotice = 3

export function rescheduleReason(booking, today) {
  if (booking.checked_out || booking.status !== 'confirmed') return 'เลื่อนวันได้เฉพาะรายการที่แคมป์ยืนยันแล้วและยังไม่ Check-out'
  if (booking.reschedule_count >= rescheduleLimit) return 'ใช้สิทธิ์เลื่อนครบ 3 ครั้งแล้ว'
  if (booking.arrival < shiftDate(today,rescheduleNotice)) return 'ต้องเลื่อนล่วงหน้าอย่างน้อย 3 วันก่อนวันเข้าพักเดิม'
  return ''
}
