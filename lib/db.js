import { createPool } from 'mysql2/promise'

let pool

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  pool ??= createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 10,
    queueLimit: 1000,
    connectTimeout: 5000,
    dateStrings: true,
  })
  return pool
}

export async function transaction(work) {
  const connection = await database().getConnection()
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
