import { useTranslation } from 'react-i18next'

/** Read-only star display, e.g. 4.5 of 5 with the number of ratings. */
export function StarRating({ value, count }) {
  const { t } = useTranslation()
  if (value == null || !count) {
    return <span className="text-xs text-slate-500">{t('stars.none')}</span>
  }
  return (
    <span className="text-sm" aria-label={t('stars.summary', { value, ratings: count })}>
      <span className="text-earth-500">★</span> <b>{value.toFixed(1)}</b>{' '}
      <span className="text-xs text-slate-500">({count})</span>
    </span>
  )
}

/** Five tappable stars that report the chosen number. */
export function StarPicker({ value, onChange }) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t('stars.rating')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={n === 1 ? t('stars.one') : t('stars.many', { n })}
          onClick={() => onChange(n)}
          className={`text-3xl leading-none ${n <= value ? 'text-earth-500' : 'text-slate-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
