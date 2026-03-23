import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
    TrendingDown,
    Plus,
    Search,
    RefreshCw,
    Building2,
    Calendar,
    Wallet,
    Trash2,
    AlertTriangle,
    CheckCircle,
    X,
    Filter,
    ArrowUpRight,
    HandCoins
} from 'lucide-react'

export default function Expenses() {
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [branches, setBranches] = useState([])
    const [cashBoxes, setCashBoxes] = useState([])
    const [isAdmin, setIsAdmin] = useState(false)
    const [toast, setToast] = useState(null)

    // Filters
    const [selectedBranchId, setSelectedBranchId] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [dateFilter, setDateFilter] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    })

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        branch_id: '',
        cash_box_id: '',
        amount: '',
        category: 'Otros',
        description: ''
    })

    const categories = ['Servicios', 'Alquiler', 'Sueldos', 'Mantenimiento', 'Insumos', 'Otros']

    useEffect(() => {
        checkUserRole()
        fetchBranches()
    }, [])

    useEffect(() => {
        if (branches.length > 0) {
            fetchExpenses()
        }
    }, [selectedBranchId, dateFilter, branches])

    useEffect(() => {
        if (formData.branch_id) {
            fetchCashBoxes(formData.branch_id)
        }
    }, [formData.branch_id])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isAdm = data?.role === 'Administrador'
            setIsAdmin(isAdm)
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

    async function fetchCashBoxes(branchId) {
        try {
            const { data } = await supabase
                .from('cash_boxes')
                .select('*')
                .eq('branch_id', branchId)
                .eq('active', true)
                .order('name')
            setCashBoxes(data || [])
            if (data?.length > 0 && !formData.cash_box_id) {
                setFormData(prev => ({ ...prev, cash_box_id: data[0].id }))
            }
        } catch (err) {
            console.error('Error fetching cash boxes:', err)
        }
    }

    async function fetchExpenses() {
        try {
            setLoading(true)
            let query = supabase
                .from('expenses')
                .select(`
                    *,
                    branches(name),
                    cash_boxes(name),
                    profiles:user_id(full_name)
                `)
                .order('date', { ascending: false })

            if (selectedBranchId !== 'all') {
                query = query.eq('branch_id', selectedBranchId)
            }

            if (dateFilter.start) {
                query = query.gte('date', `${dateFilter.start}T00:00:00`)
            }
            if (dateFilter.end) {
                query = query.lte('date', `${dateFilter.end}T23:59:59`)
            }

            const { data, error } = await query
            if (error) throw error
            setExpenses(data || [])
        } catch (err) {
            console.error('Error fetching expenses:', err)
            showToast('Error al cargar gastos', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        try {
            setIsSaving(true)
            const { data: { user } } = await supabase.auth.getUser()

            const { error } = await supabase.from('expenses').insert([{
                branch_id: parseInt(formData.branch_id),
                cash_box_id: parseInt(formData.cash_box_id),
                amount: parseFloat(formData.amount),
                category: formData.category,
                description: formData.description,
                user_id: user.id
            }])

            if (error) throw error

            showToast('Gasto registrado con éxito')
            setIsModalOpen(false)
            setFormData({
                branch_id: branches[0]?.id || '',
                cash_box_id: '',
                amount: '',
                category: 'Otros',
                description: ''
            })
            fetchExpenses()
        } catch (err) {
            console.error('Error saving expense:', err)
            showToast('Error al guardar: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este registro de gasto? (Nota: Esto NO devolverá el dinero a la caja automáticamente)')) return
        try {
            const { error } = await supabase.from('expenses').delete().eq('id', id)
            if (error) throw error
            showToast('Gasto eliminado')
            fetchExpenses()
        } catch (err) {
            console.error('Error deleting expense:', err)
            showToast('Error al eliminar', 'error')
        }
    }

    const totalPeriod = expenses.reduce((acc, curr) => acc + curr.amount, 0)

    const filteredExpenses = expenses.filter(e =>
        e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.02em', margin: 0 }}>Gastos</h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Control de egresos y gastos operativos por sucursal</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" onClick={fetchExpenses} style={{ padding: '0.75rem', borderRadius: '12px' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        className="btn btn-primary shadow-lg shadow-primary/20"
                        onClick={() => {
                            setFormData(prev => ({ ...prev, branch_id: selectedBranchId !== 'all' ? selectedBranchId : (branches[0]?.id || '') }))
                            setIsModalOpen(true)
                        }}
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: '800', gap: '0.5rem' }}
                    >
                        <Plus size={20} /> NUEVO GASTO
                    </button>
                </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div className="card shadow-sm" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))', color: 'white', border: 'none' }}>
                    <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '16px' }}>
                        <TrendingDown size={32} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', opacity: 0.8, textTransform: 'uppercase' }}>Total en Periodo</p>
                        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900' }}>Bs. {totalPeriod.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ padding: '1rem', backgroundColor: 'hsl(var(--secondary))', borderRadius: '16px', color: 'hsl(var(--primary))' }}>
                        <HandCoins size={32} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase' }}>Registros</p>
                        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900' }}>{expenses.length}</h2>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card shadow-sm" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', borderRadius: '20px' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                    <input
                        type="text"
                        placeholder="Buscar por descripción o categoría..."
                        className="form-input"
                        style={{ width: '100%', paddingLeft: '2.8rem', borderRadius: '12px' }}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Building2 size={18} opacity={0.5} />
                    <select
                        className="form-input"
                        style={{ borderRadius: '12px', minWidth: '180px' }}
                        value={selectedBranchId}
                        onChange={e => setSelectedBranchId(e.target.value)}
                    >
                        {isAdmin && <option value="all">Todas las Sucursales</option>}
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Calendar size={18} opacity={0.5} />
                    <input
                        type="date"
                        className="form-input"
                        style={{ borderRadius: '12px' }}
                        value={dateFilter.start}
                        onChange={e => setDateFilter({ ...dateFilter, start: e.target.value })}
                    />
                    <span>a</span>
                    <input
                        type="date"
                        className="form-input"
                        style={{ borderRadius: '12px' }}
                        value={dateFilter.end}
                        onChange={e => setDateFilter({ ...dateFilter, end: e.target.value })}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="card shadow-sm" style={{ padding: 0, borderRadius: '20px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <tr>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Fecha</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Categoría</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Descripción</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Caja / Sucursal</th>
                            <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Monto</th>
                            <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && expenses.length === 0 ? (
                            <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center' }}><RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto', opacity: 0.2 }} /></td></tr>
                        ) : filteredExpenses.length === 0 ? (
                            <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center', opacity: 0.4 }}>No se encontraron gastos en este periodo.</td></tr>
                        ) : (
                            filteredExpenses.map(exp => (
                                <tr key={exp.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{new Date(exp.date).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>{new Date(exp.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                                            {exp.category.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{exp.description || 'Sin descripción'}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Por: {exp.profiles?.full_name || 'Desconocido'}</div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.85rem' }}>
                                            <Wallet size={14} opacity={0.5} />
                                            {exp.cash_boxes?.name}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.4, marginLeft: '1.4rem' }}>{exp.branches?.name}</div>
                                    </td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right', fontWeight: '900', color: 'hsl(var(--destructive))', fontSize: '1.1rem' }}>
                                        - {exp.amount.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                        <button className="btn-icon" onClick={() => handleDelete(exp.id)} style={{ color: 'hsl(var(--destructive))' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', borderRadius: '12px' }}>
                                    <TrendingDown size={24} />
                                </div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>Registrar Gasto</h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="btn-icon"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.6 }}>Sucursal</label>
                                    <select
                                        className="form-input"
                                        required
                                        value={formData.branch_id}
                                        onChange={e => setFormData({ ...formData, branch_id: e.target.value, cash_box_id: '' })}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.6 }}>Caja de Origen</label>
                                    <select
                                        className="form-input"
                                        required
                                        value={formData.cash_box_id}
                                        onChange={e => setFormData({ ...formData, cash_box_id: e.target.value })}
                                        disabled={!formData.branch_id}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {cashBoxes.map(box => <option key={box.id} value={box.id}>{box.name} (Bs. {box.balance?.toFixed(2)})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.6 }}>Monto (Bs.)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        required
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.6 }}>Categoría</label>
                                    <select
                                        className="form-input"
                                        required
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.6 }}>Descripción / Concepto</label>
                                <textarea
                                    className="form-input"
                                    rows="3"
                                    placeholder="Ej: Pago de luz mes de Marzo"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSaving}>
                                    {isSaving ? <RefreshCw className="animate-spin" size={20} /> : 'REGISTRAR GASTO'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', backgroundColor: toast.type === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', color: 'white', padding: '1rem 1.5rem', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', zIndex: 2000, display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'slideUp 0.3s ease-out' }}>
                    {toast.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    <span style={{ fontWeight: '700' }}>{toast.message}</span>
                </div>
            )}

            <style>{`
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .btn-icon { background: none; border: none; cursor: pointer; padding: 0.5rem; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; opacity: 0.7; }
                .btn-icon:hover { background-color: hsl(var(--secondary)); opacity: 1; }
            `}</style>
        </div>
    )
}
