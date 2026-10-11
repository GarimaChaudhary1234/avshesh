import { useTranslation } from 'react-i18next'

const cx =(...parts) => parts.filter(Boolean).join(' ')

const CARD_TONES = {
  default: 'bg-white ring-1 ring-black/5',
  brand: 'bg-leaf-700 text-white',
  danger: 'bg-red-50 ring-2 ring-red-300',
  notice: 'bg-earth-100',
}

export function Card({ tone = 'default', className, children }) {
  return <div className={cx('rounded-2xl p-4 shadow-sm', CARD_TONES[tone], className)}>{children}</div>
}

const BUTTON_STYLES = {
  primary: 'bg-leaf-600 text-white hover:bg-leaf-700 disabled:bg-leaf-600/50',
  secondary: 'bg-leaf-50 text-leaf-700 hover:bg-leaf-100 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
  ghost: 'text-leaf-700 hover:bg-leaf-50 disabled:opacity-50',
}

export function Button({ variant = 'primary', big, className, ...props }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed',
        big ? 'w-full px-5 py-4 text-lg' : 'px-4 py-2 text-sm',
        BUTTON_STYLES[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/20'

export function ErrorText({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {error.message ?? String(error)}
    </p>
  )
}

export function Loading({ label }) {
  const { t } = useTranslation()
  return <p className="py-8 text-center text-sm text-slate-500">{label ?? t('common.loading')}</p>
}

export function Badge({ tone = 'green', children }) {
  const tones = {
    green: 'bg-leaf-100 text-leaf-700',
    amber: 'bg-earth-100 text-earth-500',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  )
}

export function ProgressBar({ percent }) {
  const value = Math.max(0, Math.min(100, percent))
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-leaf-100"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-leaf-500 transition-all" style={{ width: `${value}%` }} />
    </div>
  )
}

export function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-leaf-50 p-3 text-center">
      <div className="text-xl font-bold text-leaf-700">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  )
}
