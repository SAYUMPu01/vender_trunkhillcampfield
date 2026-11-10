export const draftKey = 'trunkhill-booking-draft'

export function readBookingDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey))
  } catch {
    return null
  }
}
