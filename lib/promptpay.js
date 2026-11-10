import QRCode from 'qrcode'

export function promptpayId(value) {
  const digits = value.replace(/[ -]/g, '')
  return /^0\d{9}$|^\d{13}$/.test(digits) ? digits : null
}

function field(id, value) {
  return id + String(value.length).padStart(2, '0') + value
}

function checksum(payload) {
  let crc = 0xffff
  for (const character of payload) {
    crc ^= character.charCodeAt(0) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function promptpayPayload(recipient, satang) {
  const proxy = recipient.length === 10 ? field('01', '0066' + recipient.slice(1)) : field('02', recipient)
  const amount = Math.floor(satang / 100) + '.' + String(satang % 100).padStart(2, '0')
  const payload = field('00', '01') + field('01', '12') +
    field('29', field('00', 'A000000677010111') + proxy) +
    field('53', '764') + field('54', amount) + field('58', 'TH') + '6304'
  return payload + checksum(payload)
}

export function checkoutQr(recipient, satang) {
  return QRCode.toDataURL(promptpayPayload(recipient, satang), { width:256, errorCorrectionLevel:'M' })
}
