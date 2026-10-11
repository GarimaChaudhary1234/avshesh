import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Button, ErrorText, Field, inputClass } from './ui'

/** Non-recyclable waste: nobody buys it, so the household asks the municipal corporation to collect it. */
export default function MunicipalPickupForm({ itemCode }) {
  const { t } = useTranslation()
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.requestMunicipalPickup({ itemCode, estKg: Number(weight), note })
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p className="rounded-xl bg-leaf-50 px-3 py-3 text-sm">
        <Trans
          i18nKey="municipalForm.sent"
          components={{ go: <Link to="/listings" className="font-semibold text-leaf-700 underline" /> }}
        />
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={t('municipalForm.weight')}>
        <input
          className={inputClass}
          type="number"
          inputMode="decimal"
          min="0.1"
          max="200"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
        />
      </Field>
      <Field label={t('municipalForm.note')}>
        <input className={inputClass} maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorText error={error} />
      <Button big disabled={busy || !(Number(weight) > 0)}>
        {busy ? t('municipalForm.wait') : t('municipalForm.submit')}
      </Button>
    </form>
  )
}
