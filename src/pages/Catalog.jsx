import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
    Search, ShoppingBag, MapPin, Phone, ChevronRight, Loader2, Package, 
    LayoutGrid, List, Smartphone, Laptop, Tv, Gamepad, Watch, Headphones, 
    Camera, Monitor, Cpu, Star, ArrowRight, ShieldCheck, Truck, Headphones as Support, 
    CreditCard, Percent
} from 'lucide-react'
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
    const [viewMode, setViewMode] = useState('grid')

    useEffect(() => {
        fetchInitialData()
    }, [branchId])

    async function fetchInitialData() {
        setLoading(true)
        try {
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

    const getCategoryIcon = (name) => {
        const n = name.toLowerCase()
        if (n.includes('celular') || n.includes('phone')) return <Smartphone size={18} />
        if (n.includes('compu') || n.includes('laptop')) return <Laptop size={18} />
        if (n.includes('tv') || n.includes('pantalla')) return <Tv size={18} />
        if (n.includes('game') || n.includes('juego')) return <Gamepad size={18} />
        if (n.includes('reloj') || n.includes('watch')) return <Watch size={18} />
        if (n.includes('audio') || n.includes('headphone')) return <Headphones size={18} />
        if (n.includes('camara') || n.includes('camera')) return <Camera size={18} />
        if (n.includes('monitor') || n.includes('display')) return <Monitor size={18} />
        if (n.includes('procesador') || n.includes('cpu')) return <Cpu size={18} />
        return <Package size={18} />
    }

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={48} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 800, color: '#1e293b' }}>Cargando catálogo premium...</p>
                </div>
            </div>
        )
    }

    if (!branchId) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '4rem 1rem' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <span style={{ backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', padding: '0.5rem 1rem', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Experiencia de Compra Premium
                        </span>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 950, marginTop: '1.5rem', marginBottom: '1rem', color: '#1e293b', lineHeight: 1 }}>
                            Nuestras Sucursales
                        </h1>
                        <p style={{ fontSize: '1.1rem', color: '#64748b', maxWidth: '600px', margin: '0 auto' }}>
                            Explora el inventario en tiempo real de cada una de nuestras sedes. Selecciona una sucursal para comenzar tu compra.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        {branches.map(branch => (
                            <div
                                key={branch.id}
                                onClick={() => navigate(`/catalogo/${branch.id}`)}
                                className="branch-card"
                                style={{
                                    backgroundColor: 'white',
                                    padding: '2.5rem',
                                    borderRadius: '32px',
                                    cursor: 'pointer',
                                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    border: '1px solid #f1f5f9',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <div style={{ width: '64px', height: '64px', borderRadius: '20px', backgroundColor: 'hsl(var(--primary) / 0.05)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                                    <MapPin size={32} />
                                </div>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', color: '#1e293b' }}>{branch.name}</h3>
                                <p style={{ fontSize: '0.95rem', color: '#64748b', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MapPin size={16} opacity={0.4} /> {branch.address || 'Ubicación central'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', color: 'hsl(var(--primary))', fontWeight: 800, fontSize: '0.9rem', gap: '0.5rem' }}>
                                        Ir al Catálogo <ArrowRight size={18} />
                                    </span>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} fill="hsl(var(--primary))" color="transparent" />)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'white' }}>
            {/* Main Wrapper */}
            <div style={{ display: 'flex', maxWidth: '1440px', margin: '0 auto' }}>
                
                {/* Fixed Sidebar */}
                <aside style={{
                    width: '280px',
                    height: '100vh',
                    position: 'sticky',
                    top: 0,
                    borderRight: '1px solid #f1f5f9',
                    padding: '2rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white',
                    zIndex: 40
                }}>
                    <div style={{ marginBottom: '2.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{ width: '40px', height: '40px', backgroundColor: '#1e293b', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                <ShoppingBag size={20} />
                            </div>
                            <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#1e293b', letterSpacing: '-0.5px' }}>CASA ORIS</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Categorías</p>
                    </div>

                    <nav style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }} className="no-scrollbar">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '0.875rem 1rem',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: selectedCategory === 'all' ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                                color: selectedCategory === 'all' ? 'hsl(var(--primary))' : '#64748b',
                                fontWeight: selectedCategory === 'all' ? 800 : 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <LayoutGrid size={18} /> Todos los Productos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id.toString())}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.875rem 1rem',
                                    borderRadius: '12px',
                                    border: 'none',
                                    backgroundColor: selectedCategory === cat.id.toString() ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                                    color: selectedCategory === cat.id.toString() ? 'hsl(var(--primary))' : '#64748b',
                                    fontWeight: selectedCategory === cat.id.toString() ? 800 : 600,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {getCategoryIcon(cat.name)} {cat.name}
                                </div>
                                <ChevronRight size={14} opacity={0.3} />
                            </button>
                        ))}
                    </nav>

                    <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid #f1f5f9' }}>
                         <button
                            onClick={() => navigate('/catalogo')}
                            style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#1e293b', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            <MapPin size={16} /> Cambiar Sucursal
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main style={{ flex: 1, padding: '2rem 3rem', backgroundColor: '#fcfcfc' }}>
                    
                    {/* Top Bar with Search */}
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', gap: '2rem' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '600px' }}>
                            <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="¿Qué estás buscando hoy?"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '1rem 1.25rem 1rem 3.5rem',
                                    borderRadius: '20px',
                                    border: '1px solid #f1f5f9',
                                    fontSize: '1rem',
                                    backgroundColor: 'white',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                                    outline: 'none',
                                    transition: 'all 0.3s'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                             <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{currentBranch?.name}</p>
                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>{currentBranch?.address}</p>
                            </div>
                            <button
                                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                                style={{ width: '52px', height: '52px', borderRadius: '16px', border: '1px solid #f1f5f9', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                            >
                                {viewMode === 'grid' ? <List size={22} /> : <LayoutGrid size={22} />}
                            </button>
                        </div>
                    </header>

                    {/* Hero Banner Section */}
                    {selectedCategory === 'all' && !searchTerm && (
                        <section style={{ marginBottom: '3rem' }}>
                            <div style={{
                                width: '100%',
                                height: '360px',
                                borderRadius: '40px',
                                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                                padding: '4rem',
                                display: 'flex',
                                alignItems: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 30px 60px -12px rgba(30, 41, 59, 0.25)'
                            }}>
                                <div style={{ position: 'relative', zIndex: 10, maxWidth: '500px' }}>
                                    <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem 1rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.5rem', display: 'inline-block' }}>
                                        Novedad Exclusiva
                                    </span>
                                    <h2 style={{ fontSize: '3.5rem', color: 'white', fontWeight: 950, margin: '0 0 1rem 0', lineHeight: 1 }}>Transforma tu <br/><span style={{ color: 'hsl(var(--primary))' }}>Espacio Digital</span></h2>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', marginBottom: '2.5rem' }}>Descubre la nueva línea de productos de alta tecnología con descuentos exclusivos por tiempo limitado.</p>
                                    <button style={{ backgroundColor: 'white', color: '#1e293b', border: 'none', padding: '1rem 2rem', borderRadius: '16px', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s' }}>
                                        Comprar Ahora <ArrowRight size={20} />
                                    </button>
                                </div>
                                <div style={{ position: 'absolute', right: '-50px', top: '50%', transform: 'translateY(-50%)', opacity: 0.1, color: 'white' }}>
                                    <ShoppingBag size={500} strokeWidth={0.5} />
                                </div>
                            </div>

                            {/* Trust Banners */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginTop: '2rem' }}>
                                {[
                                    { icon: <Truck size={24}/>, title: 'Envíos Rápidos', sub: 'A todo el país' },
                                    { icon: <Support size={24}/>, title: 'Soporte 24/7', sub: 'Chat en vivo' },
                                    { icon: <ShieldCheck size={24}/>, title: 'Compra Segura', sub: '100% Protegido' },
                                    { icon: <Percent size={24}/>, title: 'Ofertas Diarias', sub: 'Los mejores precios' }
                                ].map((item, i) => (
                                    <div key={i} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                                        <div style={{ color: 'hsl(var(--primary))' }}>{item.icon}</div>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem', color: '#1e293b' }}>{item.title}</p>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>{item.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Products Grid Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 950, color: '#1e293b' }}>
                            {selectedCategory === 'all' ? 'Productos Destacados' : categories.find(c => c.id.toString() === selectedCategory)?.name}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Mostrando {filteredProducts.length} resultados</span>
                        </div>
                    </div>

                    {/* Products Grid */}
                    {filteredProducts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '6rem 0' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto', color: '#cbd5e1' }}>
                                <Package size={40} />
                            </div>
                            <h4 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem' }}>No se encontraron productos</h4>
                            <p style={{ color: '#94a3b8' }}>Prueba ajustando tu búsqueda o filtros de categoría.</p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(260px, 1fr))' : '1fr',
                            gap: '2rem'
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
                                        className="product-card"
                                        style={{
                                            backgroundColor: 'white',
                                            borderRadius: '30px',
                                            overflow: 'hidden',
                                            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
                                            display: viewMode === 'list' ? 'flex' : 'flex',
                                            flexDirection: viewMode === 'list' ? 'row' : 'column',
                                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                            opacity: isOutOfStock ? 0.75 : 1,
                                            position: 'relative',
                                            border: '1px solid #f1f5f9'
                                        }}
                                    >
                                        <div style={{
                                            aspectRatio: '1/1',
                                            width: viewMode === 'list' ? '220px' : 'auto',
                                            backgroundColor: '#f8fafc',
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden'
                                        }}>
                                            {product.image_url ? (
                                                <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }} className="product-image" />
                                            ) : (
                                                <Package size={64} style={{ color: '#cbd5e1' }} />
                                            )}

                                            {hasOffer && !isOutOfStock && (
                                                <div style={{ position: 'absolute', top: '1.25rem', left: '1.25rem', backgroundColor: '#ef4444', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 900, boxShadow: '0 8px 16px rgba(239, 68, 68, 0.25)', zIndex: 10 }}>
                                                    SALE
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>{product.category?.name || 'General'}</p>
                                                <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem', lineHeight: 1.3 }}>{product.name}</h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {[1,2,3,4,5].map(i => <Star key={i} size={12} fill={i <= 4 ? "#fbbf24" : "#e2e8f0"} color="transparent" />)}
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginLeft: '4px' }}>(24 Reseñas)</span>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    {hasOffer && (
                                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'line-through', display: 'block' }}>
                                                            {originalPrice.toFixed(2)} Bs.
                                                        </span>
                                                    )}
                                                    <p style={{ fontSize: '1.5rem', fontWeight: 950, color: hasOffer ? '#ef4444' : '#1e293b', margin: 0, letterSpacing: '-0.5px' }}>
                                                        {finalPrice.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Bs.</span>
                                                    </p>
                                                </div>
                                                <button style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#1e293b', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 8px 16px rgba(30, 41, 59, 0.2)' }}>
                                                    <ShoppingBag size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>

            <style>{`
                .animate-spin { animation: spin 1.5s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                .branch-card:hover {
                    box-shadow: 0 40px 80px -20px rgba(0,0,0,0.1);
                    transform: translateY(-8px);
                }
                
                .product-card:hover {
                    box-shadow: 0 30px 60px -15px rgba(0,0,0,0.12);
                    transform: translateY(-5px);
                }
                
                .product-card:hover .product-image {
                    transform: scale(1.1);
                }
                
                .product-card button:hover {
                    background-color: hsl(var(--primary));
                    transform: scale(1.1);
                }
            `}</style>
        </div>
    )
}
