import { database } from '../../../lib/db'
import { getZoneDetails } from '../../../lib/zone-details'
import { zones } from '../../../lib/pricing'
import { api } from '../../../lib/api'
import { CampError } from '../../../lib/camp'

export function GET(request) {
  return api(async () => {
    const zone = request.nextUrl.searchParams.get('zone')
    if (!zones.includes(zone)) throw new CampError('ไม่พบโซน',404)
    const details = await getZoneDetails(zone)
    const [media] = await database().execute('SELECT id,kind FROM zone_media WHERE zone=? ORDER BY id',[zone])
    return { ...details, media }
  })
}
