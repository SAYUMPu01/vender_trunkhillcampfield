import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { Agent, request } from 'node:http'
import { performance } from 'node:perf_hooks'
import { createConnection } from 'mysql2/promise'

const target = new URL(process.argv[2] || 'http://127.0.0.1:3000')
const dbUrl = new URL(process.env.DATABASE_URL)
assert.equal(target.hostname, '127.0.0.1', 'Run this script against a local app')
assert.equal(dbUrl.hostname, '127.0.0.1', 'Run this script against a local database')
assert.equal(dbUrl.port, '33316', 'Use the isolated MariaDB container')
assert.equal(dbUrl.pathname, '/trunkhill')

const connection = await createConnection(process.env.DATABASE_URL)
const agent = new Agent({ keepAlive: true, maxSockets: 1000 })
const suffix = randomBytes(5).toString('hex').toUpperCase()
const plot = 'TEST-P-' + suffix
const gear = 'TEST-G-' + suffix
const start = new Date(Date.now() + 2 * 86400000)
const arrival = start.toISOString().slice(0,10)
const departure = new Date(start.getTime() + 2 * 86400000).toISOString().slice(0,10)
const keys = new Set()

function call(path, data) {
  const body = data && JSON.stringify(data)
  return new Promise((resolve, reject) => {
    const req = request(new URL(path, target), {
      agent, method: body ? 'POST' : 'GET',
      headers: body ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} : {},
    }, res => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { text += chunk })
      res.on('end', () => {
        try { resolve({ status:res.statusCode, body:path.startsWith('/api/') ? JSON.parse(text) : text }) }
        catch (error) { reject(error) }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(30000, () => req.destroy(new Error('HTTP timeout')))
    req.end(body)
  })
}

function booking(code, total, quantity = 1) {
  const requestKey = randomUUID()
  keys.add(requestKey)
  return {
    arrival, departure, guest:'Local load test', phone:'0800000000',
    adults:1, children:0, seniors:0, items:[{ code, quantity }], expectedTotal:total, requestKey,
    paymentToken:randomBytes(32).toString('hex'),
  }
}

async function adminForm(html, field, values, cookie = '') {
  const forms = html.match(/<form\b[\s\S]*?<\/form>/g) || []
  const form = forms.find(markup => markup.includes(field))
  const action = form?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1]
  assert.ok(action, 'Server action form was found')
  const body = new FormData()
  body.set(action, '')
  for (const [key, value] of Object.entries(values)) body.set(key, value)
  return fetch(new URL('/admin', target), {
    method: 'POST',
    redirect: 'manual',
    headers: { Origin: target.origin, Cookie: cookie },
    body,
  })
}

async function burst(count, work) {
  const elapsed = []
  const result = await Promise.all(Array.from({length:count}, async (_,i) => {
    const start = performance.now()
    const response = await work(i)
    elapsed.push(performance.now() - start)
    return response
  }))
  elapsed.sort((a,b) => a-b)
  return {
    result,
    p95Ms: Math.round(elapsed[Math.ceil(elapsed.length*.95)-1]),
    statuses: Object.fromEntries([...new Set(result.map(x => x.status))].sort()
      .map(status => [status,result.filter(x => x.status === status).length])),
  }
}

try {
  assert.equal((await call('/')).status, 200)
  const loginPage = await call('/admin')
  assert.equal(loginPage.status,200)
  assert.match(loginPage.body,/เข้าสู่ระบบผู้ดูแล/)

  await connection.query('INSERT INTO inventory VALUES ?', [[
    [plot,'plot','A','Load test plot','Synthetic',500,1,1],
    [gear,'gear','GEAR','Load test equipment','Synthetic',600,3,1],
  ]])
  const catalogPath = '/api/camp?' + new URLSearchParams({arrival, departure})
  const catalog = await call(catalogPath)
  assert.equal(catalog.status,200,JSON.stringify(catalog.body))
  const { mode, person_price: personPrice } = catalog.body.settings
  const reads = await burst(1000, () => call(catalogPath))
  console.log('1000 concurrent availability requests', reads.statuses, 'p95 ms', reads.p95Ms)
  assert.deepEqual(reads.statuses, {200:1000})

  const payloads = Array.from({length:200}, () => booking(plot, 2 * (mode === 'person' ? personPrice : 500)))
  const plots = await burst(200, i => call('/api/camp',payloads[i]))
  console.log('200 concurrent requests for one plot', plots.statuses, 'p95 ms', plots.p95Ms)
  assert.deepEqual(plots.statuses, {200:1,409:199})

  const winner = plots.result.findIndex(response => response.status === 200)
  const replay = await call('/api/camp', payloads[winner])
  assert.equal(replay.body.id, plots.result[winner].body.id)
  const lookup = await call('/api/camp',{action:'lookup',id:replay.body.id,phone:payloads[winner].phone})
  assert.equal(lookup.status,200)
  assert.equal(lookup.body.lines[0].quantity,1)

  const equipment = await burst(200, () => call('/api/camp',booking(gear,1200)))
  console.log('200 concurrent requests for three units', equipment.statuses, 'p95 ms', equipment.p95Ms)
  assert.deepEqual(equipment.statuses, {200:3,409:197})
  const after = await call(catalogPath)
  assert.equal(Number(after.body.inventory.find(row => row.code === plot).available),0)
  assert.equal(Number(after.body.inventory.find(row => row.code === gear).available),0)
  console.log('Idempotency, booking lookup and remaining stock verified.')

  const login = await adminForm(loginPage.body, 'name="password"', { password: process.env.ADMIN_PASSWORD })
  assert.equal(login.status,303)
  const cookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie?.startsWith('trunkhill_admin='))
  const admin = await fetch(new URL('/admin', target), { headers: { Cookie: cookie } })
  assert.equal(admin.status,200)
  const adminHtml = await admin.text()
  assert.match(adminHtml,/จัดการแคมป์/)
  const cancel = await adminForm(adminHtml, replay.body.id, { id: replay.body.id, status:'cancelled' }, cookie)
  assert.equal(cancel.status,303)
  const restored = await call(catalogPath)
  assert.equal(Number(restored.body.inventory.find(row => row.code === plot).available),1)
  console.log('Admin login, cancellation and stock release verified.')
} finally {
  agent.destroy()
  const requests = [...keys]
  try {
    await connection.beginTransaction()
    if (requests.length) {
      await connection.query('DELETE a FROM allocations a JOIN bookings b ON b.id=a.booking WHERE b.request_key IN (?)',[requests])
      await connection.query('DELETE l FROM booking_lines l JOIN bookings b ON b.id=l.booking WHERE b.request_key IN (?)',[requests])
      await connection.query('DELETE FROM bookings WHERE request_key IN (?)',[requests])
    }
    await connection.execute('DELETE FROM inventory WHERE code IN (?,?)',[plot,gear])
    await connection.commit()
  } finally {
    await connection.end()
  }
}
