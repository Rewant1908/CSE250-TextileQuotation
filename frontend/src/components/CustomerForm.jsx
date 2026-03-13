import { useState } from 'react'

const API = 'http://localhost:5000'

export default function CustomerForm() {
    const [form, setForm] = useState({ customer_name: '', contact_phone: '', email: '' })
    const [toast, setToast] = useState(null)
    const [loading, setLoading] = useState(false)

    const showToast = (msg, type) => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.customer_name.trim()) return showToast('Customer name is required.', 'error')
        setLoading(true)
        try {
            const res = await fetch(`${API}/api/enquiry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            const data = await res.json()
            if (data.success) {
                showToast(`Customer registered! ID: ${data.customer_id}`, 'success')
                setForm({ customer_name: '', contact_phone: '', email: '' })
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
            <h2>👤 Register Customer</h2>
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
            <form onSubmit={handleSubmit}>
                <div className="form-grid">
                    <div className="form-group full">
                        <label>Customer Name *</label>
                        <input
                            type="text"
                            placeholder="e.g. Rajesh Textiles"
                            value={form.customer_name}
                            onChange={e => setForm({ ...form, customer_name: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Contact Phone</label>
                        <input
                            type="text"
                            placeholder="e.g. 9876543210"
                            value={form.contact_phone}
                            onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="e.g. raj@example.com"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                        />
                    </div>
                </div>
                <div className="form-actions">
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                        {loading ? 'Registering...' : 'Register Customer'}
                    </button>
                </div>
            </form>
        </div>
    )
}
