import React, { useState, useEffect } from 'react'
import { Plus, Search, ClipboardList, RefreshCw, AlertTriangle, Truck, Building2, Calendar, User, Eye, Edit2, Trash2, ShoppingBag, ArrowUpRight, TrendingUp, CheckCircle, X, Loader2, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PurchaseModal from '../components/inventory/PurchaseModal'

export default function Purchases() {
    const [purchases, setPurchases] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')
    const [isAdmin, setIsAdmin] = useState(false)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [cashBoxes, setCashBoxes] = useState([])
    const [error, setError] = useState(null)

    // UI state
    const [toast, setToast] = useState(null)

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [toast])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
    }

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [editingPurchase, setEditingPurchase] = useState(null)
    const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState(null)

    // Metrics state
    const [stats, setStats] = useState({
        totalMonth: 0,
        countMonth: 0,
        avgPurchase: 0
    })

    useEffect(() => {
        checkUserRole()
        fetchPurchases()
        fetchSettings()
    }, [])

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            setIsAdmin(data?.role === 'Administrador')
        }
    }

    async function fetchSettings() {
        const { data } = await supabase.from('settings').select('*')
        if (data) {
            const mapped = {}
            data.forEach(item => mapped[item.key] = item.value)
            if (mapped.currency === 'BOL') setCurrencySymbol('Bs.')
            else if (mapped.currency === 'EUR') setCurrencySymbol('€')
            else if (mapped.currency === 'USD') setCurrencySymbol('$')
        }
    }

    async function fetchPurchases() {
        try {
            setLoading(true)
            setError(null)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Get branch assignments
            const { data: assignments } = await supabase
                .from('user_branches')
                .select('branch_id')
                .eq('user_id', user.id)

            const assignedIds = assignments?.map(a => a.branch_id) || []

            // 2. Build query
            let query = supabase
                .from('purchases')
                .select(`
                    *,
                    suppliers:supplier_id (name),
                    branches:branch_id (name),
                    profiles:profiles!fk_purchases_user (full_name)
                `)
                .order('created_at', { ascending: false })

            // Filter by branches if assigned
            if (assignedIds.length > 0) {
                query = query.in('branch_id', assignedIds)
            }

            const { data, error } = await query

            if (error) throw error
            setPurchases(data || [])
            calculateStats(data || [])
        } catch (err) {
            console.error('Error fetching purchases:', err)
            setError('Error al cargar el historial de compras.')
        } finally {
            setLoading(false)
        }
    }

    const calculateStats = (data) => {
        const now = new Date()
        const thisMonth = data.filter(p => {
            const d = new Date(p.created_at)
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })

        const total = thisMonth.reduce((acc, p) => acc + p.total, 0)
        setStats({
            totalMonth: total,
            countMonth: thisMonth.length,
            avgPurchase: thisMonth.length > 0 ? total / thisMonth.length : 0
        })
    }

    const handleEdit = async (purchase, forceReadOnly = false) => {
        try {
            setLoading(true)
            const { data: items, error } = await supabase
                .from('purchase_items')
                .select('*, products(name, sku)')
                .eq('purchase_id', purchase.id)

            if (error) throw error

            const formattedItems = items.map(i => ({
                product_id: i.product_id,
                name: i.products?.name,
                sku: i.products?.sku,
                quantity: i.quantity,
                unit_cost: i.unit_cost,
                total: i.total,
                is_pack: false,
                units_per_pack: 1
            }))

            setEditingPurchase({
                ...purchase,
                items: formattedItems
            })
            setIsReadOnly(forceReadOnly || (!isAdmin && !purchase.can_edit))
            if (purchase.branch_id) {
                await fetchCashBoxes(purchase.branch_id)
            }
            setIsModalOpen(true)
        } catch (err) {
            console.error(err)
            alert('Error al cargar detalles de la compra')
        } finally {
            setLoading(false)
        }
    }

    async function togglePermission(purchaseId, field, currentValue) {
        try {
            const { error } = await supabase
                .from('purchases')
                .update({ [field]: !currentValue })
                .eq('id', purchaseId)

            if (error) throw error

            // Update local state
            setPurchases(prev => prev.map(p => p.id === purchaseId ? { ...p, [field]: !currentValue } : p))
        } catch (err) {
            console.error('Error toggling permission:', err)
            showToast('Error al actualizar permisos', 'error')
        }
    }

    const confirmDelete = async (purchase) => {
        if (!window.confirm('¿Anular esta compra? El stock se revertirá automáticamente.')) return

        try {
            setLoading(true)
            const { error } = await supabase
                .from('purchases')
                .delete()
                .eq('id', purchase.id)

            if (error) throw error
            showToast('Compra eliminada correctamente.')
            fetchPurchases()
        } catch (err) {
            console.error(err)
            showToast('Error: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }
    async function fetchCashBoxes(branchId) {
        if (!branchId) return
        try {
            const { data, error } = await supabase
                .from('cash_boxes')
                .select('*')
                .eq('branch_id', branchId)
                .eq('active', true)
                .order('name')

            if (error) throw error
            setCashBoxes(data || [])
        } catch (err) {
            console.error('Error fetching cash boxes:', err)
        }
    }

    const handleSave = async (purchaseData) => {
        try {
            setIsSaving(true)
            const { items, ...header } = purchaseData
            const { data: { user } } = await supabase.auth.getUser()

            let targetPurchaseId = null

            if (editingPurchase) {
                targetPurchaseId = editingPurchase.id
                // Delete old items
                const { error: delError } = await supabase
                    .from('purchase_items')
                    .delete()
                    .eq('purchase_id', targetPurchaseId)
                if (delError) throw delError

                // Update header
                const { error: upError } = await supabase
                    .from('purchases')
                    .update({
                        supplier_id: header.supplier_id,
                        branch_id: header.branch_id,
                        total: header.total,
                        user_id: user?.id,
                        cash_box_id: header.cash_box_id || null,
                        is_credit: header.is_credit,
                        amount_paid: header.amount_paid,
                        amount_cash: header.amount_cash,
                        amount_qr: header.amount_qr,
                        due_date: header.due_date,
                        payment_status: header.payment_status,
                        payment_method: header.payment_method
                    })
                    .eq('id', targetPurchaseId)
                if (upError) throw upError
            } else {
                const { data: purchase, error: pError } = await supabase
                    .from('purchases')
                    .insert([{
                        supplier_id: header.supplier_id,
                        branch_id: header.branch_id,
                        cash_box_id: header.cash_box_id,
                        total: header.total,
                        user_id: user?.id,
                        is_credit: header.is_credit,
                        amount_paid: header.amount_paid,
                        amount_cash: header.amount_cash,
                        amount_qr: header.amount_qr,
                        due_date: header.due_date,
                        payment_status: header.payment_status,
                        payment_method: header.payment_method
                    }])
                    .select()
                    .single()
                if (pError) throw pError
                targetPurchaseId = purchase.id
            }

            const itemsToSave = items.map(item => ({
                purchase_id: targetPurchaseId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_cost: item.unit_cost,
                total: item.total
            }))

            const { error: itemsError } = await supabase
                .from('purchase_items')
                .insert(itemsToSave)

            if (itemsError) throw itemsError

            setIsModalOpen(false)
            setEditingPurchase(null)
            fetchPurchases()
            showToast(editingPurchase ? 'Compra actualizada correctamente.' : 'Compra registrada con éxito.')
        } catch (err) {
            console.error('Error saving purchase:', err)
            showToast('Error al procesar la compra: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleRecordPayment = async (paymentData) => {
        try {
            setIsSaving(true)
            const { data: { user } } = await supabase.auth.getUser()
            
            // 1. Insert payment record
            const { error: pError } = await supabase
                .from('purchase_payments')
                .insert([{
                    purchase_id: selectedPurchaseForPayment.id,
                    amount: paymentData.amount,
                    amount_cash: paymentData.amount_cash,
                    amount_qr: paymentData.amount_qr,
                    payment_method: paymentData.payment_method,
                    cash_box_id: paymentData.cash_box_id,
                    notes: paymentData.notes,
                    user_id: user?.id
                }])
            
            if (pError) throw pError

            // 2. Update purchase amount_paid and status
            const newAmountPaid = (selectedPurchaseForPayment.amount_paid || 0) + paymentData.amount
            const newStatus = newAmountPaid >= (selectedPurchaseForPayment.total - 0.01) ? 'paid' : 'partial'

            const { error: uError } = await supabase
                .from('purchases')
                .update({ 
                    amount_paid: newAmountPaid,
                    payment_status: newStatus 
                })
                .eq('id', selectedPurchaseForPayment.id)

            if (uError) throw uError

            setIsPaymentModalOpen(false)
            setSelectedPurchaseForPayment(null)
            fetchPurchases()
            showToast('Abono registrado con éxito.')
        } catch (err) {
            console.error('Error recording payment:', err)
            showToast('Error al registrar abono: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const filteredPurchases = purchases.filter(p =>
        (p.suppliers?.name || 'Sin Proveedor').toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.purchase_number?.toString().includes(searchTerm) ||
        p.id.toString().includes(searchTerm)
    )

    return (
        <div style={{ padding: '0.5rem' }}>
            {isModalOpen && (
                <PurchaseModal
                    initialData={editingPurchase}
                    isSaving={isSaving}
                    currencySymbol={currencySymbol}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingPurchase(null)
                    }}
                    onSave={handleSave}
                    readOnly={isReadOnly}
                    onBranchChange={fetchCashBoxes}
                    cashBoxes={cashBoxes}
                />
            )}

            {isPaymentModalOpen && selectedPurchaseForPayment && (
                <PurchasePaymentModal
                    purchase={selectedPurchaseForPayment}
                    isSaving={isSaving}
                    currencySymbol={currencySymbol}
                    cashBoxes={cashBoxes}
                    onClose={() => {
                        setIsPaymentModalOpen(false)
                        setSelectedPurchaseForPayment(null)
                    }}
                    onSave={handleRecordPayment}
                />
            )}

            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Gestión de Compras</h1>
                    <p style={{ color: 'hsl(var(--secondary-foreground) / 0.6)', fontWeight: '500' }}>Abastecimiento de mercadería y control de costos</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        className="btn shadow-sm"
                        onClick={fetchPurchases}
                        disabled={loading}
                        style={{ backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: '12px', padding: '0.75rem' }}
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        className="btn btn-primary shadow-lg shadow-primary/20"
                        onClick={() => { setEditingPurchase(null); setIsModalOpen(true); }}
                        style={{ borderRadius: '12px', padding: '0.75rem 1.5rem', fontWeight: '700', gap: '0.5rem' }}
                    >
                        <Plus size={22} />
                        Nueva Compra
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="card shadow-sm" style={{ padding: '1.5rem', background: 'hsl(var(--primary) / 0.03)', border: '1px solid hsl(var(--primary) / 0.1)', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '10px' }}>
                            <ShoppingBag size={20} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'hsl(142 76% 36%)', backgroundColor: 'hsl(142 76% 36% / 0.1)', padding: '2px 8px', borderRadius: '99px', alignSelf: 'center' }}>
                            Este Mes
                        </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--secondary-foreground) / 0.6)', margin: 0 }}>Total Invertido</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.25rem 0' }}>{currencySymbol}{stats.totalMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                </div>

                <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', borderRadius: '10px' }}>
                            <ClipboardList size={20} />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--secondary-foreground) / 0.6)', margin: 0 }}>Órdenes de Compra</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.25rem 0' }}>{stats.countMonth} <span style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.5 }}>registros</span></h3>
                </div>

                <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', borderRadius: '10px' }}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--secondary-foreground) / 0.6)', margin: 0 }}>Promedio por Compra</p>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '800', margin: '0.25rem 0' }}>{currencySymbol}{stats.avgPurchase.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                </div>
            </div>

            {/* Content Table */}
            <div className="card shadow-sm" style={{ padding: 0, borderRadius: '20px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.6)', display: 'flex', gap: '1rem', backgroundColor: 'hsl(var(--background))' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                        <input
                            type="text"
                            placeholder="Buscar por proveedor, N° orden..."
                            className="bg-secondary/30"
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem 0.75rem 2.8rem',
                                backgroundColor: 'hsl(var(--secondary) / 0.4)',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '0.9rem',
                                outline: 'none'
                             }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'hsl(var(--secondary) / 0.2)' }}>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>No. Orden</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>Proveedor</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>Sucursal / Usuario</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>Fecha</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>Total</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>Estado / Saldo</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && purchases.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '4rem', textAlign: 'center' }}>
                                        <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.4 }} />
                                        <p style={{ marginTop: '1rem', fontWeight: '600', opacity: 0.4 }}>Cargando historial...</p>
                                    </td>
                                </tr>
                            ) : filteredPurchases.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '5rem', textAlign: 'center' }}>
                                        <ShoppingBag size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
                                        <p style={{ fontWeight: '600', fontSize: '1.1rem', opacity: 0.4 }}>No se encontraron compras registradas</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPurchases.map(p => (
                                    <tr
                                        key={p.id}
                                        style={{ borderBottom: '1px solid hsl(var(--border) / 0.4)', transition: 'background-color 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--primary) / 0.02)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontWeight: '700',
                                                color: 'hsl(var(--primary))',
                                                backgroundColor: 'hsl(var(--primary) / 0.08)',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.85rem'
                                            }}>
                                                #{p.purchase_number || p.id?.toString().slice(0, 8)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'hsl(var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Truck size={14} />
                                                </div>
                                                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{p.suppliers?.name || 'Sin Proveedor'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600' }}>
                                                    <Building2 size={14} opacity={0.5} />
                                                    {p.branches?.name || 'Matriz'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', opacity: 0.6 }}>
                                                    <User size={12} />
                                                    {p.profiles?.full_name || 'Sistema'}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                                                <Calendar size={14} opacity={0.5} />
                                                {new Date(p.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <span style={{ fontWeight: '800', fontSize: '1.05rem', color: 'hsl(var(--foreground))' }}>
                                                {currencySymbol}{p.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {p.is_credit ? (
                                                    <>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: '900',
                                                            padding: '2px 8px',
                                                            borderRadius: '99px',
                                                            width: 'fit-content',
                                                            backgroundColor: p.payment_status === 'paid' ? 'hsl(142 76% 36% / 0.1)' : (p.payment_status === 'partial' ? 'hsl(48 96% 53% / 0.1)' : 'hsl(var(--destructive) / 0.1)'),
                                                            color: p.payment_status === 'paid' ? 'hsl(142 76% 36%)' : (p.payment_status === 'partial' ? 'hsl(48 96% 53%)' : 'hsl(var(--destructive))'),
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {p.payment_status === 'paid' ? 'Pagado' : (p.payment_status === 'partial' ? 'Parcial' : 'Pendiente')}
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: '700', opacity: 0.6 }}>
                                                            Saldo: {currencySymbol}{(p.total - p.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                        {p.payment_status !== 'paid' && p.due_date && (
                                                            <span style={{ fontSize: '0.7rem', fontWeight: '500', color: new Date(p.due_date) < new Date() ? 'hsl(var(--destructive))' : 'inherit', opacity: 0.5 }}>
                                                                Vence: {new Date(p.due_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'hsl(var(--primary))', opacity: 0.6 }}>CONTADO</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                                                {/* Admin: Permissions Control */}
                                                {isAdmin && (
                                                    <div style={{ display: 'flex', gap: '0.25rem', marginRight: '0.75rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '4px', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.3)' }}>
                                                        <button
                                                            onClick={() => togglePermission(p.id, 'can_edit', p.can_edit)}
                                                            className="btn-icon"
                                                            title={p.can_edit ? "Bloquear Edición" : "Habilitar Edición"}
                                                            style={{
                                                                padding: '6px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                backgroundColor: p.can_edit ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                                                                color: p.can_edit ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.3)',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => togglePermission(p.id, 'can_void', p.can_void)}
                                                            className="btn-icon"
                                                            title={p.can_void ? "Bloquear Anulación" : "Habilitar Anulación"}
                                                            style={{
                                                                padding: '6px',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                backgroundColor: p.can_void ? 'hsl(var(--destructive) / 0.15)' : 'transparent',
                                                                color: p.can_void ? 'hsl(var(--destructive))' : 'hsl(var(--foreground) / 0.3)',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}

                                                {p.is_credit && p.payment_status !== 'paid' && (
                                                    <button
                                                        onClick={() => { setSelectedPurchaseForPayment(p); fetchCashBoxes(p.branch_id); setIsPaymentModalOpen(true); }}
                                                        className="btn"
                                                        style={{ padding: '0.5rem 0.75rem', borderRadius: '10px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', fontSize: '0.75rem', fontWeight: '800', gap: '4px' }}
                                                        title="Registrar Abono"
                                                    >
                                                        <ArrowUpRight size={14} /> ABONAR
                                                    </button>
                                                )}

                                                {(isAdmin || p.can_edit) ? (
                                                    <button
                                                        onClick={() => handleEdit(p, false)}
                                                        className="btn"
                                                        style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--primary))' }}
                                                        title="Modificar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleEdit(p, true)}
                                                        className="btn"
                                                        style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.4)', color: 'hsl(var(--foreground) / 0.4)' }}
                                                        title="Ver Detalles"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                )}

                                                {(isAdmin || p.can_void) && (
                                                    <button
                                                        onClick={() => confirmDelete(p)}
                                                        className="btn"
                                                        style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}
                                                        title="Anular"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                    color: 'white',
                    padding: '1rem 2rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    zIndex: 1000,
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <CheckCircle size={20} />
                    <span style={{ fontWeight: '600' }}>{toast.message}</span>
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}

function PurchasePaymentModal({ purchase, isSaving, currencySymbol, cashBoxes, onClose, onSave }) {
    const balance = purchase.total - (purchase.amount_paid || 0)
    const [amount, setAmount] = useState(balance)
    const [amountCash, setAmountCash] = useState(balance)
    const [amountQr, setAmountQr] = useState(0)
    const [paymentMethod, setPaymentMethod] = useState('Efectivo')
    const [selectedCashBoxId, setSelectedCashBoxId] = useState('')
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (cashBoxes.length > 0 && !selectedCashBoxId) {
            setSelectedCashBoxId(cashBoxes[0].id)
        }
    }, [cashBoxes])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (amount <= 0) return alert('El monto debe ser mayor a 0.')
        if (amount > balance + 0.01) return alert('El monto no puede superar el saldo pendiente.')
        if (!selectedCashBoxId) return alert('Seleccione una caja para el egreso.')

        onSave({
            amount,
            amount_cash: paymentMethod === 'Mixto' ? amountCash : (paymentMethod === 'Efectivo' ? amount : 0),
            amount_qr: paymentMethod === 'Mixto' ? amountQr : (paymentMethod === 'QR' ? amount : 0),
            payment_method: paymentMethod,
            cash_box_id: selectedCashBoxId,
            notes
        })
    }

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
            <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '500px', padding: 0, borderRadius: '20px', overflow: 'hidden', backgroundColor: 'hsl(var(--background))' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--primary) / 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '10px' }}><ArrowUpRight size={20} /></div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>Registrar Abono</h3>
                            <p style={{ fontSize: '0.75rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Factura #{purchase.purchase_number || purchase.id.toString().slice(0, 8)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.4rem', borderRadius: '50%' }}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: '700', opacity: 0.5, margin: 0 }}>SALDO PENDIENTE</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: 'hsl(var(--destructive))' }}>{currencySymbol}{balance.toFixed(2)}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: '700', opacity: 0.5, margin: 0 }}>TOTAL FACTURA</p>
                            <p style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>{currencySymbol}{purchase.total.toFixed(2)}</p>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', opacity: 0.7 }}>Monto del Abono</label>
                        <input
                            type="number"
                            step="0.01"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '1rem', fontWeight: '800' }}
                            value={amount}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                setAmount(val)
                                if (paymentMethod === 'Mixto') {
                                    setAmountCash(val)
                                    setAmountQr(0)
                                }
                            }}
                            autoFocus
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', opacity: 0.7 }}>Método de Pago</label>
                            <select
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '0.9rem' }}
                                value={paymentMethod}
                                onChange={(e) => {
                                    setPaymentMethod(e.target.value)
                                    if (e.target.value === 'Mixto') {
                                        setAmountCash(amount)
                                        setAmountQr(0)
                                    }
                                }}
                                required
                            >
                                <option value="Efectivo">Efectivo</option>
                                <option value="QR">Transferencia / QR</option>
                                <option value="Mixto">Mixto (Dividido)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', opacity: 0.7 }}>Caja de Egreso</label>
                            <select
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '0.9rem' }}
                                value={selectedCashBoxId}
                                onChange={(e) => setSelectedCashBoxId(e.target.value)}
                                required
                            >
                                <option value="">Seleccionar Caja...</option>
                                {cashBoxes.map(box => <option key={box.id} value={box.id}>{box.name} (Saldo: {currencySymbol}{box.balance?.toFixed(2)})</option>)}
                            </select>
                        </div>
                    </div>

                    {paymentMethod === 'Mixto' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: 'hsl(var(--primary) / 0.05)', borderRadius: '12px', border: '1px solid hsl(var(--primary) / 0.1)' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.6 }}>EFECTIVO</label>
                                <input type="number" style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} value={amountCash} onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    setAmountCash(val)
                                    setAmountQr(Math.max(0, amount - val))
                                }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.6 }}>QR / TRANSF.</label>
                                <input type="number" style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} value={amountQr} onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    setAmountQr(val)
                                    setAmountCash(Math.max(0, amount - val))
                                }} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', opacity: 0.7 }}>Notas (Opcional)</label>
                        <textarea
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '0.9rem', resize: 'none' }}
                            rows="2"
                            placeholder="Detalles sobre el pago..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '1rem', borderRadius: '12px', fontWeight: '800', marginTop: '0.5rem', gap: '0.5rem' }}
                        disabled={isSaving}
                    >
                        {isSaving ? <><Loader2 className="animate-spin" /> PROCESANDO...</> : <><Save /> REGISTRAR ABONO</>}
                    </button>
                </form>
            </div>
        </div>
    )
}
