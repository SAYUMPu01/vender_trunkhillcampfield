import { isAdmin } from '../../../lib/auth'
import { extraCharge } from '../../../lib/checkout-pricing'
import { checkoutCursor, checkoutFilters, checkoutPageSize, checkoutRows, checkoutStatuses, checkoutSummaries } from '../checkout-data'

function csvRow(values) {
  return values.map(value => {
    let text = String(value)
    if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(text)) text = "'" + text
    return '"' + text.replaceAll('"','""') + '"'
  }).join(',') + '\r\n'
}

async function* csvRows(filters) {
  const encoder = new TextEncoder()
  yield encoder.encode('\uFEFF' + csvRow(['รหัสจอง','เช็กอิน','เช็กเอาต์','ล็อก / ห้อง','อุปกรณ์','ชื่อผู้จอง','เบอร์โทร','สถานะ','ยอดจองเดิม','ค่าไฟ','ค่าของชำรุด','ค่าใช้จ่ายอื่น ๆ','ยอดชำระเพิ่ม','ยอดรวม']))
  let after = ''
  while (true) {
    const rows = await checkoutRows(filters,{after})
    const page = rows.slice(0,checkoutPageSize)
    const summaries = await checkoutSummaries(page)
    yield encoder.encode(page.map(row => {
      const {lodging,rentals} = summaries.get(row.id)
      const extra = extraCharge(row) / 100
      return csvRow([row.id,row.arrival,row.departure,lodging.join(', '),rentals.join(', '),row.guest,"'" + row.phone,
        row.completed_at ? checkoutStatuses.done : checkoutStatuses.open,row.total,
        Number(row.electricity_amount) / 100,row.damage_amount / 100,row.other_amount / 100,extra,row.total + extra])
    }).join(''))
    if (rows.length <= checkoutPageSize) return
    after = checkoutCursor(page.at(-1))
  }
}

export async function GET(request) {
  if (!(await isAdmin())) return new Response(null,{status:403})
  const filters = checkoutFilters(Object.fromEntries(request.nextUrl.searchParams))
  return new Response(ReadableStream.from(csvRows(filters)),{headers:{
    'Content-Type':'text/csv; charset=utf-8',
    'Content-Disposition':'attachment; filename="trunkhill-checkouts.csv"',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
  }})
}
