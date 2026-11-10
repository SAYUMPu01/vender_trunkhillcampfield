import { database } from '../../../../lib/db'

export async function GET(request, {params}) {
  const {id} = await params
  if (!/^\d{1,10}$/.test(id)) return new Response(null,{status:404})
  const db = database()
  const [[meta]] = await db.execute('SELECT mime, OCTET_LENGTH(content) AS size FROM zone_media WHERE id=?',[id])
  if (!meta) return new Response(null,{status:404})

  const headers = {'Content-Type':meta.mime,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=300',
    'X-Content-Type-Options':'nosniff'}
  const range = request.headers.get('range')
  if (!range) {
    const [[row]] = await db.execute('SELECT content FROM zone_media WHERE id=?',[id])
    if (!row) return new Response(null,{status:404})
    return new Response(row.content,{headers:{...headers,'Content-Length':String(meta.size)}})
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  const size = Number(meta.size)
  const start = match?.[1] ? Number(match[1]) : Math.max(0,size - Number(match?.[2]))
  const end = match?.[1] && match[2] ? Math.min(size-1,Number(match[2])) : size-1
  if (!match || (!match[1] && !match[2]) || start > end || start >= size) {
    return new Response(null,{status:416,headers:{'Content-Range':'bytes */' + size}})
  }
  const length = end-start+1
  const [[row]] = await db.execute('SELECT SUBSTRING(content,?,?) AS chunk FROM zone_media WHERE id=?',[start+1,length,id])
  if (!row) return new Response(null,{status:404})
  return new Response(row.chunk,{status:206,headers:{...headers,'Content-Length':String(length),
    'Content-Range':'bytes ' + start + '-' + end + '/' + size}})
}
