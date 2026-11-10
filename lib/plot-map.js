// Marker centers in percentages of the visible campsite illustration.
const defaults = {
  A01:[89,31], A02:[80,31], A03:[76,47], A04:[86,46], A05:[70,62],
  A06:[78,62], A07:[87,61], A08:[69,75], A09:[78,75], A10:[86,73],
  B01:[37,32], B02:[46,32], B03:[70,32], B04:[39,48],
  B05:[49,48], B06:[57,47], B07:[67,46],
  C01:[15,21], C02:[23,19], C03:[34,17], C04:[41,17], C05:[52,16],
  C06:[59,19], C07:[69,16], C08:[78,16], C09:[89,16],
  D01:[19,35], D02:[30,35], D03:[20,51], D04:[31,51], D05:[16,63],
  D06:[23,65], D07:[30,61], D08:[18,80], D09:[25,80], D10:[32,79],
}

// Corners in pixels of the built-in 565 × 800 campsite illustration.
const builtInBoundaries = {
  A01:[[476,457],[532,452],[527,503],[476,507]], A02:[[427,461],[476,457],[476,507],[428,511]],
  A03:[[409,512],[462,508],[463,556],[410,561]], A04:[[462,508],[527,503],[521,553],[463,556]],
  A05:[[369,565],[418,561],[420,606],[371,610]], A06:[[418,561],[463,556],[466,602],[420,606]],
  A07:[[463,556],[521,553],[517,598],[466,602]], A08:[[371,610],[420,606],[420,657],[372,661]],
  A09:[[420,606],[466,602],[466,653],[420,657]], A10:[[466,602],[517,598],[512,649],[466,653]],
  B01:[[179,474],[235,470],[236,521],[180,524]], B02:[[235,470],[299,467],[300,517],[236,521]],
  B03:[[374,464],[427,461],[428,511],[375,515]], B04:[[194,524],[247,520],[248,568],[195,571]],
  B05:[[247,520],[298,517],[299,565],[248,568]], B06:[[298,517],[354,514],[355,562],[299,565]],
  B07:[[354,514],[409,512],[410,561],[355,562]],
  C01:[[39,429],[110,425],[112,478],[34,482]], C02:[[110,425],[147,423],[150,476],[112,478]],
  C03:[[175,422],[210,420],[212,472],[178,474]], C04:[[210,420],[245,418],[248,470],[212,472]],
  C05:[[275,417],[310,415],[312,466],[277,468]], C06:[[310,415],[347,413],[349,464],[312,466]],
  C07:[[375,412],[413,410],[414,460],[376,463]], C08:[[413,410],[444,408],[445,458],[414,460]],
  C09:[[473,407],[536,403],[532,452],[474,456]],
  D01:[[57,480],[130,477],[131,527],[56,530]], D02:[[130,477],[179,474],[180,524],[131,527]],
  D03:[[55,530],[131,527],[132,574],[52,578]], D04:[[131,527],[194,524],[195,571],[132,574]],
  D05:[[71,572],[118,570],[119,620],[71,623]], D06:[[118,570],[150,568],[152,617],[119,620]],
  D07:[[150,568],[195,565],[196,614],[152,617]], D08:[[70,623],[120,620],[121,671],[68,675]],
  D09:[[120,620],[165,617],[166,668],[121,671]], D10:[[165,617],[211,614],[212,665],[166,668]],
}

export function customerPlotShape(row, customBackground) {
  const saved = readMapShape(row.map_shape)
  const corners = builtInBoundaries[row.code]
  if (saved || customBackground || !corners) return saved
  return {type:'polygon',points:corners.map(([x,y]) => [x / 565 * 100,(y - 387.2) / 324 * 100])}
}

export function mapPosition(row) {
  if (row.map_x != null && row.map_y != null) return [Number(row.map_x),Number(row.map_y)]
  return defaults[row.code]
}

export function shapePoints({type,points}) {
  if (type !== 'rectangle' || points.length < 2) return points
  const [[x1,y1],[x2,y2]] = points
  return [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
}

export function readMapShape(value) {
  if (typeof value !== 'string' || value.length > 2000) return null
  let shape
  try { shape = JSON.parse(value) } catch { return null }
  if (!shape || !['rectangle','polygon'].includes(shape.type) || !Array.isArray(shape.points)) return null
  const { type,points } = shape
  if (type === 'rectangle' ? points.length !== 2 : points.length < 3 || points.length > 24) return null
  if (!points.every(point => Array.isArray(point) && point.length === 2 &&
    point.every(value => Number.isFinite(value) && value >= 0 && value <= 100))) return null
  const vertices = shapePoints(shape)
  if (new Set(vertices.map(point => point.join(','))).size !== vertices.length) return null
  const area = vertices.reduce((sum,[x,y],index) => {
    const [nextX,nextY] = vertices[(index+1)%vertices.length]
    return sum + x*nextY - nextX*y
  },0)
  return Math.abs(area) >= 1 ? {type,points} : null
}

export function shapeCenter(shape) {
  return [0,1].map(axis => {
    const values = shape.points.map(point => point[axis])
    return (Math.min(...values)+Math.max(...values))/2
  })
}
