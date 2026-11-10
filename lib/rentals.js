export const tentCodes = ['SNOW-PEAK', 'LANDNEST-DOME', 'VAULT-TARP', 'LANDNEST-SHELTER', 'LANDLOCK', 'SNOW-PEAK-TARP']

export function isRentalStay(row) {
  return row.kind === 'room' || tentCodes.includes(row.code)
}
