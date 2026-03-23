import React, { useState } from 'react'
import { X, AlertTriangle, Save, Loader2, Package, ArrowRightLeft } from 'lucide-react'
import { inventoryService } from '../../services/inventoryService'

export default function MermaModal({ product, branchId, onClose, onSave, mode = 'report' }) {
    const [quantity, setQuantity] = useState(1)
    const [notes, setNotes] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (quantity <= 0) return setError('La cantidad debe ser mayor a 0')

        try {
            setIsSaving(true)
            setError(null)

            if (mode === 'report') {
                await inventoryService.reportItemDamage(product.id, branchId, quantity, notes)
            } else {
                await inventoryService.restoreItemDamage(product.id, branchId, quantity, notes)
            }

            onSave()
        } catch (err) {
            console.error('Error in merma action:', err)
            setError('Error al procesar: ' + (err.message || 'Error desconocido'))
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
        }}>
            <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '450px', padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: mode === 'report' ? 'hsl(var(--destructive) / 0.05)' : 'hsl(var(--primary) / 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: mode === 'report' ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--primary) / 0.1)', color: mode === 'report' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', borderRadius: '12px' }}>
                            {mode === 'report' ? <AlertTriangle size={20} /> : <ArrowRightLeft size={20} />}
                        </div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>
                            {mode === 'report' ? 'Reportar Producto Dañado' : 'Restaurar Producto'}
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={20} opacity={0.3} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0 }}>{product.name}</p>
                            <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: 0 }}>SKU: {product.sku}</p>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem' }}>Cantidad</label>
                        <input
                            type="number"
                            min="1"
                            max={mode === 'report' ? product.current_stock : product.current_damaged_stock}
                            step="any"
                            value={quantity}
                            onChange={(e) => setQuantity(parseFloat(e.target.value))}
                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontWeight: '700', outline: 'none' }}
                            required
                        />
                        <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.25rem' }}>
                            {mode === 'report' ? `Disponible en stock normal: ${product.current_stock}` : `Disponible en stock dañado: ${product.current_damaged_stock}`}
                        </p>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem' }}>Notas / Motivo</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={mode === 'report' ? 'Ej: Caja dañada, fecha próxima...' : 'Ej: Reparado, error en reporte...'}
                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontWeight: '500', outline: 'none', minHeight: '80px', resize: 'none' }}
                        />
                    </div>

                    {error && (
                        <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--secondary))' }} disabled={isSaving}>Cancelar</button>
                        <button
                            type="submit"
                            className="btn"
                            style={{ flex: 1, backgroundColor: mode === 'report' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', color: 'white', gap: '0.5rem' }}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {mode === 'report' ? 'Reportar' : 'Restaurar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
