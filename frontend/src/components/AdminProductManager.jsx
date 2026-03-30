import { useEffect, useState } from 'react'

const API = 'http://localhost:5000'

export default function AdminProductManager() {
    const [products, setProducts] = useState([])
    const [form, setForm]         = useState({ product_name: '', category: '', base_price: '' })
    const [editId, setEditId]     = useState(null)
    const [toast, setToast]       = useState(null)

    const load = () =>
        fetch(`${API}/api/products`).then(r => r.json()).then(setProducts)

    useEffect(() => { load() }, [])

    const showToast = (msg, type) => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const handleSave = async () => {
        if (!form.product_name || !form.category || !form.base_price)
            return showToast('All fields are required', 'error')
        const method = editId ? 'PUT' : 'POST'
        const url    = editId ? `${API}/api/products/${editId}` : `${API}/api/products`
        const res    = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, base_price: parseFloat(form.base_price) })
        })
        const data = await res.json()
        if (data.success || data.product_id) {
            showToast(editId ? 'Product updated!' : 'Product added!', 'success')
            setForm({ product_name: '', category: '', base_price: '' })
            setEditId(null)
            load()
        } else {
            showToast(data.error || 'Failed', 'error')
        }
    }

    const handleEdit = (p) => {
        setEditId(p.product_id)
        setForm({ product_name: p.product_name, category: p.category, base_price: p.base_price })
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this product?')) return
        await fetch(`${API}/api/products/${id}`, { method: 'DELETE' })
        showToast('Product deleted', 'success')
        load()
    }

    return (
        <div className="card">
            <h2>🛠 Manage Products & Pricing</h2>
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

            <div className="form-grid" style={{ marginBottom: '20px' }}>
                <div className="form-group">
                    <label>Product Name</label>
                    <input placeholder="e.g. Premium Wool" value={form.product_name}
                        onChange={e => setForm({ ...form, product_name: e.target.value })} />
                </div>
                <div className="form-group">
                    <label>Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                        <option value="">Select Category</option>
                        <option value="Suiting">Suiting</option>
                        <option value="Shirting">Shirting</option>
                        <option value="Furnishing">Furnishing</option>
                        <option value="Denim">Denim</option>
                        <option value="Knitwear">Knitwear</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Base Price (₹/m)</label>
                    <input type="number" placeholder="e.g. 450" value={form.base_price}
                        onChange={e => setForm({ ...form, base_price: e.target.value })} />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                    <label>&nbsp;</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" onClick={handleSave}>
                            {editId ? '💾 Update' : '＋ Add Product'}
                        </button>
                        {editId && (
                            <button className="btn btn-logout" onClick={() => { setEditId(null); setForm({ product_name: '', category: '', base_price: '' }) }}>
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <table>
                <thead>
                <tr><th>ID</th><th>Product</th><th>Category</th><th>Price (₹/m)</th><th>Actions</th></tr>
                </thead>
                <tbody>
                {products.map(p => (
                    <tr key={p.product_id}>
                        <td>#{p.product_id}</td>
                        <td>{p.product_name}</td>
                        <td><span className={`badge badge-${p.category?.toLowerCase()}`}>{p.category}</span></td>
                        <td style={{ color: '#f59e0b', fontWeight: 600 }}>₹ {Number(p.base_price).toFixed(2)}</td>
                        <td style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-accept" onClick={() => handleEdit(p)}>✎ Edit</button>
                            <button className="btn btn-decline" onClick={() => handleDelete(p.product_id)}>🗑 Delete</button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}
