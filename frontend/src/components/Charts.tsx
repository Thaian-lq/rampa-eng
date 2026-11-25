import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Tip } from './ui'

export interface SeriesDef {
  key: string
  name: string
  color: string
  dash?: boolean
  width?: number
}

const tick = { fontSize: 11 }
export const axisFmt = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export function LineBox(props: {
  title: string
  unit?: string
  data: Record<string, number>[]
  xKey: string
  xLabel: string
  series: SeriesDef[]
  cursor?: number
  digits?: number
  tall?: boolean
  logX?: boolean
  logY?: boolean
}) {
  return (
    <div>
      <div className="chart-title">
        <h3>{props.title}</h3>
        <span>
          {props.series.map((s) => (
            <span key={s.key} style={{ marginLeft: 10, whiteSpace: 'nowrap' }}>
              <span
                className="legend-dot"
                style={{
                  background: s.dash ? `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)` : s.color,
                  marginRight: 5,
                  verticalAlign: 'middle',
                }}
              />
              {s.name}
            </span>
          ))}
          {props.unit && <span style={{ marginLeft: 10 }}>({props.unit})</span>}
        </span>
      </div>
      <div className={`chart${props.tall ? ' tall' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={props.data} margin={{ top: 6, right: 10, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey={props.xKey}
              type="number"
              domain={props.logX ? ['auto', 'auto'] : ['dataMin', 'dataMax']}
              scale={props.logX ? 'log' : 'auto'}
              tick={tick}
              tickFormatter={axisFmt}
              allowDataOverflow
            />
            <YAxis
              tick={tick}
              tickFormatter={props.logY ? (v: number) => v.toExponential(0) : axisFmt}
              width={props.logY ? 58 : 50}
              scale={props.logY ? 'log' : 'auto'}
              domain={props.logY ? ['auto', 'auto'] : ['auto', 'auto']}
            />
            <Tooltip content={<Tip xLabel={props.xLabel} digits={props.digits} />} isAnimationActive={false} />
            {props.cursor !== undefined && <ReferenceLine x={props.cursor} stroke="var(--orange)" strokeWidth={1.5} ifOverflow="extendDomain" />}
            {props.series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.width ?? 2.2}
                strokeDasharray={s.dash ? '6 5' : undefined}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
