import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, totalItems, onPageChange, disabled, label = 'registros' }) {
    if (!totalItems || totalPages <= 1) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', borderTop: '1px solid hsl(var(--border) / 0.5)', flexWrap: 'wrap' }}>
            <button
                className="btn btn-secondary"
                disabled={page <= 1 || disabled}
                onClick={() => onPageChange(page - 1)}
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
                <ChevronLeft size={16} />
                Anterior
            </button>
            <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>Página {page} de {totalPages} · {totalItems} {label}</span>
            <button
                className="btn btn-secondary"
                disabled={page >= totalPages || disabled}
                onClick={() => onPageChange(page + 1)}
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
                Siguiente
                <ChevronRight size={16} />
            </button>
        </div>
    )
}
