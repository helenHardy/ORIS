import React, { useState, useEffect } from 'react'
import {
    TrendingUp, Users, Package, DollarSign, RefreshCw, Clock, ShoppingCart,
    FileText, ArrowUpRight, ArrowDownRight, ArrowRight, Building2, Banknote, QrCode, CreditCard, Wallet
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import SalesChart from '../components/dashboard/SalesChart'
import DonutChart from '../components/dashboard/DonutChart'
import { useNavigate } from 'react-router-dom'

const fmt = (n) => 'Bs ' + Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })
const fmtM = (n) => Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })
const fmtInt = (n) => Number(n || 0).toLocaleString('es-BO', { maximumFractionDigits: 0 })

const formatDate = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

const StatCard = ({ title, value, subtitle, icon, trend, trendDown, loading, colorClass, gradient }) => (
    <div className="card" style={{
        position: 'relative', overflow: 'hidden',
        border: '1px solid hsl(var(--border) / 0.6)',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)'
    }}>
        <div style={{
            position: 'absolute', top: 0, right: 0, width: '130px', height: '130px',
            background: gradient, opacity: 0.1, borderRadius: '0 0 0 100%', pointerEvents: 'none'
        }} />
        {loading && (
            <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}>
                <RefreshCw size={16} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
            </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                    padding: '0.75rem', borderRadius: '12px',
                    backgroundColor: `hsl(var(--${colorClass}) / 0.1)`, color: `hsl(var(--${colorClass}))`,
                    display: 'inline-flex'
                }}>
                    {icon}
                </div>
                {trend !== undefined && trend !== null && (
                    <div style={{
                        fontSize: '0.75rem', fontWeight: '700', padding: '0.25rem 0.55rem', borderRadius: '99px',
                        backgroundColor: trendDown ? 'hsl(0 72% 51% / 0.1)' : 'hsl(142 76% 36% / 0.1)',
                        color: trendDown ? 'hsl(0 72% 51%)' : 'hsl(142 76% 36%)',
                        display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}>
                        {trendDown ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                        {trend}
                    </div>
                )}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{title}</p>
                <h3 style={{ fontSize: '1.9rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'hsl(var(--foreground))' }}>{loading ? '...' : value}</h3>
                {subtitle && <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.1rem' }}>{subtitle}</p>}
            </div>
        </div>
    </div>
)

const QuickAction = ({ icon, label, onClick, color = 'primary' }) => (
    <button onClick={onClick} className="card hover-scale" style={{
        padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.75rem', border: '1px solid hsl(var(--border) / 0.6)',
        cursor: 'pointer', transition: 'all 0.2s', backgroundColor: 'white', textAlign: 'center'
    }}>
        <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: `hsl(var(--${color}) / 0.1)`, color: `hsl(var(--${color}))` }}>
            {icon}
        </div>
        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'hsl(var(--foreground))' }}>{label}</span>
    </button>
)

const CARD = { borderRadius: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }
const METHOD_COLORS = {
    Efectivo: 'hsl(142 76% 36%)',
    QR: 'hsl(262 83% 58%)',
    Crédito: 'hsl(35 92% 50%)'
}

