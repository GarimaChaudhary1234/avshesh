import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { StarPicker } from '../../components/Stars'
import { Badge, Button, Card, ErrorText, Loading } from '../../components/ui'
import { ErrorOrVerify } from '../../components/VerifyPrompt'
import { dateOnly, dateTime, kg, rupee } from '../../lib/format'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'

const STATUS = {
  OPEN: { tone: 'amber', label: 'household.status.OPEN' },
  SCHEDULED: { tone: 'green', label: 'household.status.SCHEDULED' },
  DONE: { tone: 'slate', label: 'household.status.DONE' },
}

const REQUEST_STATUS = {
  OPEN: { tone: 'amber', label: 'household.request.OPEN' },
  SCHEDULED: { tone: 'green', label: 'household.request.SCHEDULED' },
  COLLECTED: { tone: 'slate', label: 'household.request.COLLECTED' },
  REJECTED: { tone: 'red', label: 'household.request.REJECTED' },
}

const PAYMENT_CHIP = {
  CONFIRMED: { tone: 'green', label: 'household.payment.CONFIRMED' },
  DISPUTED: { tone: 'amber', label: 'household.payment.DISPUTED' },
  RESOLVED: { tone: 'slate', label: 'household.payment.RESOLVED' },
}

const loadAll = () => Promise.all([api.myListings(), api.myMunicipalRequests(), api.myRatings()])

export default function MyListings() {
  const { t } = useTranslation()
  // NewListing passes a notice here when a listing was saved offline.
  const notice = useLocation().state?.notice
  const { data, error, loading, reload } = useLoad(loadAll)

  // Coming back online reloads the list, so a screen opened offline does not stay on its error.
  useEffect(() => {
    window.addEventListener('online', reload)
    return () => window.removeEventListener('online', reload)
  }, [reload])

  if (loading) return <Loading />
  if (error) {
    return (
      <>
        {notice && <Card className="rounded-xl bg-earth-100 text-sm">{notice}</Card>}
        <ErrorText error={error} />
      </>
    )
  }
  const [listings, requests, ratings] = data
  const ratingOf = (listingId) => ratings.find((r) => r.listingId === listingId)

  return (
    <>
      <h1 className="text-xl font-bold">{t('household.my.title')}</h1>
      {notice && <Card className="rounded-xl bg-earth-100 text-sm">{notice}</Card>}
      {listings.length === 0 && <Card className="text-sm text-slate-600">{t('household.my.none')}</Card>}
      {listings.map((l) => {
        const status = STATUS[l.status]
        const itemName = t(`item.${l.itemCode}.name`, { defaultValue: l.itemName })
        return (
          <Card key={l.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{itemName}</h2>
              <Badge tone={status.tone}>{t(status.label)}</Badge>
            </div>
            <p className="text-sm text-slate-600">
              {t('household.my.summary', {
                weight: kg(l.estKg),
                earning: rupee(l.estEarning),
                mode: l.mode === 'POOL' ? t('household.my.modePool') : t('household.my.modeSelf'),
              })}
            </p>

            {l.status === 'SCHEDULED' && (
              <div className="rounded-xl bg-leaf-50 p-3 text-sm">
                <Trans
                  i18nKey="household.my.confirmed"
                  values={{ date: dateTime(l.pickupStart) }}
                  components={{ b: <b /> }}
                />
              </div>
            )}
            {l.status === 'DONE' && (
              <>
                <p className="rounded-xl bg-leaf-50 p-3 text-sm">
                  <Trans
                    i18nKey="household.my.weighed"
                    values={{ weight: kg(l.actualKg), amount: rupee(l.amountPaid) }}
                    components={{ b: <b /> }}
                  />
                </p>
                <PaymentConfirmation listing={l} onAnswered={reload} />
                <RateCollector listingId={l.id} existing={ratingOf(l.id)} onRated={reload} />
              </>
            )}
          </Card>
        )
      })}

      {requests.length > 0 && (
        <>
          <h2 className="pt-2 text-lg font-semibold">{t('household.my.municipalTitle')}</h2>
          {requests.map((r) => {
            const status = REQUEST_STATUS[r.status]
            return (
              <Card key={r.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{t(`item.${r.itemCode}.name`, { defaultValue: r.itemName })}</h3>
                  <Badge tone={status.tone}>{t(status.label)}</Badge>
                </div>
                <p className="text-sm text-slate-600">{kg(r.estKg)}{r.note ? ` · ${r.note}` : ''}</p>
                {r.status === 'SCHEDULED' && (
                  <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm">
                    {r.staffName ? (
                      <Trans
                        i18nKey="household.my.collectionBy"
                        values={{ date: dateOnly(r.scheduledFor), staff: r.staffName }}
                        components={{ b: <b /> }}
                      />
                    ) : (
                      <Trans
                        i18nKey="household.my.collectionOn"
                        values={{ date: dateOnly(r.scheduledFor) }}
                        components={{ b: <b /> }}
                      />
                    )}
                  </p>
                )}
              </Card>
            )
          })}
        </>
      )}
    </>
  )
}

/** The household confirms the dealer really paid; a "no" opens a dispute for the municipal officer. */
function PaymentConfirmation({ listing, onAnswered }) {
  const { t } = useTranslation()
  const [denying, setDenying] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const chip = PAYMENT_CHIP[listing.paymentStatus]
  if (chip) {
    return (
      <div className="space-y-1">
        <Badge tone={chip.tone}>{t(chip.label)}</Badge>
        {listing.paymentStatus === 'RESOLVED' && listing.resolutionNote && (
          <p className="text-sm text-slate-600">{listing.resolutionNote}</p>
        )}
      </div>
    )
  }
  if (listing.paymentStatus !== 'PENDING') return null

  const answer = async (received) => {
    setBusy(true)
    setError(null)
    try {
      await api.answerPayment(listing.id, { received, note: received ? '' : note.trim() })
      onAnswered()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-medium">{t('household.payment.ask', { amount: rupee(listing.amountPaid) })}</p>
      {denying && (
        <textarea
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          rows={2}
          maxLength={255}
          required
          placeholder={t('household.payment.notePlaceholder')}
          aria-label={t('household.payment.notePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      <ErrorText error={error} />
      <div className="flex gap-2">
        {!denying && (
          <Button disabled={busy} onClick={() => answer(true)}>
            {t('household.payment.yes')}
          </Button>
        )}
        {denying ? (
          <Button disabled={busy || note.trim() === ''} onClick={() => answer(false)}>
            {busy ? t('household.wait') : t('household.payment.send')}
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => setDenying(true)}>
            {t('household.payment.no')}
          </Button>
        )}
      </div>
    </div>
  )
}

/** After a completed pickup the household rates the scrap dealer or compost center once. */
function RateCollector({ listingId, existing, onRated }) {
  const { t } = useTranslation()
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (existing) {
    const given = '★'.repeat(existing.stars)
    return (
      <p className="text-sm text-slate-600">
        {existing.comment
          ? t('household.rate.doneComment', { stars: given, comment: existing.comment })
          : t('household.rate.done', { stars: given })}
      </p>
    )
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.rateCollector({ listingId, stars, comment })
      onRated()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-medium">{t('household.rate.ask')}</p>
      <StarPicker value={stars} onChange={setStars} />
      <input
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        placeholder={t('household.rate.placeholder')}
        aria-label={t('household.rate.placeholder')}
        maxLength={255}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <ErrorOrVerify error={error} />
      <Button disabled={busy || stars === 0} onClick={submit}>
        {busy ? t('household.wait') : t('household.rate.submit')}
      </Button>
    </div>
  )
}
