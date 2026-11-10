export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
  return Response.json({
    ok: true,
    runtime: 'nodejs',
    node: process.version,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
