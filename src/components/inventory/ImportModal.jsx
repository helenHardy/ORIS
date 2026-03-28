import React, { useState } from 'react'
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react'
import { inventoryService } from '../../services/inventoryService'

export default function ImportModal({ isOpen, onClose, onImportSuccess, branchId }) {
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [validation, setValidation] = useState({ errors: [], duplicates: [], ready: 0 })

    if (!isOpen) return null

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0]
        if (selectedFile) {
            setFile(selectedFile)
            const reader = new FileReader()
            reader.onload = (event) => {
                const text = event.target.result
                parseCSV(text)
            }
            reader.readAsText(selectedFile)
        }
    }

    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/)
        if (lines.length < 2) return setError('El archivo está vacío o no tiene el formato correcto.')

        const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase())
        const productList = lines.slice(1).filter(line => line.trim()).map((line, index) => {
            const values = line.split(/[;,]/).map(v => v.trim())
            const obj = { _row: index + 2 } // Keep track of CSV row number
            headers.forEach((header, i) => {
                const keyMap = {
                    'sku': 'sku',
                    'nombre': 'name',
                    'categoria': 'category',
                    'marca': 'brand',
                    'modelo': 'model',
                    'precio': 'price',
                    'precio venta': 'price',
                    'costo': 'cost',
                    'precio costo': 'cost',
                    'stock': 'stock',
                    'cantidad': 'stock',
                    'min_stock': 'minStock',
                    'stock minimo': 'minStock',
                    'unidad': 'unit'
                }
                const key = keyMap[header] || header
                obj[key] = values[i]
            })
            return obj
        })

        validateData(productList)
        setPreview(productList.slice(0, 5))
        setError(null)
    }

    const validateData = (list) => {
        const errors = []
        const duplicates = []
        const skuMap = new Map()

        list.forEach((p, idx) => {
            // Check missing critical fields
            if (!p.sku) errors.push({ row: p._row, msg: 'Falta SKU' })
            if (!p.name) errors.push({ row: p._row, msg: 'Falta Nombre' })
            
            // Check duplicates in CSV
            if (p.sku) {
                if (skuMap.has(p.sku)) {
                    duplicates.push({ sku: p.sku, rows: [skuMap.get(p.sku), p._row] })
                }
                skuMap.set(p.sku, p._row)
            }
        })

        setValidation({
            errors,
            duplicates,
            ready: list.length - errors.length - (duplicates.length > 0 ? 1 : 0), // Simplified count
            total: list.length
        })
    }

    const downloadTemplate = () => {
        const headers = 'sku,nombre,categoria,marca,modelo,precio,costo,stock,min_stock,unidad\n'
        const example = 'PROD-001,Coca Cola 2L,Bebidas,Coca Cola,Original,15,10,24,6,Unid.'
        const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', 'plantilla_inventario.csv')
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleImport = async () => {
        if (!file) return setError('Selecciona un archivo primero.')
        if (validation.errors.length > 0) return setError('Corrige los errores en el archivo antes de importar.')
        
        setLoading(true)
        setError(null)

        try {
            const reader = new FileReader()
            reader.onload = async (event) => {
                const text = event.target.result
                const lines = text.split(/\r?\n/)
                const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase())

                const rawList = lines.slice(1).filter(line => line.trim()).map(line => {
                    const values = line.split(/[;,]/).map(v => v.trim())
                    const obj = {}
                    headers.forEach((header, index) => {
                        const keyMap = {
                            'sku': 'sku', 'nombre': 'name', 'categoria': 'category', 'marca': 'brand',
                            'modelo': 'model', 'precio': 'price', 'precio venta': 'price', 'costo': 'cost',
                            'precio costo': 'cost', 'stock': 'stock', 'cantidad': 'stock',
                            'min_stock': 'minStock', 'stock minimo': 'minStock', 'unidad': 'unit'
                        }
                        const key = keyMap[header] || header
                        obj[key] = values[index]
                    })
                    return obj
                })

                // Deduplicate before sending
                const deduplicated = []
                const seen = new Set()
                for (let i = rawList.length - 1; i >= 0; i--) {
                    if (!seen.has(rawList[i].sku)) {
                        deduplicated.unshift(rawList[i])
                        seen.add(rawList[i].sku)
                    }
                }

                await inventoryService.bulkImportProducts(deduplicated, branchId)
                onImportSuccess(`Se han procesado ${deduplicated.length} productos exitosamente.`)
                onClose()
            }
            reader.readAsText(file)
        } catch (err) {
            console.error('Import error:', err)
            setError(err.message || 'Error durante la importación. Revisa el formato del archivo.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Upload size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontWeight: 800 }}>Importar Inventario</h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>Carga tus productos desde un archivo CSV/Excel</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.5 }}><X size={20} /></button>
                </div>

                <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                    {!file ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div
                                onClick={() => document.getElementById('csv-upload').click()}
                                style={{ border: '2px dashed #ddd', borderRadius: '12px', padding: '3rem 1rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: '#f9f9f9' }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'hsl(var(--primary))'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = '#ddd'}
                            >
                                <Upload size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                <p style={{ fontWeight: 700, margin: '0 0 0.5rem 0' }}>Haz clic para seleccionar archivo</p>
                                <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Formato recomendado: .CSV (Comma Separated Values)</p>
                                <input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
                            </div>

                            <div style={{ backgroundColor: 'hsl(var(--primary) / 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid hsl(var(--primary) / 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'hsl(var(--primary))' }}>
                                    <FileText size={16} />
                                    <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>¿No tienes el formato correcto?</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: '0 0 1rem 0' }}>Descarga nuestra plantilla para asegurar que los datos se carguen correctamente.</p>
                                <button
                                    onClick={downloadTemplate}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                                >
                                    <Download size={14} /> Descargar Plantilla
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                <CheckCircle size={24} color="#16a34a" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>Archivo cargado: {file.name}</p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>Total: {validation.total} filas | Listos para procesar: {validation.ready}</p>
                                </div>
                                <button onClick={() => { setFile(null); setPreview([]); setValidation({ errors: [], duplicates: [], ready: 0 }) }} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Cambiar</button>
                            </div>

                            {/* Validation Section */}
                            {(validation.errors.length > 0 || validation.duplicates.length > 0) && (
                                <div style={{ padding: '1rem', backgroundColor: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#9a3412' }}>
                                        <AlertCircle size={18} />
                                        <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Problemas detectados en el archivo</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                        {validation.errors.map((err, i) => (
                                            <div key={`err-${i}`} style={{ fontSize: '0.75rem', color: '#991b1b', display: 'flex', gap: '0.5rem' }}>
                                                <span style={{ fontWeight: 800 }}>Fila {err.row}:</span> <span>{err.msg}</span>
                                            </div>
                                        ))}
                                        {validation.duplicates.map((dup, i) => (
                                            <div key={`dup-${i}`} style={{ fontSize: '0.75rem', color: '#92400e', display: 'flex', gap: '0.5rem' }}>
                                                <span style={{ fontWeight: 800 }}>Duplicado:</span> <span>SKU "{dup.sku}" aparece en filas {dup.rows.join(' y ')}. Se usará la última.</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.7rem', color: '#c2410c', fontStyle: 'italic' }}>* Los errores críticos (Faltas de SKU o Nombre) deben corregirse en el archivo antes de continuar.</p>
                                </div>
                            )}

                            {preview.length > 0 && (
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.5rem', opacity: 0.5 }}>VISTA PREVIA DE DATOS (Primeras 5 filas):</p>
                                    <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                            <thead style={{ backgroundColor: '#f9f9f9' }}>
                                                <tr>
                                                    {Object.keys(preview[0]).filter(k => k !== '_row').map(key => (
                                                        <th key={key} style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #eee', textTransform: 'capitalize' }}>{key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.map((row, i) => (
                                                    <tr key={i}>
                                                        {Object.entries(row).filter(([k]) => k !== '_row').map(([k, val], j) => (
                                                            <td key={j} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{val}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '12px', border: '1px solid #fecaca', fontSize: '0.8rem' }}>
                                    <AlertCircle size={20} />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ padding: '1.25rem', borderTop: '1px solid #eee', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
                    <button
                        onClick={handleImport}
                        disabled={!file || loading || validation.errors.length > 0}
                        style={{
                            padding: '0.75rem 2rem',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: !file || loading ? '#ccc' : 'hsl(var(--primary))',
                            color: 'white',
                            cursor: !file || loading ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {loading ? <><Loader2 size={18} className="spin" /> Procesando...</> : 'Confirmar Importación'}
                    </button>
                </div>
            </div>
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
