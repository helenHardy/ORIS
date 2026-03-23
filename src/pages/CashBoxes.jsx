import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
    Wallet,
    Plus,
    Search,
    RefreshCw,
    Building2,
    History,
    ArrowUpRight,
    ArrowDownLeft,
    X,
    CheckCircle,
    AlertTriangle,
    Edit2,
    Trash2
} from 'lucide-react'

export default function CashBoxes() {
    const [branches, setBranches] = useState([])
    const [selectedBranchId, setSelectedBranchId] = useState('all')
    const [cashBoxes, setCashBoxes] = useState([])
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal states
    const [isBoxModalOpen, setIsBoxModalOpen] = useState(false)
    const [editingBox, setEditingBox] = useState(null)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [selectedBoxForHistory, setSelectedBoxForHistory] = useState(null)
    const [movements, setMovements] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Form state
    const [boxForm, setBoxForm] = useState({ name: '', branch_id: '', initial_balance: 0 })
    const [toast, setToast] = useState(null)

    useEffect(() => {
        checkUserRole()
        fetchBranches()
    }, [])

    useEffect(() => {
        if (branches.length > 0) {
            fetchCashBoxes()
        }
    }, [selectedBranchId, branches])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            setIsAdmin(data?.role === 'Administrador')
        }
    }

    async function fetchBranches() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            let query = supabase.from('branches').select('*').eq('active', true).order('name')

            if (!isAdmin) {
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                const assignedIds = assignments?.map(a => a.branch_id) || []
                if (assignedIds.length > 0) query = query.in('id', assignedIds)
            }

            const { data } = await query
            setBranches(data || [])
            if (data?.length > 0 && selectedBranchId === 'all') {
                setSelectedBranchId(data[0].id)
            }
        } catch (err) {
            console.error('Error fetching branches:', err)
        }
    }

    async function fetchCashBoxes() {
        try {
            setLoading(true)
            let query = supabase.from('cash_boxes').select(`
                *,
                branch:branches(name)
            `).order('name')

            if (selectedBranchId !== 'all') {
                query = query.eq('branch_id', selectedBranchId)
            }

            const { data, error } = await query
            if (error) throw error
            setCashBoxes(data || [])
        } catch (err) {
            console.error('Error fetching boxes:', err)
            showToast('Error al cargar cajas', 'error')
        } finally {
            setLoading(false)
        }
    }

    async function fetchHistory(box) {
        try {
            setLoadingHistory(true)
            setSelectedBoxForHistory(box)
            setIsHistoryOpen(true)

            const { data, error } = await supabase
                .from('cash_movements')
                .select(`
                    *,
                    user:profiles(full_name)
                `)
                .eq('cash_box_id', box.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            setMovements(data || [])
        } catch (err) {
            console.error('Error fetching history:', err)
            showToast('Error al cargar historial', 'error')
        } finally {
            setLoadingHistory(false)
        }
    }

    const handleSaveBox = async (e) => {
        e.preventDefault()
        try {
            if (editingBox) {
                const { error } = await supabase
                    .from('cash_boxes')
                    .update({ name: boxForm.name, branch_id: boxForm.branch_id })
                    .eq('id', editingBox.id)
                if (error) throw error
                showToast('Caja actualizada')
            } else {
                const { error } = await supabase
                    .from('cash_boxes')
                    .insert([{
                        name: boxForm.name,
                        branch_id: boxForm.branch_id,
                        balance: boxForm.initial_balance
                    }])
                if (error) throw error
                showToast('Caja creada')
            }
            setIsBoxModalOpen(false)
            setEditingBox(null)
            fetchCashBoxes()
        } catch (err) {
            console.error('Error saving box:', err)
            showToast('Error al guardar: ' + err.message, 'error')
        }
    }

    const filteredBoxes = cashBoxes.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.branch?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Cajas</h1>
                    <p style={{ color: 'hsl(var(--secondary-foreground))' }}>Control de efectivo y movimientos bancarios por sucursal</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" onClick={fetchCashBoxes} style={{ backgroundColor: 'hsl(var(--secondary))' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                        setEditingBox(null)
                        setBoxForm({ name: '', branch_id: branches[0]?.id || '', initial_balance: 0 })
                        setIsBoxModalOpen(true)
                    }}>
                        <Plus size={20} style={{ marginRight: '0.5rem' }} />
                        Nueva Caja
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', padding: '1rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        className="btn"
                        style={{ width: '100%', paddingLeft: '2.5rem', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', justifyContent: 'flex-start' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'hsl(var(--secondary))', padding: '0.4rem 0.6rem', borderRadius: '10px' }}>
                    <Building2 size={16} style={{ color: 'hsl(var(--secondary-foreground))', opacity: 0.6 }} />
                    <select
                        style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                        {isAdmin && <option value="all">Todas las Sucursales</option>}
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {filteredBoxes.map(box => (
                    <div key={box.id} className="card shadow-md" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid hsl(var(--border) / 0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}>
                                    <Wallet size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem', margin: 0 }}>{box.name}</h3>
                                    <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>{box.branch?.name}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn-icon" onClick={() => {
                                    setEditingBox(box)
                                    setBoxForm({ name: box.name, branch_id: box.branch_id, initial_balance: box.balance })
                                    setIsBoxModalOpen(true)
                                }}><Edit2 size={16} /></button>
                            </div>
                        </div>

                        <div style={{ padding: '1rem', backgroundColor: 'hsl(var(--secondary) / 0.2)', borderRadius: '12px', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo Actual</p>
                            <p style={{ fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--primary))', margin: 0 }}>
                                <span style={{ fontSize: '1rem', opacity: 0.5, marginRight: '4px' }}>Bs.</span>
                                {box.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ flex: 1, gap: '0.5rem' }} onClick={() => fetchHistory(box)}>
                                <History size={18} />
                                Historial
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Movements Sidebar/Modal */}
            {isHistoryOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(4px)' }}>
                    <div style={{ width: '100%', maxWidth: '500px', backgroundColor: 'hsl(var(--background))', height: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Historial: {selectedBoxForHistory?.name}</h2>
                                <p style={{ opacity: 0.6 }}>Últimos 50 movimientos</p>
                            </div>
                            <button className="btn" onClick={() => setIsHistoryOpen(false)} style={{ borderRadius: '50%', padding: '0.5rem' }}><X size={24} /></button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {loadingHistory ? (
                                <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="animate-spin" size={32} /></div>
                            ) : movements.length === 0 ? (
                                <p style={{ textAlign: 'center', opacity: 0.5, padding: '3rem' }}>No hay movimientos registrados.</p>
                            ) : (
                                movements.map(mov => (
                                    <div key={mov.id} style={{ padding: '1rem', border: '1px solid hsl(var(--border) / 0.5)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{
                                                padding: '0.5rem',
                                                borderRadius: '8px',
                                                backgroundColor: mov.type === 'INGRESO' ? 'hsl(142 76% 36% / 0.1)' : 'hsl(0 84% 60% / 0.1)',
                                                color: mov.type === 'INGRESO' ? 'hsl(142 76% 36%)' : 'hsl(0 84% 60%)'
                                            }}>
                                                {mov.type === 'INGRESO' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 'bold', margin: 0, fontSize: '0.9rem' }}>{mov.description}</p>
                                                <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>{new Date(mov.created_at).toLocaleString()}</p>
                                                <p style={{ fontSize: '0.7rem', opacity: 0.8, margin: 0 }}>Por: {mov.user?.full_name || 'Desconocido'}</p>
                                            </div>
                                        </div>
                                        <p style={{
                                            fontWeight: '900',
                                            color: mov.type === 'INGRESO' ? 'hsl(142 76% 36%)' : 'hsl(0 84% 60%)'
                                        }}>
                                            {mov.type === 'INGRESO' ? '+' : '-'}{mov.amount.toFixed(2)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Box Modal */}
            {isBoxModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <div className="card" style={{ width: '400px', padding: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{editingBox ? 'Editar Caja' : 'Nueva Caja'}</h2>
                        <form onSubmit={handleSaveBox} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Nombre de la Caja</label>
                                <input
                                    className="form-input"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                    value={boxForm.name}
                                    onChange={e => setBoxForm({ ...boxForm, name: e.target.value })}
                                    placeholder="Ej: Caja POS #1"
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Sucursal</label>
                                <select
                                    className="form-input"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                    value={boxForm.branch_id}
                                    onChange={e => setBoxForm({ ...boxForm, branch_id: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccionar Sucursal...</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            {!editingBox && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>Saldo Inicial</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                        value={boxForm.initial_balance}
                                        onChange={e => setBoxForm({ ...boxForm, initial_balance: parseFloat(e.target.value) || 0 })}
                                        placeholder="0.00"
                                    />
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsBoxModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Toast */}
            {toast && (
                <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', backgroundColor: toast.type === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', color: 'white', padding: '1rem 1.5rem', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 400, display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'slideUp 0.3s ease-out' }}>
                    {toast.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    <span style={{ fontWeight: '500' }}>{toast.message}</span>
                </div>
            )}

            <style>{`
                @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    )
}
