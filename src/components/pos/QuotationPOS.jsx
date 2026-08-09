import React, { useState, useEffect, useCallback } from 'react'
import { Search, ShoppingCart, Building2, X, Tag, LayoutGrid, RefreshCw, User, Calendar, StickyNote, Calculator, Save, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ProductGrid from './ProductGrid'
import Cart from './Cart'

export default function QuotationPOS({ initialData, isSaving, onClose, onSave, onConvert, convertMode = false, currencySymbol = 'Bs.' }) {
    const [cart, setCart] = useState(initialData?.items || [])
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [branches, setBranches] = useState([])
    const [selectedBranchId, setSelectedBranchId] = useState(initialData?.branch_id || null)
    const [customers, setCustomers] = useState([])
    const [selectedCustomer, setSelectedCustomer] = useState(initialData?.customer_id || '')
    const [validUntil, setValidUntil] = useState(initialData?.valid_until || '')
    const [notes, setNotes] = useState(initialData?.notes || '')
    const [discount, setDiscount] = useState(initialData?.discount || 0)
    const [tax, setTax] = useState(initialData?.tax || 0)
    const [categories, setCategories] = useState(['Todos'])
    const [selectedCategory, setSelectedCategory] = useState('Todos')
    const [onlyMermas, setOnlyMermas] = useState(false)
    const [gridRefreshKey, setGridRefreshKey] = useState(0)
    const [error, setError] = useState(null)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 180)
        return () => clearTimeout(timer)
    }, [searchTerm])

    useEffect(() => {
        if (!initialData?.valid_until) {
            const defaultDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setValidUntil(defaultDate)
        }
    }, [initialData?.valid_until])

    const fetchBranches = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        const isAdmin = profile?.role === 'Administrador'
        let query = supabase.from('branches').select('*').eq('active', true).order('name')
        if (!isAdmin) {
            const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
            const assignedIds = assignments?.map(a => a.branch_id) || []
            if (assignedIds.length > 0) query = query.in('id', assignedIds)
            else return setBranches([])
        }
        const { data } = await query
        if (data && data.length > 0) {
            setBranches(data)
            const defaultId = initialData?.branch_id || data[0].id
            setSelectedBranchId(defaultId)
        }
    }, [initialData?.branch_id])

    const fetchCustomers = useCallback(async () => {
        const { data } = await supabase.from('customers').select('*').eq('active', true).order('name')
        setCustomers(data || [])
    }, [])

    const fetchCategories = useCallback(async () => {
        const { data } = await supabase.from('categories').select('name').order('name')
        if (data) setCategories(['Todos', ...data.map(c => c.name)])
    }, [])

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        fetchBranches()
        fetchCustomers()
        fetchCategories()
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [fetchBranches, fetchCustomers, fetchCategories])

    const getEffectivePrice = useCallback((product, quantity) => {
        const rules = product.tiered_rules || []
        if (rules.length === 0) return product.base_price || product.price

        const applicableRule = rules
            .filter(r => quantity >= r.min_quantity)
            .sort((a, b) => b.min_quantity - a.min_quantity)[0]

        return applicableRule ? applicableRule.price : (product.base_price || product.price)
    }, [])

    const addToCart = useCallback((product) => {
        const ns = product.stock || 0
        const ds = product.damaged_stock || 0

        if (ns <= 0 && ds <= 0) {
            alert(`El producto ${product.name} está agotado por completo.`)
            return
        }

        const autoDamaged = onlyMermas || (ns <= 0 && ds > 0)

        if (autoDamaged && ds <= 0) {
            alert(`No hay stock de merma disponible para el producto ${product.name}.`)
            return
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id && !!item.is_damaged === autoDamaged)
            if (existing) {
                const newQuantity = existing.quantity + 1
                const availableStock = autoDamaged ? ds : ns

                if (newQuantity > availableStock) {
                    alert(`No hay suficiente stock ${autoDamaged ? 'dañado (merma)' : 'normal'} para añadir más de ${product.name}. Stock: ${availableStock}`)
                    return prev
                }
                const effectivePrice = getEffectivePrice(existing, newQuantity)
                return prev.map(item =>
                    (item.id === product.id && !!item.is_damaged === autoDamaged) ? { ...item, quantity: newQuantity, price: effectivePrice } : item
                )
            }
            const basePrice = autoDamaged ? (product.price * 0.5) : product.price
            const effectivePrice = getEffectivePrice({ ...product, price: basePrice }, 1)
            return [...prev, { ...product, quantity: 1, price: effectivePrice, is_damaged: autoDamaged, base_price: product.price }]
        })
    }, [getEffectivePrice, onlyMermas])

    const removeFromCart = useCallback((productId) => setCart(prev => prev.filter(item => item.id !== productId)), [])

    const toggleDamaged = useCallback((productId) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const isNowDamaged = !item.is_damaged
                const availableStock = isNowDamaged ? (item.damaged_stock || 0) : (item.stock || 0)

                if (item.quantity > availableStock) {
                    alert(`No puedes marcar como ${isNowDamaged ? 'dañado' : 'normal'} porque solo hay ${availableStock} unidades disponibles.`)
                    return item
                }

                const baseForPrice = item.base_price || item.price
                const newPrice = isNowDamaged
                    ? getEffectivePrice({ ...item, price: baseForPrice * 0.5 }, item.quantity)
                    : getEffectivePrice({ ...item, price: baseForPrice }, item.quantity)
                return { ...item, is_damaged: isNowDamaged, price: newPrice }
            }
            return item
        }))
    }, [getEffectivePrice])

    const updateQuantity = useCallback((productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQuantity = Math.max(1, item.quantity + delta)
                const availableStock = item.is_damaged ? (item.damaged_stock || 0) : (item.stock || 0)

                if (delta > 0 && newQuantity > availableStock) {
                    alert(`Solo hay ${availableStock} unidades disponibles ${item.is_damaged ? 'dañadas' : ''} de ${item.name}.`)
                    return item
                }
                const effectivePrice = getEffectivePrice(item, newQuantity)
                return { ...item, quantity: newQuantity, price: effectivePrice }
            }
            return item
        }))
    }, [getEffectivePrice])

    const setQuantity = useCallback((productId, newQuantity) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const availableStock = item.is_damaged ? (item.damaged_stock || 0) : (item.stock || 0)
                const qty = Math.max(0, newQuantity)

                if (qty > availableStock) {
                    alert(`Solo hay ${availableStock} unidades disponibles ${item.is_damaged ? 'dañadas' : ''} de ${item.name}.`)
                    return { ...item, quantity: availableStock, price: getEffectivePrice(item, availableStock) }
                }
                return { ...item, quantity: qty, price: getEffectivePrice(item, qty) }
            }
            return item
        }))
    }, [getEffectivePrice])

    const setPrice = useCallback((productId, newPrice) => {
        setCart(prev => prev.map(item =>
            item.id === productId ? { ...item, price: Math.max(0, newPrice) } : item
        ))
    }, [])

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const total = Math.max(0, subtotal + parseFloat(tax || 0) - parseFloat(discount || 0))

    const handleSubmit = () => {
        setError(null)
        if (!selectedBranchId) return setError('Seleccione una sucursal')
        if (cart.length === 0) return setError('Agregue al menos un producto')
        const payload = {
            customer_id: selectedCustomer || null,
            branch_id: selectedBranchId,
            valid_until: validUntil,
            notes,
            discount: parseFloat(discount || 0),
            tax: parseFloat(tax || 0)
        }
        const items = cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            is_damaged: !!item.is_damaged
        }))
        if (convertMode && onConvert) onConvert(payload, items)
        else onSave(payload, items)
    }

    return (
        <div className="no-scrollbar pos-layout" style={{
            display: 'grid',
            gap: '1rem',
            padding: '0.75rem',
            alignItems: 'start'
        }}>
            {/* Catalog Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Header */}
                <div className="card shadow-sm" style={{ padding: '1rem 1.25rem', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid hsl(var(--border) / 0.6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '15px' }}>
                            <ShoppingCart size={24} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.4rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>
                                {initialData
                                    ? (convertMode
                                        ? `Convertir Cotización #${initialData.quotation_number || ''}`
                                        : `Editar Cotización #${initialData.quotation_number || ''}`)
                                    : 'Nueva Cotización'}
                            </h1>
                            <p style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>
                                {convertMode
                                    ? 'Revisa y modifica los productos antes de convertir la cotización en venta'
                                    : 'Selecciona productos del catálogo para armar la cotización'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary) / 0.5)' }} disabled={isSaving}>
                        <X size={22} />
                    </button>
                </div>

                {/* Search / Filters */}
                <div className="card shadow-sm" style={{ padding: '1rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '0.85rem', border: '1px solid hsl(var(--border) / 0.6)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input
                                type="text"
                                placeholder="Buscar productos por nombre, SKU o marca..."
                                style={{ width: '100%', padding: '0.65rem 0.85rem 0.65rem 2.4rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '12px', border: 'none', fontSize: '0.9rem', outline: 'none' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '12px' }}>
                            <input
                                type="checkbox"
                                id="quotationPOSOnlyMermas"
                                checked={onlyMermas}
                                onChange={(e) => setOnlyMermas(e.target.checked)}
                                style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                            />
                            <label htmlFor="quotationPOSOnlyMermas" style={{ fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', color: onlyMermas ? 'hsl(var(--destructive))' : 'inherit' }}>Solo MERMAS</label>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.85rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '12px', gap: '0.6rem' }}>
                            <Building2 size={16} opacity={0.5} />
                            <select
                                style={{ background: 'transparent', border: 'none', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                                value={selectedBranchId || ''}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '2px', backgroundColor: 'hsl(var(--secondary) / 0.4)', padding: '4px', borderRadius: '10px' }}>
                            <button
                                onClick={() => setGridRefreshKey(prev => prev + 1)}
                                className="btn"
                                style={{ padding: '0.4rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.4)' }}
                                title="Actualizar Catálogo"
                            >
                                <RefreshCw size={18} opacity={0.5} />
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingBottom: '0.25rem' }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: '10px',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    backgroundColor: selectedCategory === cat ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                                    color: selectedCategory === cat ? 'white' : 'hsl(var(--foreground))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                {cat === 'Todos' ? <LayoutGrid size={13} /> : <Tag size={13} />}
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="no-scrollbar" style={{ paddingRight: '0.25rem' }}>
                    <ProductGrid
                        searchTerm={debouncedSearch}
                        branchId={selectedBranchId}
                        category={selectedCategory}
                        onAddToCart={addToCart}
                        currencySymbol={currencySymbol}
                        refreshKey={gridRefreshKey}
                        onlyMermas={onlyMermas}
                    />
                </div>
            </div>

            {/* Sidebar Cart - Sticky */}
            <div className="card shadow-md no-scrollbar pos-cart" style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                borderRadius: '24px',
                overflow: 'visible',
                border: '1px solid hsl(var(--border) / 0.6)',
                backgroundColor: 'hsl(var(--background))',
                position: 'sticky',
                top: '1rem',
                alignSelf: 'start'
            }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}><ShoppingCart size={20} /></div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: '800' }}>Cotización</h2>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '4px 10px', borderRadius: '99px' }}>{cart.length} ITEMS</span>
                </div>

                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid hsl(var(--border) / 0.3)', display: 'flex', flexDirection: 'column', gap: '0.6rem', backgroundColor: 'hsl(var(--secondary) / 0.05)' }}>
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem' }}>
                            <User size={12} /> Cliente
                        </label>
                        <select
                            style={{ width: '100%', padding: '0.6rem 0.75rem', backgroundColor: 'white', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.85rem', outline: 'none' }}
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                        >
                            <option value="">Cliente General</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem' }}>
                            <Calendar size={12} /> Válido Hasta
                        </label>
                        <input
                            type="date"
                            value={validUntil}
                            onChange={(e) => setValidUntil(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', backgroundColor: 'white', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.85rem', outline: 'none' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem' }}>
                            <StickyNote size={12} /> Notas
                        </label>
                        <textarea
                            placeholder="Ej: Condiciones especiales..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', backgroundColor: 'white', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '600', fontSize: '0.85rem', outline: 'none', resize: 'none', height: '50px' }}
                        />
                    </div>
                </div>

                <div className="no-scrollbar" style={{ paddingRight: '0.25rem' }}>
                    <Cart
                        items={cart}
                        onRemove={removeFromCart}
                        onUpdateQuantity={updateQuantity}
                        onSetQuantity={setQuantity}
                        onSetPrice={setPrice}
                        onToggleDamaged={toggleDamaged}
                        currencySymbol={currencySymbol}
                    />
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: 'hsl(var(--secondary) / 0.15)', borderTop: '1px solid hsl(var(--border) / 0.4)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', opacity: 0.6, fontWeight: '600' }}>
                            <span className="calc-icon-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Calculator size={13} /> Subtotal
                            </span>
                            <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', opacity: 0.6, fontWeight: '600' }}>
                            <span>Impuestos (+)</span>
                            <input
                                type="number"
                                step="0.01"
                                value={tax}
                                onChange={(e) => setTax(e.target.value)}
                                style={{ width: '90px', padding: '0.3rem 0.5rem', textAlign: 'right', backgroundColor: 'white', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.5)', fontWeight: '700', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', color: 'hsl(var(--destructive))', opacity: 0.8, fontWeight: '600' }}>
                            <span>Descuento (-)</span>
                            <input
                                type="number"
                                step="0.01"
                                value={discount}
                                onChange={(e) => setDiscount(e.target.value)}
                                style={{ width: '90px', padding: '0.3rem 0.5rem', textAlign: 'right', backgroundColor: 'white', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.5)', fontWeight: '700', fontSize: '0.85rem', outline: 'none' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '1.05rem', fontWeight: '700' }}>Total Cotización</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'hsl(var(--primary))', letterSpacing: '-0.02em' }}>{currencySymbol}{total.toFixed(2)}</span>
                        </div>
                    </div>

                    {error && (
                        <div style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', padding: '0.6rem 0.85rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                            {error}
                        </div>
                    )}

                    <button
                        className="btn btn-primary shadow-xl shadow-primary/20"
                        style={{ width: '100%', padding: '1rem', borderRadius: '16px', fontSize: '1.05rem', fontWeight: '800', gap: '0.6rem' }}
                        onClick={handleSubmit}
                        disabled={cart.length === 0 || isSaving}
                    >
                        {isSaving
                            ? <><Loader2 className="animate-spin" /> GUARDANDO...</>
                            : convertMode
                                ? <><ShoppingCart /> GUARDAR Y CONVERTIR A VENTA</>
                                : <><Save /> GUARDAR COTIZACIÓN</>}
                    </button>

                    {convertMode && (
                        <p style={{ textAlign: 'center', marginTop: '0.6rem', fontSize: '0.7rem', opacity: 0.5, fontWeight: '700' }}>
                            Se guardarán los cambios y se abrirá el cobro para convertir en venta.
                        </p>
                    )}

                    <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.7rem', opacity: 0.4, fontWeight: '600' }}>
                        SISTEMA DE COTIZACIONES v2.0
                    </p>
                </div>
            </div>

            <style>{`
                .pos-layout {
                    grid-template-columns: 1fr 420px;
                }

                @media (max-width: 1279px) {
                    .pos-layout {
                        grid-template-columns: 1fr;
                    }
                    .pos-cart {
                        position: static !important;
                        max-height: none !important;
                    }
                }
            `}</style>
        </div>
    )
}