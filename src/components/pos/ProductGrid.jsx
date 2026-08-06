import React, { memo, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Package, Plus } from 'lucide-react'

const getFirstImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('[') && url.endsWith(']')) {
        try {
            const parsed = JSON.parse(url);
            return Array.isArray(parsed) ? parsed[0] || '' : url;
        } catch {
            return url;
        }
    }
    return url;
};

const ProductCard = memo(function ProductCard({ product, currencySymbol, onAddToCart }) {
    const isAvailable = product.stock > 0 || product.damaged_stock > 0

    return (
        <div
            className="pos-product-card"
            onClick={() => isAvailable && onAddToCart(product)}
        >
            {product.stock <= 0 && product.damaged_stock <= 0 && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}>
                    <div style={{
                        backgroundColor: 'hsl(var(--destructive))',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '12px',
                        fontWeight: '900',
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        Agotado
                    </div>
                </div>
            )}

            {product.damaged_stock > 0 && (
                <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 15,
                    backgroundColor: 'hsl(var(--destructive))',
                    color: 'white',
                    padding: '3px 7px',
                    borderRadius: '7px',
                    fontSize: '0.55rem',
                    fontWeight: '900',
                    boxShadow: '0 4px 12px hsl(var(--destructive) / 0.3)',
                    textTransform: 'uppercase'
                }}>
                    Merma: {product.damaged_stock}
                </div>
            )}
            <div style={{
                height: '110px',
                backgroundColor: 'hsl(var(--secondary) / 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {product.image_url ? (
                    <img src={getFirstImageUrl(product.image_url)} alt={product.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <Package size={40} style={{ opacity: 0.1 }} />
                )}

                <div className="add-indicator" style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'hsl(var(--primary) / 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                }}>
                    <div style={{ backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '0.55rem', borderRadius: '50%', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)' }}>
                        <Plus size={20} />
                    </div>
                </div>
            </div>

            <div style={{ padding: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{
                        fontSize: '0.9rem',
                        fontWeight: '800',
                        marginBottom: '0.15rem',
                        color: 'hsl(var(--foreground))',
                        lineHeight: '1.2',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {product.name}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.55rem', fontWeight: '800', padding: '1px 5px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '4px', textTransform: 'uppercase' }}>
                            {product.brand?.name || 'Sin Marca'}
                        </span>
                    </div>
                    <p style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.05em' }}>
                        SKU: <span style={{ color: 'hsl(var(--foreground))' }}>{product.sku || 'N/A'}</span>
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid hsl(var(--border) / 0.3)', paddingTop: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p style={{
                            color: 'hsl(var(--primary))',
                            fontWeight: '900',
                            fontSize: '1.05rem',
                            margin: 0,
                            letterSpacing: '-0.02em'
                        }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.6, marginRight: '2px' }}>{currencySymbol}</span>
                            {(product.price ?? 0).toFixed(2)}
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            fontSize: '0.65rem',
                            fontWeight: '800',
                            color: (product.stock || 0) > 5 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></div>
                            {product.stock || 0} {product.unit_of_measure || 'Unid.'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})

