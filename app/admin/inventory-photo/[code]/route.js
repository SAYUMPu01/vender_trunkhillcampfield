import { database } from '../../../../lib/db'
import { isAdmin } from '../../../../lib/auth'
import { codePattern } from '../../../../lib/camp'

export async function GET(request, { params }) {
  const { code } = await params
  if (!codePattern.test(code)) return new Response(null, { status:404 })
  const [[row]] = await database().execute(
    'SELECT p.mime,p.photo,i.active FROM inventory_photos p JOIN inventory i ON i.code=p.code WHERE p.code=?',
    [code],
  )
  if (!row || (!row.active && !(await isAdmin()))) return new Response(null, { status:404 })
  return new Response(row.photo, {
    headers: {
      'Content-Type':row.mime,
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
    },
  })
}
