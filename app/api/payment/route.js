import { api } from '../../../lib/api'
import { paymentDetails, submitPayment } from '../../../lib/payment'

export const runtime = 'nodejs'

export function GET(request) {
  return api(() => paymentDetails(request))
}

export function POST(request) {
  return api(() => submitPayment(request))
}
