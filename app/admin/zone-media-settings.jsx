import Link from 'next/link'
import { database } from '../../lib/db'
import { zones } from '../../lib/pricing'
import { adminUrl } from './navigation'
import { removeZoneMedia, saveZoneText } from './zone-media-actions'
import { ZonePhotoUpload } from './zone-photo-upload'
import { getZoneDetails } from '../../lib/zone-details'

export async function ZoneMediaSettings({query}) {
  const zone = zones.includes(query.zone) ? query.zone : 'A'
  const details = await getZoneDetails(zone)
  const [media] = await database().execute('SELECT id,kind FROM zone_media WHERE zone=? ORDER BY id',[zone])
  const video = media.find(item => item.kind === 'video')
  const photos = media.filter(item => item.kind === 'image')
  return <section className="panel stack admin-content">
    <nav className="admin-filter-tabs" aria-label="เลือกโซนสำหรับจัดการสื่อ">
      {zones.map(code => <Link key={code} href={adminUrl('zoneMedia',{zone:code})}
        aria-current={code === zone ? 'page' : undefined}>{code === 'BOX' ? 'Trunkbox' : 'Zone ' + code}</Link>)}
    </nav>
    <form action={saveZoneText} className="admin-edit-form" key={zone}>
      <input type="hidden" name="zone" value={zone}/>
      <label>รายละเอียดโซน<textarea name="description" rows="4" maxLength={2000} defaultValue={details?.description}/></label>
      <label>กฎการเข้าพัก<textarea name="rules" rows="4" maxLength={2000} defaultValue={details?.rules}/></label>
      <label className="zone-caption-field">คำบรรยายภาพบรรยากาศ
        <textarea name="galleryCaption" rows="5" maxLength={3000} defaultValue={details?.gallery_caption}/>
        <small>ใช้ข้อความเดียวสำหรับทั้งโซน วางลิงก์ Facebook หรือ TikTok ในข้อความได้</small>
      </label>
      <div className="admin-edit-footer"><button className="button">บันทึกรายละเอียด</button></div>
    </form>
    <div className="zone-admin-uploads">
        <form key={'video' + zone} action={'/admin/zone-media?zone=' + zone} method="post" encType="multipart/form-data" className="panel stack">
          <h2>วิดีโอ</h2>
          <input type="hidden" name="kind" value="video"/>
          <label>เลือกไฟล์<input name="media" type="file" accept="video/mp4,video/webm" required/>
            <small>MP4 หรือ WebM ไม่เกิน 12 MB</small></label>
          <button className="button">{video ? 'เปลี่ยนวิดีโอ' : 'เพิ่มวิดีโอ'}</button>
        </form>
        <ZonePhotoUpload key={zone} zone={zone} remaining={Math.max(0,8 - photos.length)}/>
    </div>
    <div className="zone-admin-media">
      {media.map(item => <article key={item.id} className="panel stack">
        {item.kind === 'video' ? <video controls preload="none" src={'/api/zone-media/' + item.id}/> :
          <img src={'/api/zone-media/' + item.id} alt="รูปบรรยากาศ"/>}
        <form action={removeZoneMedia}>
          <input type="hidden" name="zone" value={zone}/><input type="hidden" name="id" value={item.id}/>
          <button className="button secondary">นำ{item.kind === 'video' ? 'วิดีโอ' : 'รูป'}ออก</button>
        </form>
      </article>)}
    </div>
  </section>
}
