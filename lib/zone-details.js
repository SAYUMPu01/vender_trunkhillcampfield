import { database } from './db'

export async function getZoneDetails(zone) {
  const [[details]] = await database().execute(
    `SELECT description,rules,COALESCE(gallery_caption,
      (SELECT GROUP_CONCAT(DISTINCT NULLIF(caption,'') ORDER BY caption SEPARATOR '\n')
       FROM zone_media WHERE zone=z.zone),'') AS gallery_caption
      FROM zone_details z WHERE zone=?`,[zone])
  return details
}
