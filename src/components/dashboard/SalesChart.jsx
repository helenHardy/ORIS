import React from 'react'

export default function SalesChart({ data, showLegend = true }) {
    if (!data || data.length === 0) return (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
            No hay datos suficientes para mostrar el gráfico.
        </div>
    )

    const hasProfit = data.some(d => typeof d.profit === 'number' && d.profit > 0)
    const height = 260
    const width = 660
    const padding = 40
    const chartHeight = height - padding * 2
    const chartWidth = width - padding * 2

    const maxVal = Math.max(...data.map(d => d.total), 10)
    const groupWidth = hasProfit ? chartWidth / data.length : (chartWidth / data.length)
    const barTotalWidth = hasProfit ? groupWidth * 0.62 : groupWidth * 0.7
    const barProfitWidth = groupWidth * 0.45
    const gap = groupWidth * 0.3

    return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
            {hasProfit && showLegend && (
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: 'hsl(var(--primary))', display: 'inline-block' }} /> Ventas
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: 'hsl(142 76% 36%)', display: 'inline-block' }} /> Ganancia
                    </div>
                </div>
            )}
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
                    </linearGradient>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142 76% 36%)" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity="0.45" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                    <line
                        key={i}
                        x1={padding}
                        y1={height - padding - (chartHeight * p)}
                        x2={width - padding}
                        y2={height - padding - (chartHeight * p)}
                        stroke="hsl(var(--border))"
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Bars */}
                {data.map((d, i) => {
                    const x = padding + (i * groupWidth) + (gap / 2)
                    const totalBarH = (d.total / maxVal) * chartHeight
                    const profitBarH = ((d.profit || 0) / maxVal) * chartHeight

                    return (
                        <g key={i}>
                            <rect
                                x={x}
                                y={height - padding - totalBarH}
                                width={hasProfit ? barTotalWidth : barTotalWidth}
                                height={totalBarH}
                                fill="url(#barGradient)"
                                rx="4"
                                className="chart-bar"
                                style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <title>{`${d.date}: Ventas Bs ${d.total.toFixed(2)}${hasProfit ? ` · Ganancia Bs ${(d.profit || 0).toFixed(2)}` : ''}`}</title>
                            </rect>
                            {hasProfit && (
                                <rect
                                    x={x + barTotalWidth + 4}
                                    y={height - padding - profitBarH}
                                    width={barProfitWidth}
                                    height={profitBarH || 2}
                                    fill="url(#profitGradient)"
                                    rx="4"
                                    className="chart-bar profit"
                                    style={{ animationDelay: `${i * 100 + 60}ms` }}
                                />
                            )}
                            <text
                                x={x + (hasProfit ? groupWidth / 2 : barTotalWidth / 2)}
                                y={height - padding + 20}
                                textAnchor="middle"
                                fontSize="10"
                                fill="hsl(var(--secondary-foreground))"
                            >
                                {d.label}
                            </text>
                        </g>
                    )
                })}

                {/* Y-axis labels */}
                {[0, 0.5, 1].map((p, i) => (
                    <text
                        key={i}
                        x={padding - 10}
                        y={height - padding - (chartHeight * p)}
                        textAnchor="end"
                        alignmentBaseline="middle"
                        fontSize="10"
                        fill="hsl(var(--secondary-foreground))"
                    >
                        {Math.round(maxVal * p).toLocaleString()}
                    </text>
                ))}

                <style>
                    {`
                        .chart-bar {
                            opacity: 0;
                            animation: slideUp 0.5s ease-out forwards;
                            cursor: pointer;
                            transition: opacity 0.2s, filter 0.2s;
                        }
                        .chart-bar:hover { filter: brightness(0.92); }
                        @keyframes slideUp {
                            from { transform: scaleY(0); transform-origin: bottom; opacity: 0; }
                            to { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
                        }
                    `}
                </style>
            </svg>
        </div>
    )
}