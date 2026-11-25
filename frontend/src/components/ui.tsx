import { useEffect, useId, useState, type ReactNode } from 'react'
import { copyCSV, downloadCSV } from '../lib/util'

export function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  decimals?: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  const { label, value, min, max, step, unit, decimals = 0, disabled, onChange } = props
  const id = useId()
  const show = (v: number) => v.toFixed(decimals).replace('.', ',')
  const [text, setText] = useState(show(value))
  useEffect(() => setText(value.toFixed(decimals).replace('.', ',')), [value, decimals])
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'))
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
    else setText(show(value))
  }
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="slider">
      <div className="slider-top">
        <label htmlFor={id}>{label}</label>
        <span className="slider-val">
          <input
            aria-label={`${label} (valor)`}
            inputMode="decimal"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
          {unit && <small>{unit}</small>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

export function Seg<T extends string>(props: {
  label?: string
  value: T
  options: { value: T; label: string; disabled?: boolean; title?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="ctl-group" style={{ gap: 6 }}>
      {props.label && <span className="ctl-label">{props.label}</span>}
      <div className="seg" role="group" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={props.value === o.value}
            disabled={o.disabled}
            title={o.title}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggle(props: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; color?: string; dashed?: boolean }) {
  return (
    <label className="toggle">
      <span className="sw-text">
        {props.color && (
          <span
            className="legend-dot"
            style={{
              background: props.dashed ? `repeating-linear-gradient(90deg, ${props.color} 0 4px, transparent 4px 7px)` : props.color,
            }}
          />
        )}
        {props.label}
      </span>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  )
}

export function Metric(props: { label: string; value: string; unit?: string; note?: string; lead?: boolean }) {
  return (
    <div className={`metric${props.lead ? ' lead' : ''}`}>
      <span>{props.label}</span>
      <b>
        {props.value}
        {props.unit && <small>{props.unit}</small>}
      </b>
      {props.note && <em>{props.note}</em>}
    </div>
  )
}

export function Card(props: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${props.className ?? ''}`} id={props.id}>
      {(props.title || props.actions) && (
        <div className="card-head">
          {props.title && <h3>{props.title}</h3>}
          {props.actions && <div className="btn-row">{props.actions}</div>}
        </div>
      )}
      {props.children}
    </section>
  )
}

export function Tip(props: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: number | string
  xLabel?: string
  digits?: number
}) {
  if (!props.active || !props.payload?.length) return null
  const d = props.digits ?? 2
  return (
    <div className="tip">
      <div className="muted">
        {props.xLabel ?? 'x'} = <b>{typeof props.label === 'number' ? props.label.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : props.label}</b>
      </div>
      {props.payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toLocaleString('pt-BR', { maximumFractionDigits: d }) : p.value}</b>
        </div>
      ))}
    </div>
  )
}

export function CsvButtons(props: { name: string; rows: () => Record<string, unknown>[] }) {
  const [copied, setCopied] = useState(false)
  return (
    <>
      <button
        className="btn sm"
        type="button"
        onClick={() => {
          downloadCSV(props.name, props.rows())
        }}
      >
        Baixar CSV
      </button>
      <button
        className="btn sm"
        type="button"
        onClick={async () => {
          const ok = await copyCSV(props.rows())
          setCopied(ok)
          setTimeout(() => setCopied(false), 1600)
        }}
      >
        {copied ? 'Copiado ✓' : 'Copiar CSV'}
      </button>
    </>
  )
}
