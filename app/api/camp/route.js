import { CampError, catalog, lookup, phoneNumber, reserve } from '../../../lib/camp'
import { rescheduleBooking } from '../../../lib/reschedule'

export const runtime = 'nodejs'

import { api } from '../../../lib/api'

export function GET(request) {
  const q = request.nextUrl.searchParams
  return api(() => catalog(q.get('arrival'), q.get('departure')))
}

export function POST(request) {
  return api(async () => {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CampError('ข้อมูลไม่ถูกต้อง')
    if (body.action === 'lookup') return lookup(body.id,phoneNumber(body.phone))
    if (body.action === 'reschedule') return rescheduleBooking(body)
    return reserve(body)
  })
}

