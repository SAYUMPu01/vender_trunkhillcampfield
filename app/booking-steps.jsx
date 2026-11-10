import Link from 'next/link'

const steps = ['เลือกล็อก','สรุปการจอง','ชำระเงิน','ผลการจอง']

export function BookingSteps({current}) {
  return <nav className="booking-steps" aria-label="ขั้นตอนการจอง">
    <ol role="list">
      {steps.map((label,index) => {
        const step = index + 1
        const content = <><span className="booking-step-number">{step}</span><span>{label}</span></>
        return <li key={label} aria-current={current === step ? 'step' : undefined}>
          {current === 2 && step === 1
            ? <Link className="booking-step" href="/">{content}</Link>
            : <span className="booking-step">{content}</span>}
        </li>
      })}
    </ol>
  </nav>
}
