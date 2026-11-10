'use server'

import { redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { isAdmin } from '../../lib/auth'
import { database } from '../../lib/db'
import { codePattern } from '../../lib/camp'
import { adminUrl } from './navigation'
import { readMapShape, shapeCenter } from '../../lib/plot-map'
import { uploadMime } from '../../lib/payment-rules'

export async function savePlotMapImage(form) {
  if (!(await isAdmin())) redirect('/admin')
  const file = form.get('mapImage')
  if (!(file instanceof File) || !file.size || file.size > 750 * 1024) {
    redirect(adminUrl('plotMap',{error:'photo'}))
  }
  const content = Buffer.from(await file.arrayBuffer())
  const mime = uploadMime(content)
  if (!mime) redirect(adminUrl('plotMap',{error:'photo'}))
  await database().execute(
    `INSERT INTO plot_map_background (id,revision,mime,content) VALUES (1,?,?,?)
     ON DUPLICATE KEY UPDATE revision=VALUES(revision),mime=VALUES(mime),content=VALUES(content)`,
    [randomUUID(),mime,content])
  redirect(adminUrl('plotMap',{saved:'mapImage'}))
}

export async function savePlotPosition(form) {
  if (!(await isAdmin())) redirect('/admin')
  const code = form.get('code')
  const x = form.get('x')
  const y = form.get('y')
  const rawShape = form.get('shape')
  const valid = value => typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 4 && Number(value) <= 96
  const destination = {code:typeof code === 'string' ? code : ''}
  if (typeof code !== 'string' || !codePattern.test(code)) redirect(adminUrl('plotMap',{error:'invalid'}))
  const [[row]] = await database().execute("SELECT code FROM inventory WHERE code=? AND kind IN ('plot','room')",[code])
  if (!row) redirect(adminUrl('plotMap',{error:'invalid'}))
  if (form.get('operation') === 'reset') {
    await database().execute('DELETE FROM plot_map_positions WHERE code=?',[code])
  } else {
    const shape = rawShape ? readMapShape(rawShape) : null
    if (rawShape ? !shape : !valid(x) || !valid(y)) redirect(adminUrl('plotMap',{...destination,error:'invalid'}))
    const [centerX,centerY] = shape ? shapeCenter(shape) : [Number(x),Number(y)]
    await database().execute(
      'INSERT INTO plot_map_positions (code,x,y,shape_json) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE x=VALUES(x),y=VALUES(y),shape_json=VALUES(shape_json)',
      [code,centerX,centerY,shape ? JSON.stringify(shape) : null])
  }
  redirect(adminUrl('plotMap',{...destination,saved:'map'}))
}
