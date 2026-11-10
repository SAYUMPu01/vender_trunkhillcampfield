import { readFile } from 'node:fs/promises'
import { createConnection } from 'mysql2/promise'

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local first')

const connection = await createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true })
const checkoutOnly = process.argv.includes('--checkout-only')
const rescheduleOnly = process.argv.includes('--reschedule-only')

async function initBase() {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
  await connection.query(schema)
  const [[galleryCaption]] = await connection.execute(
    "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='zone_details' AND column_name='gallery_caption'",
  )
  if (!galleryCaption) {
    await connection.query('ALTER TABLE zone_details ADD COLUMN gallery_caption TEXT NULL')
  }
  const [[mapShape]] = await connection.execute(
    "SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='plot_map_positions' AND column_name='shape_json'",
  )
  if (!mapShape) {
    await connection.query('ALTER TABLE plot_map_positions ADD COLUMN shape_json TEXT NULL')
  }
}

async function ensureColumns(columns) {
  for (const [table, column, definition] of columns) {
    const [[exists]] = await connection.execute(
      'SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',
      [table,column],
    )
    if (exists) continue
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error
    }
  }
}

async function initCheckout() {
  const checkoutSchema = await readFile(new URL('../db/checkout.sql', import.meta.url), 'utf8')
  await connection.query(checkoutSchema)
  await ensureColumns([
    ['checkout_settings','free_units_per_guest','INT UNSIGNED NOT NULL DEFAULT 1000'],
    ['booking_checkouts','free_units_per_guest','INT UNSIGNED NOT NULL DEFAULT 0'],
    ['booking_checkouts','lodging_charges','TEXT NULL'],
  ])
  const indexes = [['bookings', 'bookings_status_departure', 'status, departure, id']]
  if (!checkoutOnly) indexes.push(
    ['inventory', 'inventory_kind_code', 'kind, code'],
    ['inventory', 'inventory_kind_zone_code', 'kind, zone, code'],
    ['bookings', 'bookings_status_created', 'status, created_at, id'],
    ['bookings', 'bookings_phone', 'phone'],
    ['bookings', 'bookings_guest', 'guest'],
  )
  for (const [table, name, columns] of indexes) {
    const [[existing]] = await connection.execute(
      'SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1',
      [table, name],
    )
    if (existing) continue
    try {
      await connection.query(`CREATE INDEX ${name} ON ${table} (${columns})`)
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') throw error
    }
  }
}

try {
  if (!checkoutOnly && !rescheduleOnly) await initBase()
  if (!checkoutOnly) await ensureColumns([['bookings','reschedule_count','TINYINT UNSIGNED NOT NULL DEFAULT 0']])
  if (!rescheduleOnly) await initCheckout()
  console.log(rescheduleOnly ? 'Trunkhill reschedule schema is ready.' :
    checkoutOnly ? 'Trunkhill checkout schema is ready.' : 'Trunkhill schema and demo catalog are ready.')
} finally {
  await connection.end()
}
