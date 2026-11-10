import { database } from '../../lib/db'
import { PlotMapEditor } from './plot-map-editor'
import { savePlotMapImage } from './plot-map-actions'

export async function PlotMapSettings({query}) {
  const [rows] = await database().query(
    `SELECT i.code,i.name,i.zone,i.active,m.x AS map_x,m.y AS map_y,m.shape_json AS map_shape
     FROM inventory i LEFT JOIN plot_map_positions m ON m.code=i.code
     WHERE i.kind IN ('plot','room') ORDER BY i.zone,i.code`)
  const [[background]] = await database().query('SELECT revision FROM plot_map_background WHERE id=1')
  const selected = rows.find(row => row.code === query.code) || rows[0]
  return <section className="panel stack">
    <h2>ตำแหน่งลานและห้องพัก</h2>
    <form action={savePlotMapImage} className="admin-filters">
      <label>รูปผังลาน<input type="file" name="mapImage" accept="image/jpeg,image/png,image/webp" required/>
        <small>JPG, PNG หรือ WebP ไม่เกิน 750 KB · ใช้รูปที่ตัดให้เหลือเฉพาะผังลาน</small></label>
      <button className="button">{background ? 'เปลี่ยนรูปผังลาน' : 'อัปโหลดรูปผังลาน'}</button>
    </form>
    <p className="small muted">หลังเปลี่ยนรูป ตรวจตำแหน่งและขอบเขตล็อกบนผังอีกครั้ง</p>
    {selected ? <PlotMapEditor key={JSON.stringify([selected.code,selected.map_x,selected.map_y,selected.map_shape,background?.revision])}
      rows={rows} code={selected.code} mapVersion={background?.revision}/> :
      <p className="empty">เพิ่มลานหรือห้องพักก่อนวางตำแหน่งบนผัง</p>}
  </section>
}
