import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Package, AlertTriangle, RefreshCw, Edit2, Trash2, Building2, History, Download, X, CheckCircle, Eye, Tag, Layers, Upload, FilterX, ArrowRight, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { inventoryService } from '../services/inventoryService'
import ProductModal from '../components/inventory/ProductModal'
import KardexDrawer from '../components/inventory/KardexDrawer'
import MermaModal from '../components/inventory/MermaModal'
import ImportModal from '../components/inventory/ImportModal'

export default function Inventory() {
    const [products, setProducts] = useState([])
    const [branches, setBranches] = useState([])
    const [selectedBranchId, setSelectedBranchId] = useState('all')
    const [isAdmin, setIsAdmin] = useState(false)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [categories, setCategories] = useState([])
    const [brands, setBrands] = useState([])
    const [selectedCategoryId, setSelectedCategoryId] = useState('')
    const [subcategories, setSubcategories] = useState([])
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('')
    const [selectedBrandId, setSelectedBrandId] = useState('')
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')
    const [showInactive, setShowInactive] = useState(false)

    // UI state
    const [toast, setToast] = useState(null)
    const [deleteId, setDeleteId] = useState(null)
    const [isForceDelete, setIsForceDelete] = useState(false)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [viewingKardexProduct, setViewingKardexProduct] = useState(null)
    const [mermaProduct, setMermaProduct] = useState(null)
    const [mermaMode, setMermaMode] = useState('report')
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [toast])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
    }

    useEffect(() => {
        checkUserRole()
        fetchBranches()
        fetchSettings()
        fetchFilterOptions()
    }, [])

    async function fetchFilterOptions() {
        try {
            const [cats, subcats, brs] = await Promise.all([
                inventoryService.getCategories(),
                inventoryService.getSubcategories(),
                inventoryService.getBrands()
            ])
            setCategories(cats || [])
            setSubcategories(subcats || [])
            setBrands(brs || [])
        } catch (err) {
            console.error('Error fetching filter options:', err)
        }
    }

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

    useEffect(() => {
        fetchProducts()
    }, [selectedBranchId, showInactive])

    async function fetchBranches() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isUserAdmin = profile?.role === 'Administrador'

            let query = supabase.from('branches').select('*').eq('active', true).order('name')

            if (!isUserAdmin) {
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                const assignedIds = assignments?.map(a => a.branch_id) || []

                if (assignedIds.length > 0) {
                    query = query.in('id', assignedIds)
                } else {
                    setBranches([])
                    return
                }
            }

            const { data } = await query
            setBranches(data || [])

            // Set default selection logic
            if (data && data.length > 0) {
                if (selectedBranchId === 'all' && !isUserAdmin) {
                    setSelectedBranchId(data[0].id)
                } else if (!selectedBranchId || (selectedBranchId !== 'all' && !data.find(b => b.id === selectedBranchId))) {
                    setSelectedBranchId(data[0].id)
                }
            }
        } catch (err) {
            console.error('Error fetching branches:', err)
        }
    }

    const handleExport = () => {
        const headers = ['SKU', 'Nombre', 'Categoría', 'Precio', 'Stock', 'Mínimo']
        const rows = filteredProducts.map(p => [
            p.sku,
            p.name,
            p.category,
            p.current_price,
            p.current_stock,
            p.current_min_stock
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `inventario_${new Date().toLocaleDateString('sv-SE')}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    async function fetchProducts() {
        try {
            setLoading(true)
            setError(null)

            let query = supabase
                .from('products')
                .select(`
                    *,
                    category:categories(name),
                    subcategory:subcategories(name),
                    brand:brands(name),
                    product_branch_settings(*)
                `)

            if (selectedBranchId !== 'all') {
                // Filter by specific branch using the join table
                query = supabase
                    .from('products')
                    .select(`
                        *,
                        category:categories(name),
                        subcategory:subcategories(name),
                        brand:brands(name),
                        settings:product_branch_settings(*)
                    `)
                    .eq('settings.branch_id', selectedBranchId)
            }

            if (!showInactive) {
                query = query.eq('active', true)
            }

            const { data, error } = await query.order('name')

            if (error) throw error

            // Map data to handle easy access to current branch stock/price
            const mappedProducts = data.map(p => {
                if (selectedBranchId === 'all') {
                    return { ...p, current_stock: p.stock, current_price: p.price, current_min_stock: p.min_stock }
                }
                const s = p.settings ? p.settings[0] : null
                return {
                    ...p,
                    current_stock: s ? s.stock : 0,
                    current_damaged_stock: s ? (s.damaged_stock || 0) : 0,
                    current_price: (s && s.price) ? s.price : p.price,
                    current_min_stock: s ? s.min_stock : p.min_stock
                }
            })

            setProducts(mappedProducts || [])
        } catch (err) {
            console.error('Error fetching products:', err)
            setError('Error al cargar los productos.')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (formData) => {
        try {
            setIsSaving(true)
            const { branch_settings, ...productData } = formData

            let productId = editingProduct?.id

            if (editingProduct) {
                // Update product
                const { error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id)
                if (error) throw error
                showToast('Producto actualizado correctamente')
            } else {
                // Create product
                const { data, error } = await supabase
                    .from('products')
                    .insert([productData])
                    .select()
                if (error) throw error
                productId = data[0].id
                showToast('Producto creado correctamente')
            }

            // Save branch settings
            if (branch_settings && branch_settings.length > 0) {
                const settingsToSave = branch_settings.map(s => ({
                    product_id: productId,
                    branch_id: s.branch_id,
                    stock: s.stock,
                    min_stock: s.min_stock,
                    price: s.price || null,
                    discount_amount: s.discount_amount || 0
                }))

                const { error: settingsError } = await supabase
                    .from('product_branch_settings')
                    .upsert(settingsToSave, { onConflict: 'product_id, branch_id' })

                if (settingsError) throw settingsError

                // Save tiered prices
                // First delete existing ones to ensure full sync
                await supabase.from('product_tiered_prices').delete().eq('product_id', productId)

                const tieredToSave = []
                branch_settings.forEach(s => {
                    if (s.tiered_prices && s.tiered_prices.length > 0) {
                        s.tiered_prices.forEach(tier => {
                            tieredToSave.push({
                                product_id: productId,
                                branch_id: s.branch_id,
                                min_quantity: tier.min_quantity,
                                price: tier.price
                            })
                        })
                    }
                })

                if (tieredToSave.length > 0) {
                    const { error: tieredError } = await supabase
                        .from('product_tiered_prices')
                        .insert(tieredToSave)
                    if (tieredError) throw tieredError
                }
            }

            setIsModalOpen(false)
            setEditingProduct(null)
            fetchProducts()
        } catch (err) {
            console.error('Error saving product:', err)
            showToast('Error al guardar: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    async function togglePermission(productId, field, currentValue) {
        try {
            const { error } = await supabase
                .from('products')
                .update({ [field]: !currentValue })
                .eq('id', productId)

            if (error) throw error

            // Update local state
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, [field]: !currentValue } : p))
        } catch (err) {
            console.error('Error toggling permission:', err)
            showToast('Error al actualizar permisos', 'error')
        }
    }

    const confirmDelete = async () => {
        if (!deleteId) return
        try {
            if (isForceDelete) {
                // Total Delete (Hard delete)
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', deleteId)
                if (error) throw error
                showToast('Producto eliminado permanentemente')
            } else {
                // Deactivate (Soft delete)
                const { error } = await supabase
                    .from('products')
                    .update({ active: false })
                    .eq('id', deleteId)
                if (error) throw error
                showToast('Producto desactivado correctamente')
            }
            fetchProducts()
        } catch (err) {
            console.error('Error in product action:', err)
            if (isForceDelete) {
                showToast('No se puede eliminar: tiene historial o dependencias.', 'error')
            } else {
                showToast('Error al desactivar el producto.', 'error')
            }
        } finally {
            setDeleteId(null)
            setIsForceDelete(false)
        }
    }

    async function reactivateProduct(productId) {
        try {
            const { error } = await supabase
                .from('products')
                .update({ active: true })
                .eq('id', productId)
            if (error) throw error
            showToast('Producto reactivado')
            fetchProducts()
        } catch (err) {
            console.error('Error reactivating:', err)
            showToast('Error al reactivar', 'error')
        }
    }

    const filteredProducts = products
        .filter(p =>
            (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (p.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        )
        .filter(p => !selectedCategoryId || String(p.category_id) === String(selectedCategoryId))
        .filter(p => !selectedSubcategoryId || String(p.subcategory_id) === String(selectedSubcategoryId))
        .filter(p => !selectedBrandId || String(p.brand_id) === String(selectedBrandId))

    return (
        <div style={{ position: 'relative', paddingBottom: '2rem' }}>
            {/* Custom Toast */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    {toast.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    <span style={{ fontWeight: '500' }}>{toast.message}</span>
                    <button onClick={() => setToast(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                    <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {deleteId && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 150,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '400px', maxWidth: '90vw', padding: '2rem', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: 'hsl(var(--destructive) / 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <Trash2 size={32} color="hsl(var(--destructive))" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            {isForceDelete ? '¿Eliminar permanentemente?' : '¿Desactivar producto?'}
                        </h3>
                        <p style={{ color: 'hsl(var(--secondary-foreground))', marginBottom: '2rem' }}>
                            {isForceDelete
                                ? 'Esta acción borrará el producto y podría fallar si tiene historial de ventas o compras. No se puede deshacer.'
                                : 'El producto dejará de estar visible en el inventario activo y POS, pero conservará su historial.'}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--secondary))' }} onClick={() => { setDeleteId(null); setIsForceDelete(false); }}>Cancelar</button>
                            <button className="btn" style={{ flex: 1, backgroundColor: isForceDelete ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', color: 'white' }} onClick={confirmDelete}>
                                {isForceDelete ? 'Eliminar Todo' : 'Desactivar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <ProductModal
                    product={editingProduct}
                    isSaving={isSaving}
                    currencySymbol={currencySymbol}
                    readOnly={isReadOnly}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingProduct(null)
                        setIsReadOnly(false)
                    }}
                    onSave={handleSave}
                />
            )}

            {viewingKardexProduct && (
                <KardexDrawer
                    product={viewingKardexProduct}
                    onClose={() => setViewingKardexProduct(null)}
                />
            )}

            {mermaProduct && (
                <MermaModal
                    product={mermaProduct}
                    branchId={selectedBranchId === 'all' ? branches[0]?.id : selectedBranchId}
                    mode={mermaMode}
                    onClose={() => setMermaProduct(null)}
                    onSave={() => {
                        setMermaProduct(null)
                        fetchProducts()
                        showToast(mermaMode === 'report' ? 'Merma reportada correctamente' : 'Producto restaurado')
                    }}
                />
            )}

            {isImportModalOpen && (
                <ImportModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    branchId={selectedBranchId === 'all' ? (branches[0]?.id || 1) : selectedBranchId}
                    onImportSuccess={(msg) => {
                        showToast(msg)
                        fetchProducts()
                        fetchFilterOptions()
                    }}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', padding: '0.5rem', borderRadius: '12px' }}>
                            <Package size={28} />
                        </div>
                        <h1 style={{ fontSize: '2.25rem', fontWeight: '800', letterSpacing: '-0.025em', margin: 0 }}>Inventario</h1>
                    </div>
                    <p style={{ color: 'hsl(var(--secondary-foreground))', opacity: 0.7, fontSize: '1rem', marginLeft: '3.5rem' }}>
                        Control centralizado de productos, existencias y movimientos.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '0.35rem', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)' }}>
                        <button
                            className="btn"
                            onClick={handleExport}
                            style={{ backgroundColor: 'transparent', gap: '0.5rem', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            title="Exportar a CSV"
                        >
                            <Download size={18} />
                            Exportar
                        </button>
                        <div style={{ width: '1px', backgroundColor: 'hsl(var(--border) / 0.5)', margin: '0.5rem 0' }} />
                        <button
                            className="btn"
                            onClick={() => setIsImportModalOpen(true)}
                            style={{ backgroundColor: 'transparent', gap: '0.5rem', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            title="Importar desde Excel/CSV"
                        >
                            <Upload size={18} />
                            Importar
                        </button>
                    </div>
                    
                    <button
                        className="btn"
                        onClick={fetchProducts}
                        disabled={loading}
                        style={{ backgroundColor: 'hsl(var(--secondary) / 0.8)', padding: '0.5rem', borderRadius: '12px' }}
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    
                    <button 
                        className="btn btn-primary" 
                        onClick={() => setIsModalOpen(true)}
                        style={{ 
                            gap: '0.5rem', 
                            padding: '0.75rem 1.5rem', 
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px hsl(var(--primary) / 0.25)',
                            fontWeight: '600'
                        }}
                    >
                        <Plus size={20} />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem', 
                marginBottom: '2rem',
                backgroundColor: 'hsl(var(--card))',
                padding: '1.5rem',
                borderRadius: '20px',
                border: '1px solid hsl(var(--border) / 0.6)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
                {/* Search Bar Row */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))', opacity: 0.5 }} />
                        <input
                            type="text"
                            placeholder="Buscar productos por nombre, SKU o código de barras..."
                            style={{
                                width: '100%',
                                padding: '0.875rem 1rem 0.875rem 3.25rem',
                                backgroundColor: 'hsl(var(--secondary) / 0.4)',
                                border: '1px solid hsl(var(--border) / 0.5)',
                                borderRadius: '14px',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s',
                                color: 'hsl(var(--foreground))'
                            }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={(e) => e.target.style.borderColor = 'hsl(var(--primary) / 0.5)'}
                            onBlur={(e) => e.target.style.borderColor = 'hsl(var(--border) / 0.5)'}
                        />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'hsl(var(--secondary) / 0.6)', padding: '0.5rem 1rem', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.4)' }}>
                        <Building2 size={18} style={{ color: 'hsl(var(--primary))', opacity: 0.7 }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase' }}>Sucursal</span>
                            <select
                                disabled={branches.length <= 1 && !isAdmin}
                                style={{ 
                                    backgroundColor: 'transparent', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    fontSize: '0.9rem', 
                                    fontWeight: '600',
                                    padding: 0,
                                    outline: 'none'
                                }}
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                            >
                                {isAdmin && <option value="all">Todas las Sucursales</option>}
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Filter size={16} style={{ opacity: 0.5 }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'hsl(var(--secondary-foreground))', opacity: 0.7 }}>Filtrar por:</span>
                    </div>

                    {/* Classification Group */}
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '0.35rem', borderRadius: '12px' }}>
                        <select
                            style={{ 
                                backgroundColor: selectedCategoryId ? 'hsl(var(--primary) / 0.1)' : 'transparent', 
                                border: 'none', 
                                cursor: 'pointer', 
                                fontSize: '0.85rem', 
                                fontWeight: '500',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                color: selectedCategoryId ? 'hsl(var(--primary))' : 'inherit'
                            }}
                            value={selectedCategoryId}
                            onChange={(e) => {
                                setSelectedCategoryId(e.target.value)
                                setSelectedSubcategoryId('')
                            }}
                        >
                            <option value="">Categoría: Todas</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        <select
                            style={{ 
                                backgroundColor: selectedSubcategoryId ? 'hsl(var(--primary) / 0.1)' : 'transparent', 
                                border: 'none', 
                                cursor: 'pointer', 
                                fontSize: '0.85rem', 
                                fontWeight: '500',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                color: selectedSubcategoryId ? 'hsl(var(--primary))' : 'inherit'
                            }}
                            value={selectedSubcategoryId}
                            onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                            disabled={!selectedCategoryId}
                        >
                            <option value="">Subcategoría: Todas</option>
                            {(selectedCategoryId ? subcategories.filter(s => String(s.category_id) === String(selectedCategoryId)) : subcategories).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Brand Group */}
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '0.35rem', borderRadius: '12px' }}>
                        <select
                            style={{ 
                                backgroundColor: selectedBrandId ? 'hsl(var(--accent) / 0.1)' : 'transparent', 
                                border: 'none', 
                                cursor: 'pointer', 
                                fontSize: '0.85rem', 
                                fontWeight: '500',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                color: selectedBrandId ? 'hsl(var(--accent))' : 'inherit'
                            }}
                            value={selectedBrandId}
                            onChange={(e) => setSelectedBrandId(e.target.value)}
                        >
                            <option value="">Marca: Todas</option>
                            {brands.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ flex: 1 }} />

                    <button
                        className="btn"
                        style={{ 
                            backgroundColor: showInactive ? 'hsl(var(--destructive) / 0.1)' : 'hsl(var(--secondary) / 0.5)', 
                            padding: '0.5rem 1rem', 
                            borderRadius: '10px', 
                            color: showInactive ? 'hsl(var(--destructive))' : 'inherit',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            gap: '0.5rem',
                            border: '1px solid hsl(var(--border) / 0.4)'
                        }}
                        onClick={() => setShowInactive(!showInactive)}
                    >
                        {showInactive ? <Eye size={16} /> : <X size={16} style={{ opacity: 0.5 }} />}
                        {showInactive ? "Mostrando Inactivos" : "Ocultar Inactivos"}
                    </button>

                    {(searchTerm || selectedCategoryId || selectedBrandId || showInactive) && (
                        <button
                            className="btn"
                            style={{ 
                                backgroundColor: 'hsl(var(--foreground) / 0.05)', 
                                padding: '0.5rem 1rem', 
                                borderRadius: '10px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                gap: '0.5rem',
                                color: 'hsl(var(--secondary-foreground))'
                            }}
                            onClick={() => {
                                setSelectedCategoryId('')
                                setSelectedSubcategoryId('')
                                setSelectedBrandId('')
                                setSearchTerm('')
                                setShowInactive(false)
                                if (isAdmin) setSelectedBranchId('all')
                            }}
                        >
                            <FilterX size={16} />
                            Limpiar Filtros
                        </button>
                    )}
                </div>
            </div>


            {
                error && (
                    <div className="card" style={{ marginBottom: '2rem', borderColor: 'hsl(var(--destructive))', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <AlertTriangle size={20} />
                            <p>{error}</p>
                        </div>
                    </div>
                )
            }

            <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: '200px' }}>
                {loading && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'hsl(var(--background) / 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                    }}>
                        <RefreshCw size={32} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                    </div>
                )}

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', opacity: loading ? 0.5 : 1 }}>
                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.5)', borderBottom: '1px solid hsl(var(--border))' }}>
                        <tr>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Imagen</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Producto</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Atributos</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Stock</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Dañados</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Precio</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Estado</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.length === 0 && !loading ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--secondary-foreground))' }}>
                                    <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                    <p>No se encontraron productos.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map(product => (
                                <tr
                                    key={product.id}
                                    style={{
                                        borderBottom: '1px solid hsl(var(--border) / 0.5)',
                                        transition: 'background-color 0.2s',
                                        opacity: product.active === false ? 0.6 : 1,
                                        backgroundColor: product.active === false ? 'hsl(var(--secondary) / 0.1)' : 'transparent'
                                    }}
                                    onMouseEnter={(e) => { if (product.active !== false) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.2)' }}
                                    onMouseLeave={(e) => { if (product.active !== false) e.currentTarget.style.backgroundColor = 'transparent' }}
                                >
                                    <td style={{ padding: '1.25rem 1rem' }}>
                                        <div style={{
                                            width: '64px',
                                            height: '64px',
                                            backgroundColor: 'hsl(var(--secondary) / 0.3)',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid hsl(var(--border) / 0.4)',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                            position: 'relative',
                                            transition: 'transform 0.2s'
                                        }} className="product-image-container">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <Package size={24} style={{ opacity: 0.15 }} />
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <p style={{ fontWeight: '700', fontSize: '1rem', margin: 0, color: 'hsl(var(--foreground))', letterSpacing: '-0.01em' }}>{product.name || 'Sin nombre'}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.75rem', backgroundColor: 'hsl(var(--secondary) / 0.8)', padding: '2px 6px', borderRadius: '6px', color: 'hsl(var(--secondary-foreground))', opacity: 0.7, fontWeight: '600' }}>
                                                    {product.sku || 'N/A'}
                                                </span>
                                                {product.barcode && (
                                                    <span style={{ fontSize: '0.7rem', color: 'hsl(var(--secondary-foreground))', opacity: 0.5 }}>• {product.barcode}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                backgroundColor: 'hsl(var(--primary) / 0.08)', 
                                                color: 'hsl(var(--primary))',
                                                borderRadius: '8px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: '700' 
                                            }}>
                                                {product.category?.name || 'Gral'}
                                            </span>
                                            {product.brand?.name && (
                                                <span style={{ 
                                                    padding: '4px 10px', 
                                                    backgroundColor: 'hsl(var(--accent) / 0.08)', 
                                                    color: 'hsl(var(--accent))',
                                                    borderRadius: '8px', 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: '700' 
                                                }}>
                                                    {product.brand.name}
                                                </span>
                                            )}
                                            {product.unit_of_measure && product.unit_of_measure !== 'Unidad' && (
                                                <span style={{ padding: '4px 8px', backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '600', opacity: 0.8 }}>
                                                    {product.unit_of_measure}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span style={{ 
                                                    fontSize: '1.125rem', 
                                                    fontWeight: '800',
                                                    color: (product.current_stock ?? 0) <= (product.current_min_stock ?? 0) ? 'hsl(var(--destructive))' : 'inherit'
                                                }}>
                                                    {product.current_stock ?? 0}
                                                </span>
                                                {(product.current_stock ?? 0) <= (product.current_min_stock ?? 0) && (
                                                    <AlertTriangle size={16} color="hsl(var(--destructive))" />
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: '700', textTransform: 'uppercase' }}>{product.unit_of_measure || 'Unid.'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1rem' }}>
                                        {product.current_damaged_stock > 0 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ 
                                                    backgroundColor: 'hsl(var(--destructive) / 0.1)', 
                                                    color: 'hsl(var(--destructive))',
                                                    padding: '4px 8px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '700',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem'
                                                }}>
                                                    <AlertTriangle size={14} />
                                                    {product.current_damaged_stock}
                                                </div>
                                                {selectedBranchId !== 'all' && (
                                                    <button
                                                        onClick={() => { setMermaProduct(product); setMermaMode('restore'); }}
                                                        style={{ 
                                                            backgroundColor: 'hsl(var(--secondary))',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            padding: '4px',
                                                            cursor: 'pointer',
                                                            display: 'flex'
                                                        }}
                                                        title="Restaurar a stock normal"
                                                    >
                                                        <RefreshCw size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.875rem', opacity: 0.3 }}>0</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1.25rem 1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '1.125rem', fontWeight: '800', color: 'hsl(var(--primary))', fontFamily: 'monospace' }}>
                                                {currencySymbol}{(product.current_price ?? 0).toFixed(2)}
                                            </span>
                                            {product.discount_amount > 0 && (
                                                <span style={{ fontSize: '0.7rem', color: 'hsl(142 76% 36%)', fontWeight: '700' }}>
                                                    Desc. {currencySymbol}{product.discount_amount}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 1rem' }}>
                                        <span style={{
                                            padding: '6px 12px',
                                            borderRadius: '10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.025em',
                                            backgroundColor: product.active === false ? 'hsl(var(--secondary))' : ((product.current_stock ?? 0) > (product.current_min_stock ?? 0) ? 'hsl(142 76% 36% / 0.1)' : 'hsl(0 84% 60% / 0.1)'),
                                            color: product.active === false ? 'hsl(var(--secondary-foreground) / 0.6)' : ((product.current_stock ?? 0) > (product.current_min_stock ?? 0) ? 'hsl(142 76% 36%)' : 'hsl(0 84% 60%)'),
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}>
                                            {product.active === false && <Info size={12} />}
                                            {product.active === false ? 'Inactivo' : ((product.current_stock ?? 0) > (product.current_min_stock ?? 0) ? 'En Stock' : 'Stock Bajo')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            {/* Admin: Permissions Control */}
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: '0.25rem', marginRight: '0.75rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '4px', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.3)' }}>
                                                    <button
                                                        onClick={() => togglePermission(product.id, 'can_edit', product.can_edit)}
                                                        className="btn-icon"
                                                        title={product.can_edit ? "Bloquear Edición" : "Habilitar Edición"}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            backgroundColor: product.can_edit ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                                                            color: product.can_edit ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.3)',
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
                                                        onClick={() => togglePermission(product.id, 'can_delete', product.can_delete)}
                                                        className="btn-icon"
                                                        title={product.can_delete ? "Bloquear Eliminación" : "Habilitar Eliminación"}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            backgroundColor: product.can_delete ? 'hsl(var(--destructive) / 0.15)' : 'transparent',
                                                            color: product.can_delete ? 'hsl(var(--destructive))' : 'hsl(var(--foreground) / 0.3)',
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

                                            <button
                                                className="btn"
                                                style={{ padding: '0.5rem', color: 'hsl(var(--primary))' }}
                                                onClick={() => setViewingKardexProduct(product)}
                                                title="Ver historial de movimientos"
                                            >
                                                <History size={16} />
                                            </button>

                                            {selectedBranchId !== 'all' && (
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.5rem', color: 'hsl(var(--destructive))' }}
                                                    onClick={() => {
                                                        setMermaProduct(product)
                                                        setMermaMode('report')
                                                    }}
                                                    title="Reportar Daño (Merma)"
                                                >
                                                    <AlertTriangle size={16} />
                                                </button>
                                            )}

                                            {(isAdmin || product.can_edit) ? (
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.5rem', color: 'hsl(var(--primary))' }}
                                                    onClick={() => {
                                                        setEditingProduct(product)
                                                        setIsReadOnly(false)
                                                        setIsModalOpen(true)
                                                    }}
                                                    title="Modificar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.5rem', color: 'hsl(var(--secondary-foreground) / 0.5)' }}
                                                    onClick={() => {
                                                        setEditingProduct(product)
                                                        setIsReadOnly(true)
                                                        setIsModalOpen(true)
                                                    }}
                                                    title="Ver Detalles"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            )}

                                            {product.active === false ? (
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.5rem', color: 'hsl(var(--primary))' }}
                                                    onClick={() => reactivateProduct(product.id)}
                                                    title="Reactivar Producto"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            ) : (
                                                isAdmin || product.can_delete ? (
                                                    <button
                                                        className="btn"
                                                        style={{ padding: '0.5rem', color: 'hsl(var(--primary) / 0.7)' }}
                                                        onClick={() => {
                                                            setDeleteId(product.id)
                                                            setIsForceDelete(false)
                                                        }}
                                                        title="Desactivar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : null
                                            )}

                                            {isAdmin && (
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.5rem', color: 'hsl(var(--destructive))' }}
                                                    onClick={() => {
                                                        setDeleteId(product.id)
                                                        setIsForceDelete(true)
                                                    }}
                                                    title="Eliminar Permanente"
                                                >
                                                    <X size={16} />
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
        </div >
    )
}
