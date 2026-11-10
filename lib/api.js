import { CampError } from './camp'

export async function api(work) {
  try {
    return Response.json(await work(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CampError) return Response.json({ error: error.message }, { status: error.status })
    if (error instanceof SyntaxError) return Response.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
    console.error('Camp request failed', error.code || error.name)
    return Response.json({ error: 'ระบบขัดข้อง กรุณาลองใหม่' }, { status: 503 })
  }
}


