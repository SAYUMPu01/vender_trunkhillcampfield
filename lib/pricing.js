export const zones = ['A', 'B', 'C', 'D', 'BOX']
export const statuses = { pending: 'รอตรวจสอบ', confirmed: 'ยืนยันแล้ว', cancelled: 'ยกเลิกแล้ว' }
export const money = value => new Intl.NumberFormat('th-TH').format(value) + ' บาท'

export function stayTotal(rows, settings, adults, nights) {
  const plots = rows.filter(row => row.kind === 'plot')
  const chargedGuests = plots.length > 1
    ? Math.max(adults, plots.length * settings.minimum_per_plot)
    : adults
  const plotCost = settings.mode === 'person' && plots.length
    ? chargedGuests * settings.person_price
    : plots.reduce((sum, row) => sum + row.price, 0)
  return (plotCost + rows.filter(row => row.kind !== 'plot')
    .reduce((sum, row) => sum + row.price * row.quantity, 0)) * nights
}