export default memo(function ProductGrid({ searchTerm, branchId, category, onAddToCart, currencySymbol = 'Bs.', refreshKey, onlyMermas = false }) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 12

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, category, onlyMermas])

    useEffect(() => {
        fetchProducts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, refreshKey])

    async function fetchProducts() {
        if (!branchId) return
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    category:categories(name),
                    subcategory:subcategories(name),
                    brand:brands(name),
                    settings:product_branch_settings!inner(*),
                    tiered_prices:product_tiered_prices(*)
                `)
                .eq('settings.branch_id', branchId)
                .eq('active', true)
                .order('name')

            if (error) throw error

            const mapped = (data || []).map(p => {
                const basePrice = p.settings[0].price || p.price
                const branchTiered = p.tiered_prices || []
                return {
                    ...p,
                    price: basePrice,
                    base_price: basePrice, // Keep original base price
                    stock: p.settings[0].stock,
                    damaged_stock: p.settings[0].damaged_stock || 0,
                    tiered_rules: branchTiered // Store rules for later calculation in POS
                }
            })

            setProducts(mapped)
        } catch (err) {
            console.error('Error fetching products POS:', err)
            setProducts([])
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (p.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        const matchesCategory = category === 'Todos' || p.category?.name === category

        if (onlyMermas) {
            return matchesSearch && matchesCategory && (p.damaged_stock > 0)
        }

        // Hide products with 0 normal stock in POS
        return matchesSearch && matchesCategory && (p.stock > 0)
    })

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredProducts.length, currentPage])

    const visiblePages = (() => {
        const set = new Set([1, 2, totalPages - 1, totalPages, currentPage - 1, currentPage, currentPage + 1])
        const sorted = [...set].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b)
        const out = []
        let prev = 0
        for (const n of sorted) {
            if (n - prev > 1) out.push('…')
            out.push(n)
            prev = n
        }
        return out
    })()

    return (
        <div style={{ position: 'relative', minHeight: '200px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <style>{`
                .product-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 0.85rem;
                    contain: layout style;
                }
                @media (max-width: 900px) {
                    .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                }
                @media (max-width: 640px) {
                    .product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }

                .pos-product-card {
                    padding: 0;
                    overflow: hidden;
                    cursor: pointer;
                    border: 1px solid hsl(var(--border) / 0.6);
                    border-radius: 16px;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    background-color: hsl(var(--background));
                    transition: border-color 0.15s ease, transform 0.15s ease;
                    will-change: transform;
                    contain: content;
                }
                .pos-product-card:hover {
                    border-color: hsl(var(--primary) / 0.4) !important;
                    transform: translateY(-2px);
                }
                .pos-product-card:hover .add-indicator {
                    opacity: 1 !important;
                }
            `}</style>
            {loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--background) / 0.7)', zIndex: 10, borderRadius: '20px' }}>
                    <RefreshCw size={40} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: '700', opacity: 0.5 }}>Cargando catálogo...</p>
                </div>
            )}

            <div style={{ flex: 1 }}>
                {paginatedProducts.length === 0 && !loading ? (
                    <div style={{ padding: '6rem 2rem', textAlign: 'center', color: 'hsl(var(--secondary-foreground))', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary) / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', opacity: 0.5 }}>
                            <Package size={40} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>No hay productos coincidentes</h3>
                        <p style={{ opacity: 0.5, maxWidth: '300px' }}>Intenta con otro término de búsqueda o categoría diferente.</p>
                    </div>
                ) : (
                    <div className="product-grid" style={{
                        paddingBottom: '2rem',
                        opacity: loading ? 0.3 : 1
                    }}>
                        {paginatedProducts.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                currencySymbol={currencySymbol}
                                onAddToCart={onAddToCart}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: 'hsl(var(--secondary) / 0.1)',
                    borderRadius: '16px',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    marginTop: '1rem'
                }}>
                    <button
                        className="btn"
                        onClick={() => {
                            setCurrentPage(prev => Math.max(1, prev - 1))
                        }}
                        disabled={currentPage === 1}
                        style={{
                            padding: '0.55rem 1rem',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            backgroundColor: currentPage === 1 ? 'hsl(var(--secondary) / 0.3)' : 'hsl(var(--secondary) / 0.6)',
                            color: 'hsl(var(--foreground))',
                            border: 'none',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.8)' }}
                        onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.6)' }}
                    >
                        Anterior
                    </button>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', justifyContent: 'center' }}>
                        {visiblePages.map((p, idx) => p === '…' ? (
                            <span key={'ellipsis-' + idx} style={{ padding: '0 0.25rem', fontSize: '0.85rem', fontWeight: '700', opacity: 0.5 }}>…</span>
                        ) : (
                            <button
                                key={idx}
                                onClick={() => {
                                    setCurrentPage(p)
                                }}
                                style={{
                                    minWidth: '34px',
                                    height: '34px',
                                    padding: '0 0.4rem',
                                    borderRadius: '10px',
                                    border: 'none',
                                    backgroundColor: currentPage === p ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.3)',
                                    color: currentPage === p ? 'white' : 'hsl(var(--foreground) / 0.6)',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontSize: '0.85rem'
                                }}
                                onMouseEnter={(e) => { if (currentPage !== p) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.6)' }}
                                onMouseLeave={(e) => { if (currentPage !== p) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.3)' }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <button
                        className="btn"
                        onClick={() => {
                            setCurrentPage(prev => Math.min(totalPages, prev + 1))
                        }}
                        disabled={currentPage === totalPages}
                        style={{
                            padding: '0.55rem 1rem',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            backgroundColor: currentPage === totalPages ? 'hsl(var(--secondary) / 0.3)' : 'hsl(var(--primary))',
                            color: currentPage === totalPages ? 'hsl(var(--foreground) / 0.4)' : 'white',
                            border: 'none',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s',
                            boxShadow: currentPage === totalPages ? 'none' : '0 4px 12px rgb(var(--primary) / 0.3)'
                        }}
                        onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.transform = 'none' }}
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    )
})
