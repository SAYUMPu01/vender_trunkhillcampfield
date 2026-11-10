'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { checkoutChargeField, checkoutChargeFields, checkoutChargeTotals, decimalUnits, electricityCharge, electricityFormulaKey, hasUnallocatedCheckoutCharges, maxUnitsMilli, savedCheckoutCharges } from '../../lib/checkout-pricing'
import { money } from '../../lib/pricing'
import { adminUrl } from './navigation'
import { saveCheckoutSettings } from './checkout-actions'

const baht = satang => money(satang / 100)
const unitFormat = new Intl.NumberFormat('th-TH',{maximumFractionDigits:3})
const chargeInputs = [
  {field:'units', label:'จำนวนไฟที่ใช้ (หน่วย)', max:'99999.999', step:'0.001', scale:1000},
  {field:'damage', label:'ค่าของชำรุด (บาท)', max:'999999.99', step:'0.01', scale:100},
  {field:'other', label:'ค่าใช้จ่ายอื่น ๆ (บาท)', max:'999999.99', step:'0.01', scale:100},
]
const lodgingLabel = ({code,name}) => name === code ? code : code + ' · ' + name

function ElectricityBreakdown({formula, usage}) {
  return <div className="small muted">
    <p>หน่วยฟรี {unitFormat.format(usage.freeUnits)} หน่วย ({unitFormat.format(formula.freePerGuest / 1000)} หน่วยต่อคน × {formula.guests} คน ÷ {formula.locks} ล็อก)</p>
    <p>คิดเงิน {unitFormat.format(usage.billableUnits)} หน่วย{formula.rate !== null && ` × ${baht(formula.rate)}/หน่วย`}</p>
  </div>
}

function CheckoutTotals({total, electricity, damage, other}) {
  const extra = electricity + damage + other
  return <dl className="checkout-totals">
    <div><dt>ยอดจองเดิม</dt><dd>{money(total)}</dd></div>
    <div><dt>ค่าไฟ</dt><dd>{baht(electricity)}</dd></div>
    <div><dt>ค่าของชำรุด</dt><dd>{baht(damage)}</dd></div>
    <div><dt>ค่าใช้จ่ายอื่น ๆ</dt><dd>{baht(other)}</dd></div>
    <div><dt>ยอดรวมทั้งหมด</dt><dd>{baht(total * 100 + extra)}</dd></div>
    <div className="checkout-balance"><dt>ยอดที่ต้องชำระเพิ่ม</dt><dd>{baht(extra)}</dd></div>
  </dl>
}

