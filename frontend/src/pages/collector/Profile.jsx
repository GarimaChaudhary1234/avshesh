import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CollectorStatusBanner from '../../components/CollectorStatusBanner'
import { StarRating } from '../../components/Stars'
import { Badge, Button, Card, ErrorText, Field, inputClass, Loading } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'
import { useLoad } from '../../lib/useLoad'

const VEHICLES = [
  { value: 'CYCLE_RICKSHAW', label: 'collector.vehicle.CYCLE_RICKSHAW' },
  { value: 'E_RICKSHAW', label: 'collector.vehicle.E_RICKSHAW' },
  { value: 'AUTO', label: 'collector.vehicle.AUTO' },
  { value: 'MINI_TRUCK', label: 'collector.vehicle.MINI_TRUCK' },
]

const VERIFICATION = {
  VERIFIED: { tone: 'green', label: 'collector.verification.VERIFIED' },
  PENDING: { tone: 'amber', label: 'collector.verification.PENDING' },
  REJECTED: { tone: 'red', label: 'collector.verification.REJECTED' },
}

const load = () => Promise.all([api.profile(), api.rateCard(), api.catalog(), api.myRating()])

export default function Profile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data, error, loading } = useLoad(load)
  const [business, setBusiness] = useState(null)
  const [rules, setRules] = useState(null)
  const [rates, setRates] = useState({})
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [busy, setBusy] = useState(false)

  const category = user.role === 'COMPOST' ? 'WET' : 'DRY'

  useEffect(() => {
    if (!data) return
    const [profile, card] = data
    setBusiness({
      businessName: profile.businessName ?? '',
      address: profile.address ?? '',
      vehicleType: profile.vehicleType,
      costPerKm: profile.costPerKm,
      workingHours: profile.workingHours ?? '',
      vehicleCapacityKg: profile.vehicleCapacityKg ?? '',
      acceptingPickups: profile.acceptingPickups,
    })
    setRules({
      serviceRadiusKm: card.serviceRadiusKm,
      minTripProfit: card.minTripProfit,
      minLoadKg: card.minLoadKg,
      dailyCapacityKg: card.dailyCapacityKg ?? '',
    })
    setRates(Object.fromEntries(card.items.map((i) => [i.itemCode, { buy: i.buyRate, sell: i.sellRate }])))
  }, [data])

  if (loading || !business) return error ? <ErrorText error={error} /> : <Loading />

  const [profile, , catalog, rating] = data
  const items = catalog.filter((i) => i.category === category)
  const verification = VERIFICATION[profile.verification]

  const edit = (setter) => (key) => (e) => {
    setSaved(false)
    setter((s) => ({ ...s, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }
  const editBusiness = edit(setBusiness)
  const editRules = edit(setRules)
  const editRate = (code, field) => (e) => {
    setSaved(false)
    setRates((r) => ({ ...r, [code]: { ...r[code], [field]: e.target.value } }))
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setSaveError(null)
    try {
      await api.saveProfile({
        ...business,
        costPerKm: Number(business.costPerKm),
        // Empty means "use the default for the vehicle type".
        vehicleCapacityKg: business.vehicleCapacityKg === '' ? null : Number(business.vehicleCapacityKg),
      })
      await api.saveRateCard({
        serviceRadiusKm: Number(rules.serviceRadiusKm),
        minTripProfit: Number(rules.minTripProfit),
        minLoadKg: Number(rules.minLoadKg),
        dailyCapacityKg: rules.dailyCapacityKg === '' ? null : Number(rules.dailyCapacityKg),
        items: Object.entries(rates)
          .filter(([, r]) => r.buy !== '' && r.buy != null && r.sell !== '' && r.sell != null)
          .map(([itemCode, r]) => ({ itemCode, buyRate: Number(r.buy), sellRate: Number(r.sell) })),
      })
      setSaved(true)
    } catch (err) {
      setSaveError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">👤 {t('collector.profile.title')}</h1>
        <Badge tone={verification.tone}>{t(verification.label)}</Badge>
      </div>
      <CollectorStatusBanner profile={{ ...profile, acceptingPickups: business.acceptingPickups }} />

      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t('collector.profile.rating')}</h2>
          <StarRating value={rating.summary.average} count={rating.summary.count} />
        </div>
        {rating.recent.length === 0 ? (
          <p className="text-sm text-slate-500">{t('collector.profile.ratingEmpty')}</p>
        ) : (
          rating.recent.map((r, i) => (
            <p key={i} className="text-sm">
              <span className="text-earth-500">{'★'.repeat(r.stars)}</span> “{r.comment}”
            </p>
          ))
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">{t('collector.profile.business')}</h2>
        <Field label={user.role === 'COMPOST' ? t('collector.profile.centerName') : t('collector.profile.shopName')}>
          <input className={inputClass} maxLength={120} value={business.businessName} onChange={editBusiness('businessName')} />
        </Field>
        <Field label={t('collector.profile.address')}>
          <input className={inputClass} maxLength={255} value={business.address} onChange={editBusiness('address')} />
        </Field>
        <Field label={t('collector.profile.vehicle')}>
          <select className={inputClass} value={business.vehicleType} onChange={editBusiness('vehicleType')}>
            {VEHICLES.map((v) => (
              <option key={v.value} value={v.value}>{t(v.label)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('collector.profile.vehicleCapacity')} hint={t('collector.profile.vehicleCapacityHint')}>
          <input className={inputClass} type="number" min="1" step="1" value={business.vehicleCapacityKg} onChange={editBusiness('vehicleCapacityKg')} />
        </Field>
        <Field label={t('collector.profile.costPerKm')} hint={t('collector.profile.costPerKmHint')}>
          <input className={inputClass} type="number" min="0" max="100" step="0.5" value={business.costPerKm} onChange={editBusiness('costPerKm')} required />
        </Field>
        <Field label={t('collector.profile.workingHours')}>
          <input className={inputClass} maxLength={60} placeholder={t('collector.profile.workingHoursPlaceholder')} value={business.workingHours} onChange={editBusiness('workingHours')} />
        </Field>
        <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <input type="checkbox" className="h-5 w-5" checked={business.acceptingPickups} onChange={editBusiness('acceptingPickups')} />
          <span>
            <span className="block font-medium">{t('collector.profile.accepting')}</span>
            <span className="block text-xs text-slate-500">{t('collector.profile.acceptingHint')}</span>
          </span>
        </label>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">{t('collector.profile.tripRules')}</h2>
        <Field label={t('collector.profile.radius')}>
          <input className={inputClass} type="number" min="0.5" step="0.5" value={rules.serviceRadiusKm} onChange={editRules('serviceRadiusKm')} required />
        </Field>
        <Field label={t('collector.profile.minProfit')} hint={t('collector.profile.minProfitHint')}>
          <input className={inputClass} type="number" min="0" value={rules.minTripProfit} onChange={editRules('minTripProfit')} required />
        </Field>
        {user.role === 'COMPOST' && (
          <>
            <Field label={t('collector.profile.minLoad')}>
              <input className={inputClass} type="number" min="0" value={rules.minLoadKg} onChange={editRules('minLoadKg')} required />
            </Field>
            <Field label={t('collector.profile.dailyCapacity')}>
              <input className={inputClass} type="number" min="0" value={rules.dailyCapacityKg} onChange={editRules('dailyCapacityKg')} />
            </Field>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t('collector.profile.rateCard')}</h2>
        <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 text-xs font-semibold text-slate-500">
          <span>{t('collector.profile.item')}</span>
          <span>{t('collector.profile.buy')}</span>
          <span>{t('collector.profile.sell')}</span>
        </div>
        {items.map((i) => {
          const name = t(`item.${i.code}.name`, { defaultValue: i.name })
          return (
          <div key={i.code} className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2">
            <span className="text-sm">{name}</span>
            <input aria-label={t('collector.profile.buyRateAria', { name })} className={inputClass} type="number" min="0" step="0.5" value={rates[i.code]?.buy ?? ''} onChange={editRate(i.code, 'buy')} />
            <input aria-label={t('collector.profile.sellRateAria', { name })} className={inputClass} type="number" min="0" step="0.5" value={rates[i.code]?.sell ?? ''} onChange={editRate(i.code, 'sell')} />
          </div>
          )
        })}
        <p className="text-xs text-slate-500">{t('collector.profile.rateHelp')}</p>
      </Card>

      <ErrorText error={saveError} />
      {saved && <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm text-leaf-700">✅ {t('collector.profile.saved')}</p>}
      <Button big disabled={busy}>
        {busy ? t('collector.profile.saving') : t('collector.profile.save')}
      </Button>
    </form>
  )
}
