'use client'

import { customerPlotShape, mapPosition, shapeCenter, shapePoints } from '../lib/plot-map'

export function MapBackground({version}) {
  if (version) return <img className="plot-map-custom-background" src={'/api/plot-map-image?v=' + version} alt="" draggable={false}/>
  return <img className="plot-map-background" src="/camp-map.webp" alt="" width="565" height="800" draggable={false}/>
}

export function PlotOutline({shape,status,interactive,onSelect,label,selected}) {
  const points = shapePoints(shape).map(point => point.join(',')).join(' ')
  return <svg className={'plot-map-outline ' + status}
    viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden={interactive ? undefined : true}>
    <polygon points={points} vectorEffect="non-scaling-stroke" role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined} aria-label={interactive ? label : undefined}
      aria-pressed={interactive ? selected : undefined} onClick={onSelect}
      onKeyDown={interactive ? event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      } : undefined}/>
  </svg>
}

export function PlotMap({rows, zone, counts, ready, busy, onSelect, mapVersion, readOnly = false}) {
  return <div className="plot-map-scroll" tabIndex={0} aria-label="ผังลานกางเต็นท์">
    <div className="plot-map-canvas">
      <MapBackground version={mapVersion}/>
      {rows.filter(row => row.kind !== 'gear').map(row => {
        const shape = customerPlotShape(row,mapVersion)
        const position = row.map_x == null && shape ? shapeCenter(shape) : mapPosition(row)
        if (!position) return null
        const [x,y] = position
        const selected = !!counts[row.code]
        const status = !ready ? 'unchecked' : selected ? 'selected' : Number(row.available) > 0 ? 'available' : 'booked'
        const label = {unchecked:'กรุณาตรวจสอบลานว่าง', selected:'เลือกอยู่', available:'ว่าง', booked:'จองแล้ว'}[status]
        const dimmed = !!zone && zone !== row.zone && !selected
        const canSelect = !readOnly && ready && !busy && status !== 'booked'
        if (shape) return <div key={row.code}>
          <PlotOutline shape={shape} status={status} interactive={canSelect} selected={selected}
            label={row.code + ' · ' + label} onSelect={canSelect ? () => onSelect(row,selected ? 0 : 1) : undefined}/>
          <span className={'plot-map-pin plot-shape-label ' + status} data-dimmed={dimmed}
            style={{left:x + '%',top:y + '%'}} aria-label={row.code + ' · ' + label}>{row.code}</span>
        </div>
        if (readOnly) return <span key={row.code} className={'plot-map-pin ' + status}
          style={{left:x + '%',top:y + '%'}}>{row.code}</span>
        return <button key={row.code} type="button" className={'plot-map-pin ' + status}
          data-dimmed={!!zone && zone !== row.zone && !selected}
          style={{left:x + '%',top:y + '%'}} aria-pressed={selected}
          aria-label={row.code + ' · ' + label} title={row.name + ' · ' + label}
          disabled={!ready || busy || status === 'booked'}
          onClick={() => onSelect(row,selected ? 0 : 1)}>{row.code}</button>
      })}
    </div>
  </div>
}
