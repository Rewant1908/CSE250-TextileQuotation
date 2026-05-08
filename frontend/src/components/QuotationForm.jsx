import { useEffect, useState } from 'react'
import API from '../api'

export default function QuotationForm({ user }) {
    const [products, setProducts]       = useState([])
    const [retailers, setRetailers]     = useState([])
    const [retailerId, setRetailerId]   = useState('')
    const [items, setItems]             = useState([{ product_id: '', product_name: '', quantity: '', unit_price: 0 }])
    const [toast, setToast]             = useState(null)
    const [loading, setLoading]         = useState(false)

    useEffect(() => {
        API.get('/products').then(r => setProducts(r.data)).catch(() => {})
        API.get('/retailers').then(r => setRetailers(r.data)).catch(() => {})
    }, [])

    const showToast = (msg, type) => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    const addItem    = () => setItems([...items, { product_id: '', product_name: '', quantity: '', unit_price: 0 }])
    const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
    const updateItem = (i, field, value) => {
        const updated = [...items]
        updated[i][field] = value
        // auto-fill price and name when product selected
        if (field === 'product_id') {
            const p = products.find(p => String(p.product_id) === String(value))
            if (p) {
                updated[i].unit_price   = Number(p.base_price)
                updated[i].product_name = p.product_name
            }
        }
        setItems(updated)
    }

    const subtotal   = items.reduce((sum, item) => sum + (item.unit_price * (parseFloat(item.quantity) || 0)), 0)
    const vat        = subtotal * 0.13
    const grandTotal = subtotal + vat

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!retailerId) return showToast('Please select a customer / dealer.', 'error')
        const validItems = items.filter(i => i.product_id && parseFloat(i.quantity) > 0)
        if (!validItems.length) return showToast('Add at least one product with quantity.', 'error')

        const selectedRetailer = retailers.find(r => String(r.retailer_id) === String(retailerId))
        const customer_name    = selectedRetailer?.shop_name || `Customer #${retailerId}`

        setLoading(true)
        try {
            const res = await API.post('/quotations', {
                user_id:       user?.user_id ?? null,
                customer_name,
                grand_total:   grandTotal,
                items: validItems.map(i => ({
                    product_id:   Number(i.product_id),
                    product_name: i.product_name,
                    quantity:     parseFloat(i.quantity),
                    unit_price:   i.unit_price,
                    line_total:   i.unit_price * parseFloat(i.quantity)
                }))
            })
            if (res.data.success) {
                showToast(`Quotation #${res.data.quotation_id} created! Pending admin approval.`, 'success')
                setRetailerId('')
                setItems([{ product_id: '', product_name: '', quantity: '', unit_price: 0 }])
            } else {
                showToast(res.data.error || 'Something went wrong.', 'error')
            }
        } catch (err) {
            if (err?.response?.status === 401) return showToast('Session expired — please log in again.', 'error')
            if (err?.response?.status === 403) return showToast('You do not have permission to create quotations.', 'error')
            showToast(err?.response?.data?.error || 'Could not connect to server.', 'error')
        }
        setLoading(false)
    }

    return (
        <div className="card">
            <h2>Create Quotation</h2>
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
            <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                    <label>Customer / Dealer *</label>
                    <select value={retailerId} onChange={e => setRetailerId(e.target.value)}>
                        <option value="">Select customer</option>
                        {retailers.map(r => (
                            <option key={r.retailer_id} value={r.retailer_id}>
                                {r.shop_name}{r.phone ? ` — ${r.phone}` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <label style={{ fontSize: '13px', color: '#94a3b8' }}>Products</label>
                <div className="items-list">
                    {items.map((item, i) => (
                        <div className="item-row" key={i}>
                            <select value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                                <option value="">Select Product</option>
                                {products.map(p => (
                                    <option key={p.product_id} value={p.product_id}>
                                        {p.product_name} — NPR {Number(p.base_price).toFixed(2)}/m
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                placeholder="Qty (metres)"
                                value={item.quantity}
                                min="0"
                                step="0.5"
                                onChange={e => updateItem(i, 'quantity', e.target.value)}
                            />
                            {item.unit_price > 0 && item.quantity > 0 && (
                                <span style={{ fontSize: '12px', color: '#94a3b8', alignSelf: 'center' }}>
                                    NPR {(item.unit_price * parseFloat(item.quantity)).toFixed(2)}
                                </span>
                            )}
                            {items.length > 1 && (
                                <button type="button" className="btn btn-danger" onClick={() => removeItem(i)}>Remove</button>
                            )}
                        </div>
                    ))}
                </div>
                <button type="button" className="btn-add" onClick={addItem}>+ Add Product</button>

                {subtotal > 0 && (
                    <div className="amount-box">
                        <div className="amount-row"><span>Subtotal</span><span>NPR {subtotal.toFixed(2)}</span></div>
                        <div className="amount-row"><span>VAT (13%)</span><span>NPR {vat.toFixed(2)}</span></div>
                        <div className="amount-row total"><span>Grand Total</span><span>NPR {grandTotal.toFixed(2)}</span></div>
                    </div>
                )}
                <div className="form-actions">
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Generate Quotation'}
                    </button>
                </div>
            </form>
        </div>
    )
}
