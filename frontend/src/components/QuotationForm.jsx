import { useEffect, useState } from 'react'

export default function QuotationForm({ token, apiBase, onAuthError }) {
    const [products, setProducts] = useState([])
    const [customerId, setCustomerId] = useState('')
    const [items, setItems] = useState([{ product_id: '', quantity: '' }])
    const [toast, setToast] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!token) return
        const controller = new AbortController()
        const load = async () => {
            try {
                const res = await fetch(`${apiBase}/api/products`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal
                })
                if (res.status === 401) return onAuthError()
                const data = await res.json()
                setProducts(data)
            } catch {
                // noop
            }
        }
        load()
        return () => controller.abort()
    }, [apiBase, token, onAuthError])

    const showToast = (msg, type) => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    const addItem = () => setItems([...items, { product_id: '', quantity: '' }])
    const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
    const updateItem = (i, field, value) => {
        const updated = [...items]
        updated[i][field] = value
        setItems(updated)
    }

    const getPrice = (product_id) => {
        const p = products.find(p => String(p.product_id) === String(product_id))
        return p ? Number(p.base_price) : 0
    }

    const subtotal = items.reduce((sum, item) =>
        sum + (getPrice(item.product_id) * (parseFloat(item.quantity) || 0)), 0)
    const gst = subtotal * 0.18
    const grandTotal = subtotal + gst

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!customerId) return showToast('Customer ID is required.', 'error')
        const validItems = items.filter(i => i.product_id && i.quantity > 0)
        if (validItems.length === 0) return showToast('Add at least one product with quantity.', 'error')
        setLoading(true)
        try {
            const res = await fetch(`${apiBase}/api/create-quotation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    customer_id: Number(customerId),
                    items: validItems.map(i => ({
                        product_id: Number(i.product_id),
                        quantity: parseFloat(i.quantity)
                    }))
                })
            })
            if (res.status === 401) {
                onAuthError()
                return
            }
            const data = await res.json()
            if (data.success) {
                showToast(`Quotation #${data.quotation_id} created successfully!`, 'success')
                setCustomerId('')
                setItems([{ product_id: '', quantity: '' }])
            } else {
                showToast(data.error || 'Something went wrong.', 'error')
            }
        } catch {
            showToast('Could not connect to server.', 'error')
        }
        setLoading(false)
    }

    return (
        <div className="card">
            <div className="card-heading">
                <div>
                    <p className="eyebrow">Quick quote builder</p>
                    <h2>📋 Create Quotation</h2>
                </div>
                <span className="pill success">GST Ready</span>
            </div>
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
            <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '20px', maxWidth: '300px' }}>
                    <label>Customer ID *</label>
                    <input
                        type="number"
                        placeholder="Enter Customer ID"
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                    />
                </div>
                <label className="eyebrow">Products</label>
                <div className="items-list">
                    {items.map((item, i) => (
                        <div className="item-row" key={i}>
                            <select value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                                <option value="">Select Product</option>
                                {products.map(p => (
                                    <option key={p.product_id} value={p.product_id}>
                                        {p.product_name} — ₹{Number(p.base_price).toFixed(2)}/m
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
                            {items.length > 1 && (
                                <button type="button" className="btn btn-danger" onClick={() => removeItem(i)}>✕</button>
                            )}
                        </div>
                    ))}
                </div>
                <button type="button" className="btn-add" onClick={addItem}>+ Add Product</button>
                {subtotal > 0 && (
                    <div className="amount-box">
                        <div className="amount-row"><span>Subtotal</span><span>₹ {subtotal.toFixed(2)}</span></div>
                        <div className="amount-row"><span>GST (18%)</span><span>₹ {gst.toFixed(2)}</span></div>
                        <div className="amount-row total"><span>Grand Total</span><span>₹ {grandTotal.toFixed(2)}</span></div>
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
