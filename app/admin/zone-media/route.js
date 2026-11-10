import { isAdmin } from '../../../lib/auth'
import { transaction } from '../../../lib/db'
import { zones } from '../../../lib/pricing'
import { uploadMime } from '../../../lib/payment-rules'

const imageLimit = 750 * 1024
const videoLimit = 12 * 1024 * 1024

function result(zone, outcome) {
  const params = new URLSearchParams({section:'zoneMedia',zone,...outcome})
  return new Response(null,{status:303,headers:{Location:'/admin?' + params}})
}

export async function POST(request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!host || (origin !== 'https://' + host && origin !== 'http://' + host) || !(await isAdmin())) {
    return new Response(null,{status:403})
  }
  const selected = request.nextUrl.searchParams.get('zone')
  const zone = zones.includes(selected) ? selected : 'A'
  if (Number(request.headers.get('content-length')) > videoLimit + 65536) {
    return result(zone,{error:'zoneMedia'})
  }
  const data = await request.formData()
  const files = data.getAll('media')
  const kind = data.get('kind')
  if (!['image','video'].includes(kind) || !files.length ||
      files.some(file => !(file instanceof File) || !file.size || file.size > (kind === 'image' ? imageLimit : videoLimit))) {
    return result(zone,{error:'zoneMedia'})
  }
  if (kind === 'image' && files.length > 8) return result(zone,{error:'zoneLimit'})
  if (kind === 'video' && files.length !== 1) return result(zone,{error:'zoneMedia'})
  const media = []
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer())
    const mime = kind === 'image' ? uploadMime(bytes) :
      bytes.toString('ascii',4,8) === 'ftyp' ? 'video/mp4' :
        bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])) && bytes.subarray(0,128).includes('webm') ? 'video/webm' : null
    if (!mime) return result(zone,{error:'zoneMedia'})
    media.push([zone,kind,mime,'',bytes])
  }
  const saved = await transaction(async connection => {
    await connection.execute('SELECT zone FROM zone_details WHERE zone=? FOR UPDATE',[zone])
    if (kind === 'video') {
      await connection.execute("DELETE FROM zone_media WHERE zone=? AND kind='video'",[zone])
    } else {
      const [[{count}]] = await connection.execute("SELECT COUNT(*) AS count FROM zone_media WHERE zone=? AND kind='image'",[zone])
      if (Number(count) + media.length > 8) return false
    }
    for (const item of media) {
      await connection.execute('INSERT INTO zone_media (zone,kind,mime,caption,content) VALUES (?,?,?,?,?)',item)
    }
    return true
  })
  return result(zone,saved ? {saved:'zoneMedia'} : {error:'zoneLimit'})
}
