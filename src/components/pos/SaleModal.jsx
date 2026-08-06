import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, Building2, User, Package, Calculator, Info, ChevronRight, ChevronDown, Box, Printer, ClipboardList, Tag, UserPlus, ArrowRight, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function SaleModal({ onClose, onSave, isSaving, initialData, currencySymbol = 'Bs.', readOnly = false }) {
    const [customers, setCustomers] = useState([])
    const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
    const [selectedCustomer, setSelectedCustomer] = useState(initialData?.customer_id || '')
    const [selectedBranch, setSelectedBranch] = useState(initialData?.branch_id || '')
    const [items, setItems] = useState(initialData?.items || [])
    const [discount, setDiscount] = useState(initialData?.discount || 0)
    const [tax, setTax] = useState(initialData?.tax || 0)
    const [error, setError] = useState(null)
    const [customerSearch, setCustomerSearch] = useState('')
    const [showCustomerSearch, setShowCustomerSearch] = useState(false)
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
    const [newCustomerData, setNewCustomerData] = useState({ name: '', tax_id: '', email: '', phone: '' })

    useEffect(() => {
        async function fetchInitialData() {
            setIsLoadingCustomers(true)
            const [customersRes, branchesRes, productsRes] = await Promise.all([
                supabase.from('customers').select('*').eq('active', true).order('name'),
                supabase.from('branches').select('*').eq('active', true).order('name'),
                supabase.from('products').select('*, settings:product_branch_settings(*)').order('name')
            ])
            setCustomers(customersRes.data || [])
            setIsLoadingCustomers(false)
            setBranches(branchesRes.data || [])
            setProducts(productsRes.data || [])

            if (!initialData && branchesRes.data?.length > 0) {
                setSelectedBranch(branchesRes.data[0].id)
            }
        }
        fetchInitialData()
    }, [initialData])

    const addItem = (product) => {
        const branchSettings = product.settings?.find(s => s.branch_id == selectedBranch)
        const ns = branchSettings?.stock || 0
        const ds = branchSettings?.damaged_stock || 0

        if (ns <= 0 && ds <= 0) {
            alert('Este producto no tiene stock disponible en esta sucursal (ni normal ni merma).')
            return
        }

        const autoDamaged = ns <= 0 && ds > 0
        const initialPrice = autoDamaged ? (product.price * 0.5) : (product.price || 0)

        setItems(prev => {
            const existing = prev.find(i => i.product_id === product.id)
            if (existing) return prev
            return [...prev, {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                quantity: 1,
                price: initialPrice,
                total: initialPrice,
                is_damaged: autoDamaged
            }]
        })
        setShowProductSearch(false)
        setSearchTerm('')
    }
    const [searchTerm, setSearchTerm] = useState('')
    const [onlyMermas, setOnlyMermas] = useState(false)
    const [showProductSearch, setShowProductSearch] = useState(false)

    const removeItem = (productId) => setItems(prev => prev.filter(i => i.product_id !== productId))

    const updateItem = (productId, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                const updated = { ...item }
                if (field === 'is_damaged') {
                    updated.is_damaged = value
                    // If marked as damaged, apply a 50% liquidation discount (optional but helpful)
                    if (value && !initialData) {
                        updated.price = updated.price * 0.5
                    } else if (!value && !initialData) {
                        // Restore original price from products list
                        const originalProd = products.find(p => p.id === productId)
                        updated.price = originalProd ? originalProd.price : updated.price
                    }
                } else {
                    updated[field] = parseFloat(value) || 0
                }
                const productInfo = products.find(p => p.id === productId)
                const branchSettings = productInfo?.settings?.find(s => s.branch_id == selectedBranch)
                const availableStock = updated.is_damaged ? (branchSettings?.damaged_stock || 0) : (branchSettings?.stock || 0)

                if (field === 'quantity' || field === 'is_damaged') {
                    const checkQty = field === 'quantity' ? parseFloat(value) : updated.quantity
                    if (checkQty > availableStock) {
                        alert(`Stock insuficiente. Disponible ${updated.is_damaged ? 'dañado' : 'normal'}: ${availableStock}`)
                        return item // No permitir el cambio
                    }
                }

                updated.total = updated.quantity * updated.price
                return updated
            }
            return item
        }))
    }

    const subtotal = items.reduce((acc, item) => acc + item.total, 0)
    const total = Math.max(0, subtotal + parseFloat(tax || 0) - parseFloat(discount || 0))

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!selectedBranch) return setError('Seleccione una sucursal')
        if (items.length === 0) return setError('Agregue al menos un producto')
        onSave({
            customer_id: selectedCustomer || null,
            branch_id: selectedBranch,
            subtotal,
            tax: parseFloat(tax || 0),
            discount: parseFloat(discount || 0),
            total,
            items: items.map(i => ({
                product_id: i.product_id,
                quantity: i.quantity,
                price: i.price,
                total: i.total,
                is_damaged: !!i.is_damaged
            }))
        })
    }

    const filteredCustomers = customers.filter(c =>
        (c.name?.toLowerCase() || '').includes(customerSearch.toLowerCase()) ||
        (c.tax_id?.toLowerCase() || '').includes(customerSearch.toLowerCase())
    )

    const startCreateCustomer = () => {
        const isNumeric = /^\d+$/.test(customerSearch)
        setNewCustomerData({
            name: !isNumeric ? customerSearch : '',
            tax_id: isNumeric ? customerSearch : '',
            email: '',
            phone: ''
        })
        setIsCreatingCustomer(true)
    }

    const handleCreateCustomer = async () => {
        if (!newCustomerData.name.trim()) return alert('El nombre es obligatorio')
        try {
            const { data, error } = await supabase.from('customers').insert([{
                name: newCustomerData.name,
                tax_id: newCustomerData.tax_id,
                email: newCustomerData.email,
                phone: newCustomerData.phone,
                active: true
            }]).select().single()
            if (error) throw error
            const updated = [...customers, data].sort((a, b) => a.name.localeCompare(b.name))
            setCustomers(updated)
            setSelectedCustomer(data.id)
            setIsCreatingCustomer(false)
            setNewCustomerData({ name: '', tax_id: '', email: '', phone: '' })
            setShowCustomerSearch(false)
        } catch (err) {
            console.error(err)
            alert('Error al crear cliente')
        }
    }

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (p.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())

        if (onlyMermas) {
            const hasDamaged = p.settings?.find(s => s.branch_id == selectedBranch)?.damaged_stock > 0
            return matchesSearch && hasDamaged
        }

        return matchesSearch
    })

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem'
        }}>
            <div className="card shadow-2xl" style={{
                width: '100%',
                maxWidth: '1100px',
                padding: 0,
                borderRadius: '30px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: 'hsl(var(--background))'
            }}>
                {/* Header Section */}
                <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '15px' }}>
                            <ClipboardList size={28} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>{initialData ? 'Detalle de Venta' : 'Nueva Operación'}</h2>
                            <p style={{ fontSize: '0.85rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Gestión de historial y edición de transacciones</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }} disabled={isSaving}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden' }}>
                        {/* Sidebar: Header Info */}
                        <div className="no-scrollbar" style={{ padding: '1.5rem', borderRight: '1px solid hsl(var(--border) / 0.4)', backgroundColor: 'hsl(var(--secondary) / 0.05)', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.75rem' }}>
                                    <User size={14} /> Cliente
                                </label>

                                {readOnly ? (
                                    <div style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.9rem' }}>
                                        {customers.find(c => c.id === selectedCustomer)?.name || 'Cliente General'}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => { setShowCustomerSearch(!showCustomerSearch); setIsCreatingCustomer(false); }}
                                            style={{
                                                flex: 1,
                                                padding: '0.85rem 1rem',
                                                backgroundColor: 'white',
                                                borderRadius: '14px',
                                                border: '1px solid hsl(var(--border) / 0.6)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '0.75rem',
                                                cursor: 'pointer',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <span style={{ fontWeight: '700', fontSize: '0.9rem', color: selectedCustomer ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.4)' }}>
                                                {customers.find(c => c.id === selectedCustomer)?.name || 'Cliente General'}
                                            </span>
                                            <ChevronDown size={18} opacity={0.3} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={startCreateCustomer}
                                            style={{
                                                padding: '0 1rem',
                                                backgroundColor: 'hsl(var(--primary) / 0.1)',
                                                border: '1px solid hsl(var(--primary) / 0.2)',
                                                borderRadius: '14px',
                                                color: 'hsl(var(--primary))',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            <UserPlus size={18} />
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800' }}>NUEVO</span>
                                        </button>
                                    </div>
                                )}

                                {showCustomerSearch && !readOnly && (
                                    <div className="card shadow-2xl" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 120, marginTop: '0.5rem', padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.6)' }}>
                                        {!isCreatingCustomer ? (
                                            <>
                                                <div style={{ padding: '0.75rem', borderBottom: '1px solid hsl(var(--border) / 0.2)', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                                                    <div style={{ position: 'relative' }}>
                                                        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                        <input
                                                            autoFocus
                                                            placeholder="Buscar por nombre o NIT..."
                                                            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', backgroundColor: 'white', borderRadius: '10px', border: '1px solid hsl(var(--primary) / 0.2)', fontSize: '0.85rem', outline: 'none' }}
                                                            value={customerSearch}
                                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                    <button
                                                        type="button"
                                                        className="btn"
                                                        style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem', borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border) / 0.2)' }}
                                                        onClick={() => { setSelectedCustomer(''); setShowCustomerSearch(false); }}
                                                    >
                                                        <User size={16} style={{ marginRight: '0.5rem', opacity: 0.5 }} />
                                                        <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Cliente General / Final</span>
                                                    </button>

                                                    {isLoadingCustomers && (
                                                        <div style={{ padding: '1.25rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
                                                            <RefreshCw size={20} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                                                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700' }}>Buscando clientes...</p>
                                                        </div>
                                                    )}

                                                    {!isLoadingCustomers && customerSearch.trim() !== '' && filteredCustomers.length === 0 && (
                                                        <div style={{ padding: '1.25rem', textAlign: 'center' }}>
                                                            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: '700', opacity: 0.6 }}>
                                                                No se encontró cliente para <b>"{customerSearch}"</b>
                                                            </p>
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary"
                                                                onClick={startCreateCustomer}
                                                                style={{ width: '100%', gap: '0.5rem', padding: '0.6rem', fontSize: '0.85rem', fontWeight: '800' }}
                                                            >
                                                                <UserPlus size={16} /> Crear cliente "{customerSearch}"
                                                            </button>
                                                        </div>
                                                    )}

                                                    {!isLoadingCustomers && filteredCustomers.map(c => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            className="btn"
                                                            style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem', borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border) / 0.2)' }}
                                                            onClick={() => { setSelectedCustomer(c.id); setShowCustomerSearch(false); }}
                                                        >
                                                            <div style={{ textAlign: 'left', flex: 1 }}>
                                                                <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{c.name}</div>
                                                                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>NIT: {c.tax_id || '---'}</div>
                                                            </div>
                                                            <ArrowRight size={14} opacity={0.3} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ padding: '1.25rem', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800' }}>Nuevo Cliente</h4>
                                                    <button onClick={() => setIsCreatingCustomer(false)} className="btn" style={{ padding: '0.3rem', borderRadius: '50%' }}><X size={14} /></button>
                                                </div>
                                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                    <input
                                                        placeholder="Nombre *"
                                                        value={newCustomerData.name}
                                                        onChange={e => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '0.85rem' }}
                                                        autoFocus
                                                    />
                                                    <input
                                                        placeholder="NIT / CI"
                                                        value={newCustomerData.tax_id}
                                                        onChange={e => setNewCustomerData({ ...newCustomerData, tax_id: e.target.value })}
                                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '0.85rem' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary"
                                                        onClick={handleCreateCustomer}
                                                        style={{ padding: '0.6rem', fontWeight: '800', fontSize: '0.85rem' }}
                                                    >
                                                        Guardar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.75rem' }}>
                                    <Building2 size={14} /> Sucursal de Origen
                                </label>
                                <select
                                    disabled={readOnly}
                                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: readOnly ? 'hsl(var(--secondary) / 0.1)' : 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    required
                                >
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.75rem' }}>
                                    <Tag size={14} /> Descuento Aplicado
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={discount}
                                        onChange={(e) => setDiscount(e.target.value)}
                                        disabled={readOnly}
                                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.2rem', backgroundColor: readOnly ? 'hsl(var(--secondary) / 0.1)' : 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', padding: '1.25rem', backgroundColor: 'hsl(var(--primary) / 0.05)', borderRadius: '16px', border: '1px solid hsl(var(--primary) / 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(var(--primary))', marginBottom: '1rem' }}>
                                    <Calculator size={20} />
                                    <span style={{ fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase' }}>Resumen</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.6 }}>
                                    <span>Subtotal</span>
                                    <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.6 }}>
                                    <span>Impuestos (+)</span>
                                    <input
                                        type="number"
                                        value={tax}
                                        onChange={(e) => setTax(e.target.value)}
                                        disabled={readOnly}
                                        style={{ width: '80px', border: 'none', background: 'transparent', textAlign: 'right', fontWeight: '700', outline: 'none', color: readOnly ? 'inherit' : 'hsl(var(--primary))' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'hsl(var(--destructive))', opacity: 0.8 }}>
                                    <span>Descuento (-)</span>
                                    <span>-{currencySymbol}{parseFloat(discount || 0).toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid hsl(var(--border) / 0.2)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                                    <span style={{ fontWeight: '800' }}>TOTAL</span>
                                    <span style={{ fontWeight: '900', fontSize: '1.5rem', color: 'hsl(var(--primary))' }}>{currencySymbol}{total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Main Content: Items List */}
                        <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={20} /> Detalle de Ítems
                                </h3>
                                <div style={{ position: 'relative' }}>
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            className="btn btn-primary shadow-lg shadow-primary/20"
                                            onClick={() => setShowProductSearch(!showProductSearch)}
                                            style={{ gap: '0.5rem', borderRadius: '12px', padding: '0.6rem 1.25rem' }}
                                        >
                                            <Plus size={18} /> AGREGAR PRODUCTO
                                        </button>
                                    )}

                                    {showProductSearch && (
                                        <div className="card shadow-2xl" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.75rem', width: '350px', zIndex: 110, padding: 0, overflow: 'hidden', borderRadius: '18px' }}>
                                            <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Buscar por nombre o SKU..."
                                                        style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.2rem', backgroundColor: 'white', borderRadius: '10px', border: '1px solid hsl(var(--primary) / 0.2)', fontSize: '0.85rem', outline: 'none' }}
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        id="onlyMermas"
                                                        checked={onlyMermas}
                                                        onChange={(e) => setOnlyMermas(e.target.checked)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                    <label htmlFor="onlyMermas" style={{ fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', opacity: 0.7 }}>Solo productos con MERMA</label>
                                                </div>
                                            </div>
                                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                                {filteredProducts.map(p => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        className="btn"
                                                        style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem', borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border) / 0.2)', backgroundColor: 'transparent' }}
                                                        onClick={() => addItem(p)}
                                                    >
                                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                                                                <span>{p.name}</span>
                                                                {p.settings?.find(s => s.branch_id == selectedBranch)?.damaged_stock > 0 && (
                                                                    <span style={{
                                                                        backgroundColor: 'hsl(var(--destructive))',
                                                                        color: 'white',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.6rem',
                                                                        fontWeight: '900',
                                                                        boxShadow: '0 2px 4px hsl(var(--destructive) / 0.3)'
                                                                    }}>
                                                                        CON MERMA: {p.settings.find(s => s.branch_id == selectedBranch).damaged_stock}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                                                                SKU: {p.sku} • Stock: {p.settings?.find(s => s.branch_id == selectedBranch)?.stock || 0}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid hsl(var(--border) / 0.5)', borderRadius: '20px', backgroundColor: 'white' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.2)', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr>
                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Producto</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '80px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Merma</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '110px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Cant.</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '130px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Precio Lta.</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '130px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Subtotal</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '4rem', textAlign: 'center' }}>
                                                    <Box size={48} style={{ margin: '0 auto 1rem', opacity: 0.1 }} />
                                                    <p style={{ fontWeight: '700', opacity: 0.3 }}>Sin ítems en esta venta</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map(item => (
                                                <tr key={item.product_id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ fontWeight: '800', fontSize: '0.9rem', color: item.is_damaged ? 'hsl(var(--destructive))' : 'inherit', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {item.name}
                                                            {item.is_damaged && <span style={{ fontSize: '0.6rem', backgroundColor: 'hsl(var(--destructive))', color: 'white', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>DAÑADO</span>}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>SKU: {item.sku}</div>
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={item.is_damaged}
                                                            disabled={readOnly}
                                                            onChange={(e) => updateItem(item.product_id, 'is_damaged', e.target.checked)}
                                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            disabled={readOnly}
                                                            onChange={(e) => updateItem(item.product_id, 'quantity', e.target.value)}
                                                            style={{ width: '100%', padding: '0.5rem', textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.3)', border: 'none', borderRadius: '8px', fontWeight: '800', outline: 'none' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ position: 'relative' }}>
                                                            <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', fontWeight: '900', opacity: 0.3 }}>{currencySymbol}</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.price}
                                                                disabled={readOnly}
                                                                onChange={(e) => updateItem(item.product_id, 'price', e.target.value)}
                                                                style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.5rem', textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.3)', border: 'none', borderRadius: '8px', fontWeight: '800', outline: 'none' }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '900', color: 'hsl(var(--foreground))' }}>
                                                        {currencySymbol}{item.total.toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        {!readOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(item.product_id)}
                                                                style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)', border: 'none', color: 'hsl(var(--destructive))', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div style={{ padding: '1.5rem 2.5rem', borderTop: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                        {initialData && (
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new CustomEvent('print-ticket', { detail: initialData }))}
                                className="btn"
                                style={{ padding: '0.85rem 1.5rem', borderRadius: '14px', backgroundColor: 'white', fontWeight: '800', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', gap: '0.5rem' }}
                            >
                                <Printer size={20} /> IMPRIMIR TICKET
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="btn" style={{ padding: '0.85rem 2rem', borderRadius: '14px', backgroundColor: 'white', fontWeight: '800' }}>CANCELAR</button>
                        {!readOnly && (
                            <button
                                type="submit"
                                className="btn btn-primary shadow-xl shadow-primary/20"
                                disabled={isSaving}
                                style={{ gap: '0.75rem', padding: '0.85rem 2.5rem', borderRadius: '14px', fontWeight: '800' }}
                            >
                                {isSaving ? <><Loader2 size={22} className="animate-spin" /> PROCESANDO... </> : <><Save size={22} /> {initialData ? 'GUARDAR CAMBIOS' : 'REGISTRAR OPERACIÓN'}</>}
                            </button>
                        )}
                    </div>
                </form>
            </div >
        </div >
    )
}
