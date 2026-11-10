'use server'

import { redirect } from 'next/navigation'
import { isAdmin } from '../../lib/auth'
import { database } from '../../lib/db'
import { zones } from '../../lib/pricing'
import { adminUrl } from './navigation'

export async function saveZoneText(form) {
  if (!(await isAdmin())) redirect('/admin')
  const zone = form.get('zone')
  const description = form.get('description')
  const rules = form.get('rules')
  const caption = form.get('galleryCaption')
  if (!zones.includes(zone) || typeof description !== 'string' || description.length > 2000 ||
    typeof rules !== 'string' || rules.length > 2000 ||
    typeof caption !== 'string' || caption.length > 3000) redirect(adminUrl('zoneMedia',{error:'invalid'}))
  await database().execute('UPDATE zone_details SET description=?,rules=?,gallery_caption=? WHERE zone=?',
    [description.trim(),rules.trim(),caption.trim(),zone])
  redirect(adminUrl('zoneMedia',{zone,saved:'zoneMedia'}))
}

export async function removeZoneMedia(form) {
  if (!(await isAdmin())) redirect('/admin')
  const zone = form.get('zone')
  const id = form.get('id')
  if (!zones.includes(zone) || typeof id !== 'string' || !/^\d{1,10}$/.test(id)) redirect(adminUrl('zoneMedia',{error:'invalid'}))
  await database().execute('DELETE FROM zone_media WHERE zone=? AND id=?',[zone,id])
  redirect(adminUrl('zoneMedia',{zone,saved:'zoneMedia'}))
}
