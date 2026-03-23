import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, ShoppingBag, MapPin, Phone, ChevronRight, Loader2, Package, LayoutGrid, List } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Catalog() {
    const { branchId } = useParams()
    const navigate = useNavigate()
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [branches, setBranches] = useState([])
    const [currentBranch, setCurrentBranch] = useState(null)
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'

    useEffect(() => {
        fetchInitialData()
    }, [branchId])

    async function fetchInitialData() {
        setLoading(true)
        try {
            // Fetch branches always to show in selector or footer
            const { data: bData } = await supabase.from('branches').select('*').eq('active', true)
            setBranches(bData || [])

            if (branchId) {
                const branch = bData?.find(b => b.id.toString() === branchId)
                setCurrentBranch(branch)
                await fetchBranchProducts(branchId)
            } else {
                setCurrentBranch(null)
                setProducts([])
            }

            const { data: cData } = await supabase.from('categories').select('*').order('name')
            setCategories(cData || [])
        } catch (err) {
            console.error('Error fetching catalog data:', err)
        } finally {
            setLoading(false)
        }
    }

    async function fetchBranchProducts(id) {
        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                category:categories(name),
                brand:brands(name),
                settings:product_branch_settings!inner(*)
            `)
            .eq('settings.branch_id', id)
            .eq('active', true)
            .order('name')

        if (error) console.error('Error fetching products:', error)
        else setProducts(data || [])
    }

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
        const matchesCategory = selectedCategory === 'all' || p.category_id?.toString() === selectedCategory
        return matchesSearch && matchesCategory
    })

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={48} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600, color: '#64748b' }}>Cargando catálogo premium...</p>
                </div>
            </div>
        )
    }

    // Landing Page if no branch selected
    if (!branchId) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem 1rem' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Bienvenido a Nuestro Catálogo
                    </h1>
                    <p style={{ fontSize: '1.125rem', color: '#64748b', marginBottom: '3rem' }}>
                        Selecciona una de nuestras sucursales para ver los productos disponibles cerca de ti.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {branches.map(branch => (
                            <div
                                key={branch.id}
                                onClick={() => navigate(`/catalogo/${branch.id}`)}
                                style={{
                                    backgroundColor: 'white',
                                    padding: '2rem',
                                    borderRadius: '24px',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    border: '1px solid #f1f5f9',
                                    textAlign: 'left'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-5px)'
                                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)'
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)'
                                }}
                            >
                                <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                    <MapPin size={28} />
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#1e293b' }}>{branch.name}</h3>
                                <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1.5rem 0', minHeight: '3rem' }}>{branch.address || 'Ubicación central'}</p>
                                <div style={{ display: 'flex', alignItems: 'center', color: 'hsl(var(--primary))', fontWeight: 700, fontSize: '0.9rem', gap: '0.5rem' }}>
                                    Ver Catálogo <ChevronRight size={18} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            {/* Header Sticky */}
            <header style={{
                position: 'sticky',
                top: 0,
                zIndex: 50,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                padding: '1rem'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#1e293b' }}>{currentBranch?.name}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                                <MapPin size={12} /> {currentBranch?.address || 'Sucursal'}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/catalogo')}
                            style={{ padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Cambiar Sucursal
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Buscar productos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.95rem',
                                    backgroundColor: 'white',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        <button
                            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                            style={{ width: '46px', height: '46px', border: '1px solid #e2e8f0', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', cursor: 'pointer' }}
                        >
                            {viewMode === 'grid' ? <List size={20} /> : <LayoutGrid size={20} />}
                        </button>
                    </div>

                    {/* Categories Chips */}
                    <div className="no-scrollbar" style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                        <button
                            onClick={() => setSelectedCategory('all')}
                            style={{
                                padding: '0.5rem 1.25rem',
                                borderRadius: '100px',
                                border: 'none',
                                backgroundColor: selectedCategory === 'all' ? '#1e293b' : 'white',
                                color: selectedCategory === 'all' ? 'white' : '#64748b',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id.toString())}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '100px',
                                    border: 'none',
                                    backgroundColor: selectedCategory === cat.id.toString() ? '#1e293b' : 'white',
                                    color: selectedCategory === cat.id.toString() ? 'white' : '#64748b',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 5rem 1rem' }}>
                {filteredProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                        <Package size={64} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#64748b' }}>No encontramos productos</h3>
                        <p style={{ fontSize: '0.875rem' }}>Intenta con otro término de búsqueda o categoría.</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(160px, 1fr))' : '1fr',
                        gap: '1rem'
                    }}>
                        {filteredProducts.map(product => {
                            const settings = product.settings?.[0]
                            const isOutOfStock = (settings?.stock || 0) <= 0
                            const originalPrice = settings?.price || product.price
                            const discount = settings?.discount_amount || 0
                            const finalPrice = originalPrice - discount
                            const hasOffer = discount > 0

                            return (
                                <div
                                    key={product.id}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '20px',
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                        display: viewMode === 'list' ? 'flex' : 'block',
                                        transition: 'transform 0.2s',
                                        opacity: isOutOfStock ? 0.7 : 1,
                                        position: 'relative'
                                    }}
                                >
                                    {/* Offer Badge */}
                                    {hasOffer && !isOutOfStock && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '10px',
                                            left: '10px',
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '8px',
                                            fontSize: '0.65rem',
                                            fontWeight: 900,
                                            zIndex: 10,
                                            boxShadow: '0 4px 6px rgba(239, 68, 68, 0.3)'
                                        }}>
                                            OFERTA
                                        </div>
                                    )}

                                    <div style={{
                                        aspectRatio: viewMode === 'grid' ? '1/1' : '1/1',
                                        width: viewMode === 'list' ? '100px' : 'auto',
                                        backgroundColor: '#f1f5f9',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}>
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                                <Package size={viewMode === 'list' ? 32 : 48} />
                                            </div>
                                        )}
                                        {isOutOfStock && (
                                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 800 }}>AGOTADO</span>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{product.category?.name || 'General'}</p>
                                            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#1e293b', lineHeight: 1.2 }}>{product.name}</h3>
                                            {product.brand && <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>{product.brand.name}</p>}
                                        </div>

                                        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>Precio</p>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    {hasOffer && (
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                                                            {originalPrice} Bs.
                                                        </span>
                                                    )}
                                                    <p style={{ fontSize: '1.125rem', fontWeight: 900, color: hasOffer ? '#ef4444' : '#1e293b', margin: 0 }}>
                                                        {finalPrice} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Bs.</span>
                                                    </p>
                                                </div>
                                            </div>
                                            {branchId && (
                                                <div style={{ fontSize: '0.65rem', color: isOutOfStock ? '#ef4444' : '#16a34a', fontWeight: 700 }}>
                                                    {settings?.stock || 0} disp.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {/* Float Contact (Optional) */}
            {currentBranch?.phone && (
                <a
                    href={`https://wa.me/${currentBranch.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        position: 'fixed',
                        bottom: '2rem',
                        right: '1.5rem',
                        backgroundColor: '#25d366',
                        color: 'white',
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 25px -5px rgba(37, 211, 102, 0.4)',
                        zIndex: 100
                    }}
                >
                    <Phone size={28} />
                </a>
            )}

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
            `}</style>
        </div>
    )
}
