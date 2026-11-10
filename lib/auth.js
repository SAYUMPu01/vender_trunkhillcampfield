import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const cookieName = 'trunkhill_admin'
const hours = 8 * 60 * 60
const digest = value => createHash('sha256').update(value).digest()
const sign = value => createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(value).digest('hex')

export async function isAdmin() {
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) return false
  const token = (await cookies()).get(cookieName)?.value
  if (!token || !/^\d+\.[a-f0-9]{64}$/.test(token)) return false
  const [expiry, signature] = token.split('.')
  return Number(expiry) > Date.now() && timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(expiry), 'hex'))
}

export async function authenticate(password) {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 ||
      !process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32 ||
      typeof password !== 'string' || password.length > 256 ||
      !timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD))) return false
  const expiry = String(Date.now() + hours * 1000)
  ;(await cookies()).set(cookieName, expiry + '.' + sign(expiry), {
    httpOnly: true, sameSite: 'lax', secure: process.env.ADMIN_SECURE_COOKIE !== 'false',
    path: '/admin', maxAge: hours,
  })
  return true
}

export async function clearSession() {
  ;(await cookies()).set(cookieName, '', { path: '/admin', maxAge: 0 })
}