export function CheckoutForm({action, booking, lodging, savedFormula, currentFormula, qr, canCharge}) {
  const [saveState, save, saving] = useActionState(action,null)
  const [completeState, complete, completing] = useActionState(action,null)
  const savedCharges = savedCheckoutCharges(booking)
  const savedLodging = booking.lodging_charges ? JSON.parse(booking.lodging_charges) : null
  const sites = lodging.length ? lodging : [{code:'',name:''}]
  const original = sites.map(({code}) => savedLodging?.[code] ??
    (sites.length === 1 ? savedCharges : {units:0,electricity:0,damage:0,other:0}))
  const [entries, setEntries] = useState(() => original.map(line => Object.fromEntries(
    chargeInputs.map(({field,scale}) => [field,String(line[field] / scale)]))))
  const [note, setNote] = useState(booking.note ?? '')
  const [useCurrentFormula, setUseCurrentFormula] = useState(false)
  const [allocate, setAllocate] = useState(false)
  const unallocated = hasUnallocatedCheckoutCharges(booking,lodging.length)
  const keep = unallocated && !allocate
  const formulaChanged = electricityFormulaKey(savedFormula) !== electricityFormulaKey(currentFormula)
  const useCurrent = !keep && formulaChanged && useCurrentFormula
  const formula = useCurrent ? currentFormula : savedFormula
  const charges = keep || booking.completed_at ? savedCharges : checkoutChargeTotals(entries,formula)
  const saved = Boolean(booking.version)
  const dirty = useCurrent || (unallocated && allocate) || !charges || note.trim() !== (booking.note ?? '') ||
    charges.lines?.some((line,index) => checkoutChargeFields.some(field => line[field] !== original[index][field]))
  const extra = charges ? charges.electricity + charges.damage + charges.other : 0
  const totals = charges && <CheckoutTotals total={booking.total} {...charges}/>

  if (booking.completed_at) return <section className="stack checkout-body">
    <p className="notice" role="status">Check-out แล้ว{extra > 0 && ' · ยืนยันรับยอดชำระเพิ่มแล้ว'}</p>
    {savedLodging ? lodging.map(site => {
      const line = savedLodging[site.code]
      if (!line) return null
      return <section key={site.code} className="checkout-item stack">
        <h3>{lodgingLabel(site)}</h3>
        <div className="checkout-line"><span>ค่าไฟ ({unitFormat.format(line.units / 1000)} หน่วย)</span><strong>{baht(line.electricity)}</strong></div>
        <div className="checkout-line"><span>ค่าของชำรุด</span><strong>{baht(line.damage)}</strong></div>
        <div className="checkout-line"><span>ค่าใช้จ่ายอื่น ๆ</span><strong>{baht(line.other)}</strong></div>
      </section>
    }) : <>
      <p>ใช้ไฟ {unitFormat.format(savedCharges.units / 1000)} หน่วย</p>
      <ElectricityBreakdown formula={formula} usage={electricityCharge(savedCharges.units,formula)}/>
    </>}
    {booking.note && <p className="checkout-note">หมายเหตุ {booking.note}</p>}
    {totals}
  </section>
  if (!canCharge) return <section className="checkout-body">
    <p className="notice">สามารถ Check-out ได้ตั้งแต่วันเช็กอิน</p>
  </section>

  return <div className="stack checkout-body">
    <form action={save} className="stack">
      <input type="hidden" name="version" value={booking.version ?? 0}/>
      <input type="hidden" name="formula" value={electricityFormulaKey(formula)}/>
      <input type="hidden" name="chargeMode" value={keep ? 'keep' : 'edit'}/>
      {unallocated && <div>
        <p className="small muted">รายการนี้มียอดเดิมที่บันทึกรวมไว้ {baht(savedCharges.electricity + savedCharges.damage + savedCharges.other)}</p>
        <label className="checkbox"><input type="checkbox" checked={allocate} onChange={event => setAllocate(event.target.checked)}/>
          กรอกยอดใหม่แยกตามล็อก</label>
      </div>}
      {!keep && formulaChanged && <div>
        <p className="small muted">รายการนี้ใช้สูตรค่าไฟที่บันทึกไว้ก่อนหน้า</p>
        <label className="checkbox"><input type="checkbox" name="useCurrentFormula" checked={useCurrent}
          onChange={event => setUseCurrentFormula(event.target.checked)}/>ใช้สูตรค่าไฟจากการตั้งค่าปัจจุบัน</label>
      </div>}
      {!keep && sites.map((site,index) => {
        const units = decimalUnits(entries[index].units || '0',3,maxUnitsMilli)
        const usage = units === null ? null : electricityCharge(units,formula)
        return <fieldset className="checkout-item checkout-charge-group stack" key={site.code}>
          <legend>{site.code ? 'ค่าใช้จ่าย · ' + lodgingLabel(site) : 'ค่าใช้จ่าย'}</legend>
          <div className="checkout-inputs">
            {chargeInputs.map(({field,label,max,step}) => <label key={field}>{label}
              <input name={checkoutChargeField(field,site.code)} type="number" min="0" max={max} step={step}
                inputMode="decimal" value={entries[index][field]} onChange={event => {
                  const value = event.target.value
                  setEntries(previous => previous.map((entry,i) => i === index ? {...entry,[field]:value} : entry))
                }}/>
            </label>)}
          </div>
          {usage && <>
            <ElectricityBreakdown formula={formula} usage={usage}/>
            <div className="checkout-line"><span>ค่าไฟ</span><strong>{baht(usage.amount)}</strong></div>
          </>}
        </fieldset>
      })}
      <label>หมายเหตุ / รายการค่าใช้จ่าย<textarea name="note" rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)}/></label>
      {totals || <p className="muted small">ตรวจสอบจำนวนหน่วยไฟและค่าใช้จ่ายรายล็อก รวมถึงยอดรวมของแต่ละประเภท</p>}
      {saveState?.error && <p className="notice error" role="alert">{saveState.error}</p>}
      <button className="button" disabled={saving || completing || !charges}>{saving ? 'กำลังบันทึก…' : 'บันทึกยอดค่าใช้จ่าย'}</button>
    </form>
    {saved && !dirty && <section className="stack checkout-settlement">
      {extra > 0 && (qr ? <div className="checkout-qr">
        <strong>สแกนพร้อมเพย์เพื่อชำระเพิ่ม {baht(extra)}</strong>
        <img src={qr} width={224} height={224} alt={'QR พร้อมเพย์สำหรับยอด ' + baht(extra)}/>
        <p className="small muted">ตรวจสอบชื่อผู้รับและยอดเงินในแอปธนาคารก่อนโอน</p>
      </div> : <p className="notice">ตั้งค่าพร้อมเพย์ใน <Link href={adminUrl('checkoutSettings')}>ตั้งค่า Check-out</Link> แล้วกลับมาบันทึกยอดอีกครั้งเพื่อสร้าง QR</p>)}
      <form action={complete} className="stack">
        <input type="hidden" name="version" value={booking.version}/>
        <input type="hidden" name="intent" value="complete"/>
        {extra > 0 && <label className="checkbox"><input type="checkbox" name="received" required/>ตรวจสอบและได้รับยอดชำระเพิ่ม {baht(extra)} แล้ว</label>}
        {completeState?.error && <p className="notice error" role="alert">{completeState.error}</p>}
        <button className="button" disabled={saving || completing}>{completing ? 'กำลังยืนยัน…' : 'ยืนยัน Check-out'}</button>
      </form>
    </section>}
  </div>
}

