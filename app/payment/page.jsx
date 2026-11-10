import { PaymentScreen } from './payment-screen'

export const metadata = { title:'ชำระเงิน | Trunkhill Campfield' }

export default async function PaymentPage({searchParams}) {
  const {id} = await searchParams
  return <PaymentScreen id={typeof id === 'string' ? id : ''}/>
}
