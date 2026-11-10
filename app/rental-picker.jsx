'use client'

import { useState } from 'react'
import { money } from '../lib/pricing'
import { isRentalStay, tentCodes } from '../lib/rentals'
import { PagedItems } from './paged-items'
import { useMobileScreen } from './use-mobile-screen'

const photos = {
  'SNOW-PEAK': [176, 132],
  'LANDNEST-DOME': [176, 196],
  'VAULT-TARP': [176, 255],
  'LANDNEST-SHELTER': [176, 314],
  LANDLOCK: [176, 375],
  'SNOW-PEAK-TARP': [176, 435],
  TRUNKBOX: [176, 496],
  BEDDING: [614, 127],
  'SLEEPING-BAG': [614, 170],
  'CAMP-TABLE': [614, 221],
  'CAMP-CHAIR': [614, 272],
  EXTENSION: [614, 329],
  'LED-LIGHT': [614, 384],
  FAN: [614, 438],
  'AIR-CONDITIONER': [614, 492],
}

function RentalPhoto({ row }) {
  if (row.has_photo) return <img className="rental-photo rental-uploaded-photo" src={'/admin/inventory-photo/' + row.code}
    alt="" width="66" height="40" loading="lazy"/>
  const photo = photos[row.code]
  if (!photo) return <span className="rental-photo rental-symbol" aria-hidden="true">{row.kind === 'room' ? '⌂' : '◇'}</span>
  const [x, y] = photo
  return <span className="rental-photo rental-photo-sprite" aria-hidden="true"
    style={{ backgroundPosition: `-${x * .68}px -${y * .68}px` }} />
}

export function RentalPicker({ dialog, rows, draft, setDraft, onConfirm, hostName }) {
  const mobile = useMobileScreen()
  const [view,setView] = useState('stay')
  const tents = tentCodes.map(code => rows.find(row => row.code === code)).filter(Boolean)
  const stays = [...tents, ...rows.filter(row => row.kind === 'room')]
  const equipment = rows.filter(row => !isRentalStay(row))
  const selectedStay = stays.find(row => draft[row.code] > 0)?.code || ''

  function chooseStay(code) {
    setDraft(previous => ({
      ...previous,
      ...Object.fromEntries(stays.map(row => [row.code, Number(row.code === code)])),
    }))
  }

  function adjust(code, step, max) {
    setDraft(previous => ({ ...previous, [code]: Math.max(0, Math.min(max, (previous[code] || 0) + step)) }))
  }

  function selectView(next) {
    setView(next)
    dialog.current.scrollTop = 0
  }

  return <dialog ref={dialog} className="dialog rental-dialog" aria-labelledby="rental-title">
    <form method="dialog" className="dialog-close">
      <button className="button secondary" aria-label="ปิดโดยไม่บันทึก">×</button>
    </form>
    <h2 id="rental-title">เช่าอุปกรณ์เพิ่ม</h2>
    {hostName && <p className="small muted">สำหรับ {hostName}</p>}
    <div className="customer-switch" aria-label="ประเภทอุปกรณ์">
      <button type="button" aria-pressed={view === 'stay'} onClick={() => selectView('stay')}>เต็นท์ / บ้านพัก</button>
      <button type="button" aria-pressed={view === 'gear'} onClick={() => selectView('gear')}>อุปกรณ์</button>
    </div>
    <div className="rental-columns">
      <section className="stack" hidden={view !== 'stay'}>
        <p className="small muted">เลือกเต็นท์หรือบ้านพักได้ 1 รายการ</p>
        {stays.length === 0 && <p className="muted">ยังไม่มีรายการให้เลือก</p>}
        {stays.length > 0 && <fieldset className="rental-options" aria-label="เลือกเต็นท์หรือบ้านพัก">
        <label className="rental-stay rental-none">
          <input type="radio" name="rental-stay" checked={!selectedStay} onChange={() => chooseStay('')}/>
          <span>ไม่เช่าเต็นท์หรือบ้านพัก</span>
        </label>
        <PagedItems items={stays} size={3} label="เต็นท์และบ้านพัก" paginate={!mobile}>{page => page.map(row => <label className="rental-stay" key={row.code}>
          <input type="radio" name="rental-stay" checked={selectedStay === row.code}
            disabled={Number(row.available) === 0} onChange={() => chooseStay(row.code)}/>
          <span className="rental-product">
            <RentalPhoto row={row}/>
            <span>{row.code === 'SNOW-PEAK' ? 'Snow Peak Amenity Dome M' : row.name}
              {Number(row.available) === 0 && <small>ไม่ว่าง</small>}
            </span>
            <strong>{money(row.price)} / คืน</strong>
          </span>
        </label>)}</PagedItems>
        </fieldset>}
      </section>
      <section className="stack" hidden={view !== 'gear'}>
        <div className="rental-heading"><h2>เช่าอุปกรณ์</h2><span className="small">ราคาต่อชิ้นต่อคืน</span></div>
        {equipment.length === 0 && <p className="muted">ยังไม่มีรายการให้เลือก</p>}
        <PagedItems items={equipment} size={3} label="อุปกรณ์ให้เช่า" paginate={!mobile}>{page => page.map(row => {
          const quantity = draft[row.code] || 0
          const max = Math.min(100, Number(row.available))
          return <div key={row.code} className="rental-equipment">
            <div className="rental-product"><RentalPhoto row={row}/><span>{row.name}{max === 0 && <small>ไม่ว่าง</small>}</span><strong>{money(row.price)}</strong></div>
            <div className="guest-counter">
              <button type="button" aria-label={'ลด ' + row.name} disabled={quantity === 0}
                onClick={() => adjust(row.code, -1, max)}>−</button>
              <output aria-label={'จำนวน ' + row.name}>{quantity}</output>
              <button type="button" aria-label={'เพิ่ม ' + row.name} disabled={quantity >= max}
                onClick={() => adjust(row.code, 1, max)}>+</button>
            </div>
          </div>
        })}</PagedItems>
      </section>
    </div>
    <button type="button" className="button rental-confirm" onClick={() => {
      onConfirm({
        ...draft,
        ...Object.fromEntries(stays.map(row => [row.code, Number(row.code === selectedStay)])),
      })
      dialog.current.close()
    }}>ยืนยันการเลือก</button>
  </dialog>
}

