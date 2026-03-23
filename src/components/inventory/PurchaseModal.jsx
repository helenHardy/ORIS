import React, { useState, useEffect, useMemo } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, Truck, Building2, Package, ShoppingCart, Info, ChevronRight, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function PurchaseModal({ onClose, onSave, isSaving, initialData, currencySymbol = 'Bs.', readOnly = false, cashBoxes = [], onBranchChange }) {
    const [suppliers, setSuppliers] = useState([])
    const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
    const [selectedSupplier, setSelectedSupplier] = useState(initialData?.supplier_id || '')
    const [selectedBranch, setSelectedBranch] = useState(initialData?.branch_id || '')
    const [selectedCashBoxId, setSelectedCashBoxId] = useState(initialData?.cash_box_id || '')
    const [items, setItems] = useState(initialData?.items || [])
    const [searchTerm, setSearchTerm] = useState('')
    const [showProductSearch, setShowProductSearch] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetchInitialData() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: assignments } = await supabase
                    .from('user_branches')
                    .select('branch_id')
                    .eq('user_id', user.id)

                const assignedIds = assignments?.map(a => a.branch_id) || []

                const [suppliersRes, branchesRes, productsRes] = await Promise.all([
                    supabase.from('suppliers').select('*').order('name'),
                    supabase.from('branches').select('*').eq('active', true).order('name'),
                    supabase.from('products').select(`
                        *,
                        category:categories(name),
                        brand:brands(name),
                        model:models(name),
                        product_branch_settings(stock, branch_id)
                    `).eq('active', true).order('name')
                ])

                setSuppliers(suppliersRes.data || [])
                setProducts(productsRes.data || [])

                let finalBranches = branchesRes.data || []
                if (assignedIds.length > 0) {
                    finalBranches = finalBranches.filter(b => assignedIds.includes(b.id))
                }
                setBranches(finalBranches)

                if (!initialData && finalBranches.length > 0) {
                    setSelectedBranch(finalBranches[0].id)
                    if (onBranchChange) onBranchChange(finalBranches[0].id)
                }
            } catch (err) {
                console.error(err)
            }
        }
        fetchInitialData()
    }, [initialData])

    useEffect(() => {
        if (cashBoxes?.length > 0 && !selectedCashBoxId) {
            setSelectedCashBoxId(cashBoxes[0].id)
        }
    }, [cashBoxes])

    const addItem = (product) => {
        setItems(prev => {
            const existing = prev.find(i => i.product_id === product.id)
            if (existing) return prev
            return [...prev, {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                category_name: product.category?.name,
                brand_name: product.brand?.name,
                model_name: product.model?.name,
                unit_of_measure: product.unit_of_measure,
                quantity: 1,
                unit_cost: product.price || 0,
                total: product.price || 0,
                is_pack: false,
                units_per_pack: 12
            }]
        })
        setShowProductSearch(false)
        setSearchTerm('')
    }

    const removeItem = (productId) => {
        setItems(prev => prev.filter(i => i.product_id !== productId))
    }

    const updateItem = (productId, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                const updated = { ...item }
                if (field === 'is_pack') {
                    updated.is_pack = value
                } else if (field === 'units_per_pack' || field === 'quantity' || field === 'unit_cost') {
                    updated[field] = parseFloat(value) || 0
                }
                updated.total = updated.quantity * updated.unit_cost
                return updated
            }
            return item
        }))
    }

    const total = useMemo(() => items.reduce((acc, item) => acc + item.total, 0), [items])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!selectedBranch) return setError('Seleccione la sucursal de destino.')
        if (!selectedCashBoxId && items.length > 0) return setError('Seleccione una caja para procesar el pago.')
        if (items.length === 0) return setError('Debe agregar al menos un producto a la compra.')

        const processedItems = items.map(item => {
            const finalQuantity = item.is_pack ? (item.quantity * item.units_per_pack) : item.quantity
            const finalUnitCost = item.is_pack ? (item.unit_cost / item.units_per_pack) : item.unit_cost
            return { ...item, quantity: finalQuantity, unit_cost: finalUnitCost }
        })

        onSave({
            supplier_id: selectedSupplier || null,
            branch_id: selectedBranch,
            cash_box_id: selectedCashBoxId || null,
            total,
            items: processedItems
        })
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const sectionTitleStyle = {
        fontSize: '0.875rem', fontWeight: '700', color: 'hsl(var(--primary))',
        display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
        textTransform: 'uppercase', letterSpacing: '0.05em'
    }

    const inputStyle = {
        width: '100%', padding: '0.6rem 0.8rem', borderRadius: '10px',
        border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'hsl(var(--secondary) / 0.2)',
        fontSize: '0.875rem', outline: 'none', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'text'
    }

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '1000px', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden', backgroundColor: 'hsl(var(--background))' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.6rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}><ShoppingCart size={24} /></div>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>{initialData ? 'Modificar Compra' : 'Registrar Compra'}</h2>
                            <p style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Entrada de mercadería al inventario</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }} disabled={isSaving}><X size={20} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                    {error && (
                        <div style={{ padding: '1rem', backgroundColor: 'hsl(var(--destructive) / 0.08)', color: 'hsl(var(--destructive))', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid hsl(var(--destructive) / 0.1)' }}>
                            <AlertCircle size={18} />
                            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', padding: '1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.4)' }}>
                            <div>
                                <h3 style={sectionTitleStyle}><Truck size={18} /> Proveedor</h3>
                                <div style={{ position: 'relative' }}>
                                    <Truck size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                    <select style={{ ...inputStyle, paddingLeft: '2.5rem' }} value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} disabled={readOnly}>
                                        <option value="">(Opcional) Proveedor...</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <h3 style={sectionTitleStyle}><Building2 size={18} /> Sucursal</h3>
                                <div style={{ position: 'relative' }}>
                                    <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                    <select style={{ ...inputStyle, paddingLeft: '2.5rem' }} value={selectedBranch} onChange={(e) => { setSelectedBranch(e.target.value); if (onBranchChange) onBranchChange(e.target.value); }} disabled={readOnly} required>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <h3 style={sectionTitleStyle}><Wallet size={18} /> Caja de Pago</h3>
                                <div style={{ position: 'relative' }}>
                                    <Wallet size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                    <select style={{ ...inputStyle, paddingLeft: '2.5rem' }} value={selectedCashBoxId} onChange={(e) => setSelectedCashBoxId(e.target.value)} disabled={readOnly} required>
                                        <option value="">Seleccionar Caja...</option>
                                        {cashBoxes.map(box => <option key={box.id} value={box.id}>{box.name} (Saldo: {currencySymbol}{box.balance?.toFixed(2)})</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ ...sectionTitleStyle, marginBottom: 0 }}><Package size={18} /> Detalle de Ítems</h3>
                                {!readOnly && (
                                    <button type="button" className="btn btn-primary shadow-sm" onClick={() => setShowProductSearch(!showProductSearch)} style={{ borderRadius: '10px', gap: '0.6rem', padding: '0.6rem 1.2rem', fontWeight: '700' }}><Plus size={18} /> Agregar Producto</button>
                                )}
                                {showProductSearch && (
                                    <div className="card shadow-2xl" style={{ position: 'absolute', right: '2rem', top: '240px', width: '550px', zIndex: 110, padding: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)' }}>
                                        <div style={{ padding: '0.75rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                <input autoFocus type="text" placeholder="Buscar por nombre o SKU..." style={{ ...inputStyle, paddingLeft: '2.4rem' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                            </div>
                                        </div>
                                        <div style={{ maxHeight: '350px', overflowY: 'auto', backgroundColor: 'hsl(var(--background))' }}>
                                            {filteredProducts.length === 0 ? <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}><Search size={32} style={{ margin: '0 auto 1rem', display: 'block' }} /><p style={{ fontSize: '0.9rem', fontWeight: '600' }}>No se encontraron productos</p></div> :
                                                filteredProducts.map(p => (
                                                    <button key={p.id} type="button" className="btn" style={{ width: '100%', justifyContent: 'flex-start', padding: '1rem', border: 'none', borderBottom: '1px solid hsl(var(--border) / 0.3)', borderRadius: 0, display: 'block', textAlign: 'left', backgroundColor: 'transparent' }} onClick={() => addItem(p)}>
                                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'hsl(var(--secondary) / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={20} /></div>
                                                            <div style={{ flex: 1 }}>
                                                                <p style={{ fontWeight: '800', fontSize: '0.9rem', margin: 0 }}>{p.name}</p>
                                                                <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>SKU: {p.sku || '---'}</p>
                                                            </div>
                                                            <ChevronRight size={16} opacity={0.3} />
                                                        </div>
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="card shadow-sm" style={{ padding: 0, overflowX: 'auto', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                                        <tr>
                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Producto</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '120px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Cant.</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '120px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Costo {currencySymbol}</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '120px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Subtotal</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '60px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? <tr><td colSpan="5" style={{ padding: '4rem', textAlign: 'center', opacity: 0.3 }}><p style={{ fontWeight: '700' }}>Sin ítems en la compra</p></td></tr> :
                                            items.map(item => (
                                                <tr key={item.product_id} style={{ borderTop: '1px solid hsl(var(--border) / 0.2)' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <p style={{ fontWeight: '700', fontSize: '0.9rem', margin: 0 }}>{item.name}</p>
                                                        <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>{item.sku}</p>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <input type="number" value={item.quantity} onChange={(e) => updateItem(item.product_id, 'quantity', e.target.value)} disabled={readOnly} style={{ ...inputStyle, textAlign: 'center', backgroundColor: 'white', flex: 1 }} />
                                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, minWidth: '35px' }}>{item.unit_of_measure || 'Unid.'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <input type="number" step="0.01" value={item.unit_cost} onChange={(e) => updateItem(item.product_id, 'unit_cost', e.target.value)} disabled={readOnly} style={{ ...inputStyle, textAlign: 'center', backgroundColor: 'white' }} />
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800' }}>{currencySymbol}{item.total.toFixed(2)}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        {!readOnly && <button type="button" onClick={() => removeItem(item.product_id)} style={{ color: 'hsl(var(--destructive))', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', backgroundColor: 'hsl(var(--primary) / 0.05)', borderRadius: '12px' }}>
                                <Info size={20} color="hsl(var(--primary))" />
                                <p style={{ fontSize: '0.8rem', fontWeight: '500', margin: 0, opacity: 0.7 }}>Se actualizarán stocks y promedios de costos.</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '1rem', fontWeight: '700', opacity: 0.5, margin: 0 }}>Total Compra</p>
                                <h3 style={{ fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--primary))', margin: '0 0 1.5rem 0' }}>{currencySymbol}{total.toFixed(2)}</h3>
                                {!readOnly && (
                                    <button type="submit" className="btn btn-primary" style={{ padding: '1rem 2.5rem', borderRadius: '12px', fontWeight: '800', gap: '0.75rem' }} disabled={isSaving}>
                                        {isSaving ? <><Loader2 className="animate-spin" /> PROCESANDO...</> : <><Save /> {initialData ? 'GUARDAR CAMBIOS' : 'PROCESAR COMPRA'}</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
