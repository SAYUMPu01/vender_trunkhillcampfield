export function decimalUnits(input, places, max) {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!new RegExp('^\\d{1,6}(?:\\.\\d{1,' + places + '})?$').test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const units = Number(whole) * 10 ** places + Number(fraction.padEnd(places, '0'))
  return units <= max ? units : null
}

export const maxUnitsMilli = 99_999_999
export const maxExtraSatang = 99_999_999
export const maxRateSatang = 99_999
export const maxFreeUnitsMilli = 999_999
export const defaultElectricity = { electricity_rate:1000, free_units_per_guest:1000 }

export function electricityFormula(booking, settings, useCurrent = false) {
  const policy = booking.completed_at || (!useCurrent && booking.electricity_rate != null) ? booking : settings
  return {
    rate:policy.electricity_rate,
    freePerGuest:policy.free_units_per_guest,
    guests:booking.guest_count,
    locks:Math.max(1,Number(booking.plot_count)),
  }
}

export function electricityFormulaKey({rate,freePerGuest,guests,locks}) {
  return [rate,freePerGuest,guests,locks].join(':')
}

export function electricityCharge(unitsMilli, {rate,freePerGuest,guests,locks}) {
  // Keep fractional free units exact and round the final charge to satang.
  const lockCount = BigInt(locks)
  const free = BigInt(freePerGuest) * BigInt(guests)
  const remaining = BigInt(unitsMilli) * lockCount - free
  const billable = remaining > 0n ? remaining : 0n
  const divisor = lockCount * 1000n
  return {
    freeUnits:Number(free) / Number(divisor),
    billableUnits:Number(billable) / Number(divisor),
    amount:Number((billable * BigInt(rate ?? 0) + divisor / 2n) / divisor),
  }
}

export const extraCharge = row => Number(row.electricity_amount) + row.damage_amount + row.other_amount

export const checkoutChargeFields = ['units','damage','other']
export const checkoutChargeField = (field, code) => code ? field + ':' + code : field

export function savedCheckoutCharges(booking) {
  return {
    units:booking.units_milli ?? 0,
    electricity:Number(booking.electricity_amount ?? 0),
    damage:booking.damage_amount ?? 0,
    other:booking.other_amount ?? 0,
  }
}

export function hasUnallocatedCheckoutCharges(booking, lodgingCount) {
  return lodgingCount > 1 && booking && booking.lodging_charges == null &&
    checkoutChargeFields.some(field => savedCheckoutCharges(booking)[field] > 0)
}

export function checkoutChargeTotals(rows, formula) {
  const lines = []
  const totals = { units:0, electricity:0, damage:0, other:0 }
  for (const row of rows) {
    const units = decimalUnits(row.units === '' ? '0' : row.units,3,maxUnitsMilli)
    const damage = decimalUnits(row.damage === '' ? '0' : row.damage,2,maxExtraSatang)
    const other = decimalUnits(row.other === '' ? '0' : row.other,2,maxExtraSatang)
    if ([units,damage,other].includes(null)) return null
    const { amount:electricity } = electricityCharge(units,formula)
    lines.push({units,electricity,damage,other})
    totals.units += units
    totals.electricity += electricity
    totals.damage += damage
    totals.other += other
  }
  if (totals.units > maxUnitsMilli || totals.damage > maxExtraSatang || totals.other > maxExtraSatang) return null
  return { ...totals, lines }
}
