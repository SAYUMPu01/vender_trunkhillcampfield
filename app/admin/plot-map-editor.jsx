'use client'

import { useRef, useState } from 'react'
import { MapBackground, PlotOutline } from '../plot-map'
import { mapPosition, readMapShape, shapeCenter } from '../../lib/plot-map'
import { savePlotPosition } from './plot-map-actions'

const modes = [['marker','จุดตำแหน่ง'],['rectangle','กรอบสี่เหลี่ยม'],['polygon','รูปหลายเหลี่ยม']]

export function PlotMapEditor({rows,code,mapVersion}) {
  const initial = rows.find(row => row.code === code)
  const initialShape = readMapShape(initial.map_shape)
  const [selected,setSelected] = useState(code)
  const [position,setPosition] = useState(mapPosition(initial) || [50,50])
  const [mode,setMode] = useState(initialShape?.type || 'marker')
  const [points,setPoints] = useState(initialShape?.points || [])
  const [vertex,setVertex] = useState(null)
  const drag = useRef(null)
  const shape = mode === 'marker' ? null : {type:mode,points}
  const valid = !shape || !!readMapShape(JSON.stringify(shape))
  const labelPoint = shape && points.length ? shapeCenter(shape) : position

  function choose(next) {
    const row = rows.find(row => row.code === next)
    const saved = readMapShape(row.map_shape)
    setSelected(next)
    setPosition(mapPosition(row) || [50,50])
    setMode(saved?.type || 'marker')
    setPoints(saved?.points || [])
    setVertex(null)
  }

  function pointAt(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const percent = (value,size) => Math.max(0,Math.min(100,Math.round(10000*value/size)/100))
    return [percent(event.clientX-rect.left,rect.width),percent(event.clientY-rect.top,rect.height)]
  }

  function place(event) {
    const point = pointAt(event)
    if (mode === 'marker') setPosition(point.map(value => Math.max(4,Math.min(96,value))))
    else if (vertex !== null) {
      setPoints(previous => previous.map((item,index) => index === vertex ? point : item))
      setVertex(null)
    } else if (mode === 'polygon' && points.length < 24) setPoints(previous => [...previous,point])
  }

  function beginRectangle(event) {
    if (mode !== 'rectangle' || vertex !== null || event.button !== 0) return
    const point = pointAt(event)
    drag.current = point
    event.currentTarget.setPointerCapture(event.pointerId)
    setPoints([point,point])
  }

  function drawRectangle(event) {
    if (drag.current) setPoints([drag.current,pointAt(event)])
  }

  function finishRectangle(event) {
    drawRectangle(event)
    drag.current = null
  }

  return <form action={savePlotPosition} className="stack">
    <input type="hidden" name="shape" value={shape ? JSON.stringify(shape) : ''}/>
    <div className="admin-filters">
      <label>รายการที่จะวางบนผัง<select name="code" value={selected} onChange={event => choose(event.target.value)}>
        {rows.map(row => <option value={row.code} key={row.code}>{row.code} · {row.name}{row.active ? '' : ' (ปิดจอง)'}</option>)}
      </select></label>
      {mode === 'marker' && ['แนวนอน (%)','แนวตั้ง (%)'].map((label,index) => <label key={label}>{label}
        <input name={index === 0 ? 'x' : 'y'} type="number" min="4" max="96" step=".01" required value={position[index]}
          onChange={event => setPosition(previous => previous.map((value,i) => i === index ? event.target.value : value))}/>
      </label>)}
      <button className="button" disabled={!valid}>บันทึกตำแหน่ง</button>
      <button className="button secondary" name="operation" value="reset" formNoValidate>คืนตำแหน่งเริ่มต้น</button>
    </div>
    <div className="actions" aria-label="รูปแบบขอบเขต">
      {modes.map(([value,label]) => <button key={value} type="button"
        className={'button' + (mode === value ? '' : ' secondary')} aria-pressed={mode === value}
        onClick={() => { if (mode !== value) { setMode(value); setPoints([]); setVertex(null) } }}>{label}</button>)}
      {mode !== 'marker' && points.length > 0 && <button type="button" className="button secondary" onClick={() => {setPoints([]);setVertex(null)}}>วาดใหม่</button>}
      {mode === 'polygon' && points.length > 0 && <button type="button" className="button secondary"
        onClick={() => {setPoints(previous => previous.slice(0,-1));setVertex(null)}}>ย้อนจุดล่าสุด</button>}
    </div>
    <p className="small muted" aria-live="polite">{vertex !== null ? 'คลิกตำแหน่งใหม่เพื่อย้ายจุดที่เลือก'
      : mode === 'rectangle' ? 'ลากจากมุมหนึ่งไปอีกมุม หรือกดจุดมุมเพื่อปรับขนาด'
      : mode === 'polygon' ? 'คลิกวางจุดตามขอบล็อกอย่างน้อย 3 จุด ระบบปิดกรอบให้เอง · ' + points.length + '/24 จุด'
      : 'คลิกตำแหน่งบนผัง หรือกรอกพิกัดด้านบน'}</p>
    <div className="plot-map-scroll">
      <div className="plot-map-canvas plot-map-editor">
        <MapBackground version={mapVersion}/>
        {rows.filter(row => row.code !== selected).map(row => {
          const point = mapPosition(row)
          const saved = readMapShape(row.map_shape)
          return point && <div key={row.code}>
            {saved && <PlotOutline shape={saved} status="unchecked"/>}
            <span className="plot-map-pin unchecked" style={{left:point[0] + '%',top:point[1] + '%'}}>{row.code}</span>
          </div>
        })}
        {shape && points.length >= 2 && <PlotOutline shape={shape} status="selected"/>}
        <span className="plot-map-pin selected" style={{left:labelPoint[0] + '%',top:labelPoint[1] + '%'}}>{selected}</span>
        <button className={'plot-map-placement' + (mode === 'rectangle' ? ' rectangle-mode' : '')} type="button"
          aria-label="วางตำแหน่งบนผัง" tabIndex={-1} onClick={place}
          onPointerDown={beginRectangle} onPointerMove={drawRectangle} onPointerUp={finishRectangle}
          onPointerCancel={() => {drag.current = null}}/>
        {mode !== 'marker' && points.map(([x,y],index) => <button key={index} type="button"
          className="plot-map-vertex" style={{left:x + '%',top:y + '%'}} aria-pressed={vertex === index}
          aria-label={'ย้ายจุดที่ ' + (index+1)} onClick={() => setVertex(vertex === index ? null : index)}/>)}
      </div>
    </div>
  </form>
}