export function CheckoutSettingsForm({rate, freePerGuest, promptpay}) {
  const [state, save, pending] = useActionState(saveCheckoutSettings,null)
  const [price, setPrice] = useState((rate / 100).toFixed(2))
  const [freeUnits, setFreeUnits] = useState(String(freePerGuest / 1000))
  const [recipient, setRecipient] = useState(promptpay ?? '')
  return <form action={save} className="panel stack admin-content">
    <h2>ค่าไฟและพร้อมเพย์สำหรับ Check-out</h2>
    <label>หน่วยไฟฟรีต่อคน<input name="freePerGuest" type="number" min="0" max="999.999" step="0.001" inputMode="decimal" required value={freeUnits} onChange={e => setFreeUnits(e.target.value)}/></label>
    <label>ค่าไฟต่อหน่วย (บาท)<input name="rate" type="number" min="0" max="999.99" step="0.01" inputMode="decimal" required value={price} onChange={e => setPrice(e.target.value)}/></label>
    <p className="muted small">หน่วยฟรี = หน่วยไฟฟรีต่อคน × จำนวนผู้เข้าพัก ÷ จำนวนล็อก<br/>
      ค่าไฟ = หน่วยที่ใช้เกินจากหน่วยฟรี × ค่าไฟต่อหน่วย<br/>
      รายการห้องพักที่ไม่มีล็อกใช้ตัวหาร 1 สูตรนี้ใช้กับรายการที่ยังไม่ได้บันทึกอัตราค่าไฟ</p>
    <label>เบอร์มือถือพร้อมเพย์ หรือเลขบัตรประชาชน / เลขผู้เสียภาษี<input name="promptpay" inputMode="numeric" maxLength={20} value={recipient} onChange={e => setRecipient(e.target.value)}/></label>
    <p className="muted small">ใช้สร้าง QR ระบุยอดชำระเพิ่มตอน Check-out</p>
    {state?.error && <p className="notice error" role="alert">{state.error}</p>}
    <div className="actions"><button className="button" disabled={pending}>บันทึกการตั้งค่า</button></div>
  </form>
}
