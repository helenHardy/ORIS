import React from 'react'
import { Plus, Minus, Trash2, Package, ShoppingCart, Box } from 'lucide-react'

export default function Cart({ items, onRemove, onUpdateQuantity, onSetQuantity, onSetPrice, onToggleDamaged, currencySymbol = 'Bs.' }) {
    if (items.length === 0) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--secondary-foreground))', padding: '2rem', opacity: 0.3 }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px dashed currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <ShoppingCart size={40} />
                </div>
                <p style={{ fontWeight: '800', fontSize: '1.1rem' }}>Carrito Vacío</p>
                <p style={{ fontSize: '0.85rem', fontWeight: '500', maxWidth: '180px', textAlign: 'center' }}>Selecciona productos del catálogo para comenzar la venta.</p>
            </div>
        )
    }

    return (
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map(item => (
                <div
                    key={item.id}
                    style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        padding: '1.25rem 1rem',
                        backgroundColor: item.is_damaged ? 'hsl(var(--destructive) / 0.05)' : 'hsl(var(--background))',
                        borderRadius: '16px',
                        border: item.is_damaged ? '1px solid hsl(var(--destructive) / 0.3)' : '1px solid hsl(var(--border) / 0.5)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                        animation: 'fadeIn 0.3s ease-out'
                    }}
                >
                    {/* Item Image Mini */}
                    <div style={{
                        width: '44px',
                        height: '44px',
                        backgroundColor: 'hsl(var(--secondary) / 0.4)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'hsl(var(--primary))',
                        flexShrink: 0,
                        overflow: 'hidden'
                    }}>
                        {item.image_url ? (
                            <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Box size={20} opacity={0.4} />
                        )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <h4 style={{
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: item.is_damaged ? 'hsl(var(--destructive))' : 'inherit',
                            margin: 0
                        }} title={item.name}>
                            {item.name}
                        </h4>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                             <span style={{ fontSize: '0.9rem', color: 'hsl(var(--primary))', fontWeight: '900' }}>
                                {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                            </span>
                            
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                backgroundColor: 'hsl(var(--secondary) / 0.4)',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                border: '1px solid hsl(var(--border) / 0.3)'
                            }}>
                                <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: '800' }}>{currencySymbol}</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    style={{
                                        width: '50px',
                                        fontSize: '0.8rem',
                                        fontWeight: '900',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        padding: 0,
                                        color: 'hsl(var(--primary))',
                                        textAlign: 'center'
                                    }}
                                    value={item.price === 0 ? '' : item.price}
                                    onChange={(e) => onSetPrice(item.id, parseFloat(e.target.value) || 0)}
                                    onFocus={(e) => e.target.select()}
                                    title="Modificar precio unitario"
                                />
                                <span style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: '700' }}>u.</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '12px', padding: '0.25rem', border: '1px solid hsl(var(--border) / 0.3)' }}>
                            <button
                                className="btn"
                                style={{
                                    width: '26px',
                                    height: '26px',
                                    padding: 0,
                                    borderRadius: '8px',
                                    backgroundColor: 'white',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    border: 'none'
                                }}
                                onClick={() => onUpdateQuantity(item.id, -1)}
                            >
                                <Minus size={12} />
                            </button>
                            <input
                                type="number"
                                style={{
                                    width: '35px',
                                    fontSize: '0.85rem',
                                    fontWeight: '900',
                                    textAlign: 'center',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    padding: 0,
                                    MozAppearance: 'textfield'
                                }}
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => onSetQuantity(item.id, parseInt(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                onBlur={() => { if (item.quantity === 0) onSetQuantity(item.id, 1) }}
                                min="0"
                            />
                            <button
                                className="btn"
                                disabled={item.quantity >= (item.stock || 0)}
                                style={{
                                    width: '26px',
                                    height: '26px',
                                    padding: 0,
                                    borderRadius: '8px',
                                    backgroundColor: item.quantity >= (item.stock || 0) ? 'hsl(var(--secondary) / 0.5)' : 'white',
                                    boxShadow: item.quantity >= (item.stock || 0) ? 'none' : '0 2px 4px rgba(0,0,0,0.05)',
                                    border: 'none',
                                    cursor: item.quantity >= (item.stock || 0) ? 'not-allowed' : 'pointer',
                                    opacity: item.quantity >= (item.stock || 0) ? 0.5 : 1
                                }}
                                onClick={() => onUpdateQuantity(item.id, 1)}
                            >
                                <Plus size={12} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <label style={{ fontSize: '0.6rem', fontWeight: '800', opacity: 0.4 }}>MERMA</label>
                            <input
                                type="checkbox"
                                checked={!!item.is_damaged}
                                onChange={() => onToggleDamaged(item.id)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                        </div>

                        <button
                            className="btn"
                            style={{
                                color: 'hsl(var(--destructive) / 0.5)',
                                padding: '0.4rem',
                                borderRadius: '10px',
                            }}
                            onClick={() => onRemove(item.id)}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
            `}</style>
        </div>
    )
}
