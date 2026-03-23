import React, { useState, useEffect } from 'react'
import { X, Save, DollarSign, Wallet, Loader2 } from 'lucide-react'

export default function CustomerPaymentsModal({ customer, onClose, onSave, isSaving, cashBoxes = [] }) {
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState('Efectivo')
    const [selectedCashBoxId, setSelectedCashBoxId] = useState('')
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (cashBoxes.length > 0 && !selectedCashBoxId) {
            setSelectedCashBoxId(cashBoxes[0].id)
        }
    }, [cashBoxes])

    const handleSubmit = (e) => {
        e.preventDefault()
        const paymentAmount = parseFloat(amount)
        if (isNaN(paymentAmount) || paymentAmount <= 0) return alert('Ingrese un monto válido')
        if (!selectedCashBoxId) return alert('Seleccione una caja para el pago')

        onSave({
            customer_id: customer.id,
            amount: paymentAmount,
            payment_method: method,
            cash_box_id: selectedCashBoxId,
            notes: notes
        })
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem'
        }}>
            <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '450px', padding: '2rem', borderRadius: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-0.02em' }}>Registrar Pago</h2>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: 'hsl(var(--primary) / 0.05)', borderRadius: '16px', border: '1px solid hsl(var(--primary) / 0.1)' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '600', color: 'hsl(var(--primary))', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Cliente</p>
                    <p style={{ fontWeight: '800', fontSize: '1.1rem', margin: 0 }}>{customer.name}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid hsl(var(--primary) / 0.1)' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.7 }}>Deuda Actual:</span>
                        <span style={{ color: 'hsl(var(--destructive))', fontWeight: '900', fontSize: '1.1rem' }}>${(customer.current_balance || 0).toFixed(2)}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem', display: 'block' }}>Monto a Pagar</label>
                        <div style={{ position: 'relative' }}>
                            <DollarSign size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input
                                required
                                type="number"
                                step="0.01"
                                className="form-input"
                                style={{ width: '100%', paddingLeft: '2.5rem', fontSize: '1.1rem', fontWeight: '700', height: '3.5rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.3)' }}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem', display: 'block' }}>Método</label>
                            <select
                                className="form-input"
                                style={{ width: '100%', height: '3.5rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '0 1rem', fontWeight: '600' }}
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                            >
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Depósito">Depósito</option>
                                <option value="QR">QR</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem', display: 'block' }}>Caja</label>
                            <div style={{ position: 'relative' }}>
                                <Wallet size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                <select
                                    required
                                    className="form-input"
                                    style={{ width: '100%', height: '3.5rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '0 1rem 0 2.5rem', fontWeight: '600' }}
                                    value={selectedCashBoxId}
                                    onChange={(e) => setSelectedCashBoxId(e.target.value)}
                                >
                                    <option value="">Seleccionar...</option>
                                    {cashBoxes.map(box => (
                                        <option key={box.id} value={box.id}>{box.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem', display: 'block' }}>Notas / Referencia</label>
                        <textarea
                            className="form-input"
                            style={{ width: '100%', minHeight: '80px', padding: '0.75rem 1rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.3)', fontSize: '0.9rem' }}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Pago de factura #123"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary shadow-lg shadow-primary/20"
                        disabled={isSaving}
                        style={{ padding: '1rem', borderRadius: '14px', fontWeight: '800', gap: '0.75rem', marginTop: '0.5rem', fontSize: '1rem' }}
                    >
                        {isSaving ? <><Loader2 size={22} className="animate-spin" /> PROCESANDO...</> : <><Save size={22} /> REGISTRAR PAGO</>}
                    </button>
                </form>
            </div>
        </div>
    )
}