export default function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState({
        todaySales: 0, todayProfit: 0, todayCount: 0, todayCash: 0, todayQr: 0, todayCredit: 0,
        totalSales: 0, clientsCount: 0, lowStock: 0, weekTotal: 0, cashQr: 0, cashEf: 0
    })
    const [recentSales, setRecentSales] = useState([])
    const [weekSales, setWeekSales] = useState([])
    const [cashBoxes, setCashBoxes] = useState([])
    const [loading, setLoading] = useState(true)
    const [branches, setBranches] = useState([])
    const [selectedBranchId, setSelectedBranchId] = useState('all')
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => { fetchBranches() }, [])
    useEffect(() => { if (selectedBranchId) fetchDashboardData() }, [selectedBranchId])

    async function fetchBranches() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isUserAdmin = profile?.role === 'Administrador'
            setIsAdmin(isUserAdmin)
            let query = supabase.from('branches').select('*').eq('active', true).order('name')
            if (!isUserAdmin) {
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                const assignedIds = assignments?.map(a => a.branch_id) || []
                if (assignedIds.length > 0) query = query.in('id', assignedIds)
                else { setBranches([]); return }
            }
            const { data } = await query
            setBranches(data || [])
            if (data && data.length > 0) {
                if (selectedBranchId === 'all' && !isUserAdmin) setSelectedBranchId(data[0].id)
                else if (!selectedBranchId || (selectedBranchId !== 'all' && !data.find(b => b.id === selectedBranchId))) setSelectedBranchId(data[0].id)
            }
        } catch (err) { console.error('Error fetching branches:', err) }
    }

    async function fetchDashboardData() {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
            const isAdmin = profile?.role === 'Administrador'
            let assignedBranchIds = []
            if (!isAdmin) {
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                assignedBranchIds = assignments?.map(a => a.branch_id) || []
            }

            const branchParam = selectedBranchId === 'all' ? null : selectedBranchId
            const block = selectedBranchId === 'all' && !isAdmin && assignedBranchIds.length === 0

            const applyBranchFilter = (query, col = 'branch_id') => {
                if (block) return query.eq(col, -1)
                if (selectedBranchId !== 'all') return query.eq(col, selectedBranchId)
                if (!isAdmin && assignedBranchIds.length > 0) return query.in(col, assignedBranchIds)
                return query
            }

            // 1. Today summary (RPC)
            const { data: sum } = await supabase.rpc('get_dashboard_summary', { p_branch_id: branchParam })
            const s = sum && sum[0] ? sum[0] : {}

            // 2. Last 7 days chart (RPC)
            const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 6)
            const { data: weekRaw } = await supabase.rpc('get_sales_report', {
                p_start_date: formatDate(start), p_end_date: formatDate(end), p_branch_id: branchParam
            })
            const weekMap = {}
            ;(weekRaw || []).forEach(r => { weekMap[r.report_date] = r })
            const days = []
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i)
                const ds = formatDate(d)
                const day = weekMap[ds] || {}
                days.push({
                    date: ds,
                    label: d.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3),
                    total: Number(day.total_sales || 0),
                    profit: Number(day.total_profit || 0)
                })
            }

            // 3. Cash boxes balances
            let cbQuery = supabase.from('cash_boxes').select('id, name, balance, branch_id')
            if (block) cbQuery = cbQuery.eq('branch_id', -1)
            else if (selectedBranchId !== 'all') cbQuery = cbQuery.eq('branch_id', selectedBranchId)
            else if (!isAdmin && assignedBranchIds.length > 0) cbQuery = cbQuery.in('branch_id', assignedBranchIds)
            const { data: boxes } = await cbQuery

            // 4. All-time total sales
            let salesQuery = supabase.from('sales').select('total, branch_id')
            salesQuery = applyBranchFilter(salesQuery)
            const { data: salesData } = await salesQuery
            const total = salesData?.reduce((a, c) => a + Number(c.total), 0) || 0

            // 5. Clients (global)
            const { count: clientsCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })

            // 6. Low stock
            let lowStockCount = 0
            if (block) lowStockCount = 0
            else if (selectedBranchId !== 'all') {
                const { data: branchStock } = await supabase.from('product_branch_settings').select('stock, min_stock').eq('branch_id', selectedBranchId)
                lowStockCount = branchStock?.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length || 0
            } else if (isAdmin) {
                const { data: lowStockData } = await supabase.from('products').select('id, stock, min_stock')
                lowStockCount = lowStockData?.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length || 0
            } else if (assignedBranchIds.length > 0) {
                const { data: branchStock } = await supabase.from('product_branch_settings').select('stock, min_stock').in('branch_id', assignedBranchIds)
                lowStockCount = branchStock?.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length || 0
            }

            // 7. Recent activity
            let recentQuery = supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(5)
            recentQuery = applyBranchFilter(recentQuery)
            const { data: recent } = await recentQuery

            const cashEf = (boxes || []).filter(b => /efectivo/i.test(b.name)).reduce((a, b) => a + Number(b.balance || 0), 0)
            const cashQr = (boxes || []).filter(b => /qr/i.test(b.name)).reduce((a, b) => a + Number(b.balance || 0), 0)

            setStats({
                todaySales: Number(s.today_sales || 0),
                todayProfit: Number(s.today_profit || 0),
                todayCount: Number(s.today_count || 0),
                todayCash: Number(s.today_cash || 0),
                todayQr: Number(s.today_qr || 0),
                todayCredit: Number(s.today_credit || 0),
                totalSales: total,
                clientsCount: clientsCount || 0,
                lowStock: lowStockCount,
                weekTotal: days.reduce((a, d) => a + d.total, 0),
                cashQr,
                cashEf
            })
            setWeekSales(days)
            setCashBoxes(boxes || [])
            setRecentSales(recent || [])
        } catch (err) { console.error('Error fetching dashboard:', err) }
        finally { setLoading(false) }
    }

    const yesterday = weekSales.length >= 2 ? weekSales[weekSales.length - 2].total : 0
    const todayTotal = stats.todaySales
    let trend = null, trendDown = false
    if (yesterday > 0) {
        const pct = Math.round(((todayTotal - yesterday) / yesterday) * 100)
        trend = `${pct > 0 ? '+' : ''}${pct}% vs ayer`
        trendDown = pct < 0
    }

    const paymentSegments = [
        { label: 'Efectivo', value: stats.todayCash, color: METHOD_COLORS.Efectivo },
        { label: 'QR', value: stats.todayQr, color: METHOD_COLORS.QR },
        { label: 'Crédito', value: stats.todayCredit, color: METHOD_COLORS.Crédito }
    ].filter(s => Number(s.value) > 0)

    const bestDay = weekSales.reduce((a, b) => (b.total > a.total ? b : a), weekSales[0] || { total: 0 })

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.03em', color: 'hsl(var(--foreground))' }}>Dashboard General</h1>
                    <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '1rem', marginTop: '0.25rem' }}>
                        Resumen del día {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', padding: '0 0.5rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', height: '42px' }}>
                        <Building2 size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
                        <select disabled={branches.length <= 1 && !isAdmin} style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: '600', fontSize: '0.9rem', padding: '0.5rem 0', minWidth: '150px' }} value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)}>
                            {isAdmin && <option value="all">Todas las Sucursales</option>}
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <button className="btn" onClick={fetchDashboardData} disabled={loading} style={{ backgroundColor: 'white', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '0.6rem 1rem', fontWeight: '600', height: '42px' }}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} style={{ marginRight: '0.5rem' }} /> Sincronizar
                    </button>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Acciones Rápidas</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                    <QuickAction icon={<ShoppingCart size={24} />} label="Nueva Venta" onClick={() => navigate('/pos')} color="primary" />
                    <QuickAction icon={<Package size={24} />} label="Inventario" onClick={() => navigate('/inventory')} color="secondary" />
                    <QuickAction icon={<Users size={24} />} label="Clientes" onClick={() => navigate('/customers')} color="secondary" />
                    <QuickAction icon={<FileText size={24} />} label="Reportes" onClick={() => navigate('/reports')} color="secondary" />
                </div>
            </div>

            {/* ===== HOY: KPI Cards ===== */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <StatCard title="Ventas de Hoy" value={fmt(stats.todaySales)}
                    icon={<DollarSign size={24} />} loading={loading} colorClass="primary" trend={trend} trendDown={trendDown}
                    gradient="radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" subtitle={`${stats.todayCount} transacciones`} />
                <StatCard title="Ganancia de Hoy" value={fmt(stats.todayProfit)}
                    icon={<TrendingUp size={24} />} loading={loading} colorClass="secondary-foreground"
                    gradient="radial-gradient(circle, hsl(142 76% 36%) 0%, transparent 70%)"
                    subtitle={stats.todaySales > 0 ? `Margen ${((stats.todayProfit / stats.todaySales) * 100).toFixed(1)}%` : 'Sin ventas registradas'} />
                <StatCard title="Efectivo Hoy" value={fmt(stats.todayCash)}
                    icon={<Banknote size={24} />} loading={loading} colorClass="primary"
                    gradient="radial-gradient(circle, hsl(142 76% 36%) 0%, transparent 70%)" subtitle="Pagado en caja" />
                <StatCard title="QR Hoy" value={fmt(stats.todayQr)}
                    icon={<QrCode size={24} />} loading={loading} colorClass="secondary-foreground"
                    gradient="radial-gradient(circle, hsl(262 83% 58%) 0%, transparent 70%)" subtitle="Pagado por código QR" />
                <StatCard title="Crédito Hoy" value={fmt(stats.todayCredit)}
                    icon={<CreditCard size={24} />} loading={loading} colorClass="secondary"
                    gradient="radial-gradient(circle, hsl(35 92% 50%) 0%, transparent 70%)" subtitle="Ventas a cuenta" />
                <StatCard title="Ventas de Hoy" value={`${fmtInt(stats.todayCount)} ventas`}
                    icon={<ShoppingCart size={24} />} loading={loading} colorClass="primary"
                    gradient="radial-gradient(circle, hsl(199 89% 48%) 0%, transparent 70%)"
                    subtitle={stats.todayCount > 0 ? `Ticket promedio ${fmt(stats.todaySales / stats.todayCount)}` : 'Sin ventas registradas'} />
                <StatCard title="Clientes Registrados" value={fmtInt(stats.clientsCount)}
                    icon={<Users size={24} />} loading={loading} colorClass="primary"
                    gradient="radial-gradient(circle, hsl(262 83% 58%) 0%, transparent 70%)" />
                <StatCard title="Stock Bajo" value={fmtInt(stats.lowStock)}
                    icon={<Package size={24} />} loading={loading} colorClass="destructive"
                    gradient="radial-gradient(circle, hsl(var(--destructive)) 0%, transparent 70%)" subtitle="Requieren reposición" />
            </div>

            {/* ===== Charts ===== */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '2rem' }}>
                {/* 7-day chart */}
                <div className="card" style={{ ...CARD, padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Rendimiento de Ventas</h3>
                            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Últimos 7 días · Total {fmt(stats.weekTotal)}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontWeight: '600' }}>MEJOR DÍA</p>
                            <p style={{ fontSize: '0.9rem', fontWeight: '700' }}>{String(bestDay.label || '').slice(0, 3)} · {fmt(bestDay.total)}</p>
                        </div>
                    </div>
                    <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--muted) / 0.1)', borderRadius: '12px' }}>
                        {loading ? <RefreshCw size={48} className="animate-spin" style={{ opacity: 0.2, color: 'hsl(var(--primary))' }} /> : <SalesChart data={weekSales} />}
                    </div>
                </div>

                {/* Payment donut */}
                <div className="card" style={{ ...CARD, padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Métodos de Pago Hoy</h3>
                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Distribución de las ventas del día</p>
                    </div>
                    {loading ? (
                        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <RefreshCw size={48} className="animate-spin" style={{ opacity: 0.2, color: 'hsl(var(--primary))' }} />
                        </div>
                    ) : paymentSegments.length === 0 ? (
                        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                            No hay ventas hoy todavía.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <DonutChart
                                segments={paymentSegments}
                                centerLabel="Hoy"
                                centerValue={fmtM(todayTotal)}
                            />
                            <div style={{ height: '1px', backgroundColor: 'hsl(var(--border))', width: '100%' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' }}>
                                <span style={{ color: 'hsl(var(--muted-foreground))' }}>Ventas Totales de Hoy</span>
                                <span style={{ fontWeight: '700' }}>{fmt(todayTotal)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== Cajas + Actividad ===== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Cash boxes */}
                <div className="card" style={{ ...CARD, padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Saldo en Cajas</h3>
                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Cuanto hay físicamente</p>
                    </div>
                    {loading ? (
                        <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <RefreshCw size={40} className="animate-spin" style={{ opacity: 0.2, color: 'hsl(var(--primary))' }} />
                        </div>
                    ) : cashBoxes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                            <Wallet size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                            <p style={{ fontSize: '0.9rem' }}>No hay cajas registradas para esta selección.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ flex: 1, padding: '1rem', borderRadius: '14px', backgroundColor: 'hsl(142 76% 36% / 0.1)', border: '1px solid hsl(142 76% 36% / 0.2)' }}>
                                    <p style={{ fontSize: '0.8rem', fontWeight: '600', color: 'hsl(142 76% 36%)', textTransform: 'uppercase' }}>Efectivo</p>
                                    <p style={{ fontSize: '1.4rem', fontWeight: '800' }}>{fmt(stats.cashEf)}</p>
                                </div>
                                <div style={{ flex: 1, padding: '1rem', borderRadius: '14px', backgroundColor: 'hsl(262 83% 58% / 0.1)', border: '1px solid hsl(262 83% 58% / 0.2)' }}>
                                    <p style={{ fontSize: '0.8rem', fontWeight: '600', color: 'hsl(262 83% 58%)', textTransform: 'uppercase' }}>QR</p>
                                    <p style={{ fontSize: '1.4rem', fontWeight: '800' }}>{fmt(stats.cashQr)}</p>
                                </div>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {cashBoxes.map((box, idx) => {
                                    const isQr = /qr/i.test(box.name)
                                    return (
                                        <li key={box.id} className="hover-bg" style={{ padding: '0.85rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx !== cashBoxes.length - 1 ? '1px solid hsl(var(--border) / 0.5)' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isQr ? 'hsl(262 83% 58% / 0.1)' : 'hsl(142 76% 36% / 0.1)', color: isQr ? 'hsl(262 83% 58%)' : 'hsl(142 76% 36%)' }}>
                                                    {isQr ? <QrCode size={18} /> : <Banknote size={18} />}
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight: '600', fontSize: '0.85rem' }}>{box.name}</p>
                                                    <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{isQr ? 'Digital' : 'Contado'}</p>
                                                </div>
                                            </div>
                                            <span style={{ fontWeight: '800' }}>{fmt(box.balance)}</span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </>
                    )}
                </div>

                {/* Recent activity */}
                <div className="card" style={{ ...CARD, padding: '0' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Actividad Reciente</h3>
                        <ArrowRight size={18} style={{ color: 'hsl(var(--muted-foreground))', cursor: 'pointer' }} />
                    </div>
                    {recentSales.length === 0 && !loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'hsl(var(--muted-foreground))' }}>
                            <Clock size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p style={{ fontSize: '0.9rem' }}>No hay actividad registrada recientemente.</p>
                        </div>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {recentSales.map((sale, idx) => {
                                const isCredit = sale.is_credit
                                const methodLabel = isCredit ? 'Crédito' : (sale.payment_method || 'Contado')
                                return (
                                    <li key={sale.id} className="hover-bg" style={{ padding: '1rem 1.5rem', borderBottom: idx !== recentSales.length - 1 ? '1px solid hsl(var(--border) / 0.5)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.2s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <DollarSign size={20} />
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>Venta #{String(sale.id).padStart(4, '0')}</p>
                                                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                                    {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {methodLabel}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: '700', display: 'block' }}>+{fmt(sale.total)}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'hsl(142 76% 36%)', fontWeight: '500' }}>Completado</span>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </div>

            <style>{`
                .hover-scale:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-color: hsl(var(--primary) / 0.5) !important; }
                .hover-bg:hover { background-color: hsl(var(--muted) / 0.3); }
            `}</style>
        </div>
    )
}