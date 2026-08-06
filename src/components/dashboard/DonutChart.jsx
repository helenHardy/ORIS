import React from 'react'

export default function DonutChart({ segments, size = 190, thickness = 30, centerLabel, centerValue }) {
    const total = segments.reduce((acc, s) => acc + (Number(s.value) || 0), 0)
    const radius = (size - thickness) / 2
    const circumference = 2 * Math.PI * radius
    let offset = 0

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
                <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="hsl(var(--muted) / 0.4)"
                        strokeWidth={thickness}
                    />
                    {total > 0 && segments.map((seg, i) => {
                        const frac = (Number(seg.value) || 0) / total
                        const dash = frac * circumference
                        const el = (
                            <circle
                                key={i}
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                fill="none"
                                stroke={seg.color}
                                strokeWidth={thickness}
                                strokeDasharray={`${dash} ${circumference - dash}`}
                                strokeDashoffset={-offset}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dasharray 0.6s ease', opacity: 0.95 }}
                            />
                        )
                        offset += dash
                        return el
                    })}
                </g>
                {centerLabel && (
                    <text
                        x={size / 2}
                        y={size / 2 - 8}
                        textAnchor="middle"
                        fontSize="11"
                        fill="hsl(var(--muted-foreground))"
                        fontWeight="600"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                    >
                        {centerLabel}
                    </text>
                )}
                {centerValue && (
                    <text
                        x={size / 2}
                        y={size / 2 + 16}
                        textAnchor="middle"
                        fontSize="18"
                        fontWeight="800"
                        fill="hsl(var(--foreground))"
                    >
                        {centerValue}
                    </text>
                )}
            </svg>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '150px' }}>
                {segments.map((seg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: seg.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))' }}>{seg.label}</span>
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'hsl(var(--foreground))' }}>
                            {Number(seg.value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
