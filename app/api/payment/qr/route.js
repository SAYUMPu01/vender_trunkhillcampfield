import { database } from '../../../../lib/db'

export async function GET() {
  const [[row]] = await database().query('SELECT mime,qr FROM payment_config WHERE id=1')
  if (!row) return new Response(null,{status:404})
  return new Response(row.qr,{headers:{'Content-Type':row.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
}
