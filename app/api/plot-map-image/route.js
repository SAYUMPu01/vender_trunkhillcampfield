import { database } from '../../../lib/db'

export async function GET(request) {
  const revision = request.nextUrl.searchParams.get('v')
  if (!revision || !/^[a-f0-9-]{36}$/.test(revision)) return new Response(null,{status:404})
  const [[row]] = await database().execute('SELECT mime,content FROM plot_map_background WHERE id=1 AND revision=?',[revision])
  if (!row) return new Response(null,{status:404})
  return new Response(row.content,{headers:{
    'Content-Type':row.mime,
    'Cache-Control':'public, max-age=86400, immutable',
    'X-Content-Type-Options':'nosniff',
  }})
}
