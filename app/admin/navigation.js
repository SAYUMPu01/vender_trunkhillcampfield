export const adminSections = {
  dashboard: 'Dashboard',
  bookings: 'รายการจอง',
  checkout: 'Check-out',
  plots: 'ลานกางเต็นท์',
  rooms: 'ห้องพัก',
  gear: 'อุปกรณ์ให้เช่า',
  zoneMedia: 'รายละเอียดและสื่อโซน',
  plotMap: 'จัดการผังลาน',
  pricing: 'ตั้งราคา',
  payment: 'ตั้งค่า QR รับเงิน',
  checkoutSettings: 'ตั้งค่า Check-out',
}

export const inventoryKinds = { plots:'plot', rooms:'room', gear:'gear' }
export const inventorySections = { plot:'plots', room:'rooms', gear:'gear' }

export function adminUrl(section, params = {}) {
  const query = new URLSearchParams({ section })
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  return '/admin?' + query
}
