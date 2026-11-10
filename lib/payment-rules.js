export const liveAllocation = `NOT EXISTS (
  SELECT 1 FROM booking_payments payment
  WHERE payment.booking = a.booking AND payment.submitted_at IS NULL
    AND payment.expires_at <= UTC_TIMESTAMP()
)`

export const effectiveStatus = `CASE
  WHEN b.status = 'pending' AND p.submitted_at IS NULL AND p.expires_at <= UTC_TIMESTAMP()
  THEN 'cancelled' ELSE b.status END`

export function uploadMime(bytes, allowPdf = false) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255,216,255]))) return 'image/jpeg'
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png'
  if (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp'
  if (allowPdf && bytes.toString('ascii',0,5) === '%PDF-') return 'application/pdf'
  return null
}
