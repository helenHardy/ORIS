import React, { forwardRef } from 'react'

const Ticket = forwardRef(({ sale, items, branch, customer, paymentMethod, currencySymbol = 'Bs.' }, ref) => {
    if (!sale) return null

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const tax = sale.tax !== undefined ? sale.tax : (subtotal * 0.13)
    const total = sale.total !== undefined ? sale.total : (subtotal + tax)

    return (
        <div ref={ref} className="ticket-container" style={{
            width: '100%',
            maxWidth: '210mm',
            padding: '15mm 12mm',
            backgroundColor: 'white',
            color: 'black',
            fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: '12px',
            lineHeight: '1.4',
            margin: '0 auto',
            boxSizing: 'border-box'
        }}>
            <style>
                {`
                @media print {
                    @page { margin: 10mm; size: A4 portrait; }
                    body { margin: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .ticket-container { width: 100% !important; max-width: 100% !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
                }
                `}
            </style>

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '800', color: 'black', letterSpacing: '0.02em' }}>CASA ORIS</h1>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                        <div>76282003</div>
                        <div>Zona Villa Adela, Calle "J" #2</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: '800', color: 'black', letterSpacing: '0.05em' }}>NOTA DE ENTREGA</h2>
                    
                    {/* Casa Oris SVG Logo */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                        <svg width="90" height="80" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Teal house contour */}
                            <path d="M50 8 L90 38 V82 H10 V38 Z" stroke="#00a396" strokeWidth="5" strokeLinejoin="round" fill="none" />
                            {/* Inner door / arch */}
                            <path d="M50 5 L94 38 M6 38 L50 5" stroke="#00a396" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            <path d="M35 82 V58 H65 V82" stroke="#00a396" strokeWidth="5" strokeLinejoin="round" fill="none" />
                            {/* Label text inside the house shape */}
                            <text x="50" y="36" fill="#00a396" fontSize="9" fontWeight="800" fontFamily="'Segoe UI', sans-serif" textAnchor="middle" letterSpacing="1">CASA</text>
                            <text x="50" y="54" fill="#00a396" fontSize="16" fontWeight="900" fontFamily="'Segoe UI', sans-serif" textAnchor="middle" letterSpacing="0.5">ORIS</text>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Delivery Details Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', gap: '20px' }}>
                {/* Left: Customer Info */}
                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', color: 'black' }}>Entregar a</div>
                    <div style={{ textTransform: 'uppercase', color: '#1e293b', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div>CLIENTE: {customer?.name || 'PÚBLICO GENERAL'}</div>
                        <div>CELL.: {customer?.phone || '62358428'}</div>
                        <div>DIR.: {customer?.address || 'ZONA XXX CALLE XXXX'}</div>
                    </div>
                </div>

                {/* Right: Delivery meta */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '240px' }}>
                        <tbody>
                            <tr>
                                <td style={{ fontWeight: 'bold', padding: '3px 0', textAlign: 'left', color: 'black' }}>Entrega #</td>
                                <td style={{ padding: '3px 0', textAlign: 'right', color: '#1e293b' }}>{sale.sale_number || sale.id.toString().slice(-8).toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: 'bold', padding: '3px 0', textAlign: 'left', color: 'black' }}>Fecha de la entrega</td>
                                <td style={{ padding: '3px 0', textAlign: 'right', color: '#1e293b' }}>{new Date(sale.created_at).toLocaleDateString('es-ES')}</td>
                            </tr>
                            {paymentMethod && (
                                <tr>
                                    <td style={{ fontWeight: 'bold', padding: '3px 0', textAlign: 'left', color: 'black' }}>Método de pago</td>
                                    <td style={{ padding: '3px 0', textAlign: 'right', color: '#1e293b' }}>{paymentMethod}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Products Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '0' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #000' }}>
                        <th style={{ width: '12%', borderRight: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', color: 'black' }}>CANT.</th>
                        <th style={{ width: '58%', borderRight: '1px solid #000', padding: '8px 10px', textAlign: 'left', fontWeight: 'bold', color: 'black' }}>DESCRIPCIÓN</th>
                        <th style={{ width: '15%', borderRight: '1px solid #000', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: 'black' }}>PRECIO UNITARIO</th>
                        <th style={{ width: '15%', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: 'black' }}>IMPORTE</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index} style={{ borderBottom: index === items.length - 1 ? 'none' : '1px solid #000' }}>
                            <td style={{ borderRight: '1px solid #000', padding: '8px 6px', textAlign: 'center', color: '#000' }}>
                                {item.quantity}
                            </td>
                            <td style={{ borderRight: '1px solid #000', padding: '8px 10px', textAlign: 'left', color: '#000' }}>
                                <span style={{ fontWeight: '600' }}>{item.name}</span>
                                {item.unit_of_measure && <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '5px' }}>({item.unit_of_measure})</span>}
                                {item.is_damaged && <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', marginLeft: '5px' }}>(DAÑADO)</span>}
                            </td>
                            <td style={{ borderRight: '1px solid #000', padding: '8px 10px', textAlign: 'right', color: '#000' }}>
                                {item.price.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>
                                {(item.price * item.quantity).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals Box */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-1px' }}>
                <table style={{ borderCollapse: 'collapse', border: '1px solid #000', width: '30%', minWidth: '200px' }}>
                    <tbody>
                        {sale.discount > 0 && (
                            <tr style={{ borderBottom: '1px solid #000' }}>
                                <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>DESC.</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11px', color: '#ef4444', borderLeft: '1px solid #000', fontWeight: 'bold' }}>
                                    -{currencySymbol}{sale.discount.toFixed(2)}
                                </td>
                            </tr>
                        )}
                        {tax > 0 && (
                            <tr style={{ borderBottom: '1px solid #000' }}>
                                <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>IVA ({sale.tax_rate || '13'}%)</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11px', color: '#475569', borderLeft: '1px solid #000', fontWeight: 'bold' }}>
                                    {currencySymbol}{tax.toFixed(2)}
                                </td>
                            </tr>
                        )}
                        <tr style={{ fontSize: '13px' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: 'black' }}>TOTAL</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f8fafc', borderLeft: '1px solid #000', color: 'black' }}>
                                {currencySymbol} {total.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
})

Ticket.displayName = 'Ticket'

export default Ticket
