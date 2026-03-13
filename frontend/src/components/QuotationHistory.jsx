import { useEffect, useState } from 'react'

const API = 'http://localhost:5000'

export default function QuotationHistory() {
    const [quotations, setQuotations] = useState([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)
    const [detail, setDetail] = useState(null)

    useEffect(() => {
        fetch(`${API}/api/quotations`)
            .then(r => r.json())
            .then(data => { setQuotations(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const viewDetail = async (id) => {
        if (selected === id) { setSelected(null); setDetail(null); return }
        setSelected(id)
        const res = await fetch(`${API}/api/quotations/${id}`)
        const data = await res.json()
        setDetail(data)
    }

    if (loading) return <div className="loading">Loading quotations...</div>

    return (
        <div className="card">
            <h2>🧾 Quotation History</h2>
            <table>
                <thead>
                <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Subtotal</th>
                    <th>GST (18%)</th>
                    <th>Grand Total</th>
                    <th>Date</th>
                    <th>Action</th>
                </tr>
                </thead>
                <tbody>
                {quotations.map(q => (
                    <>
                        <tr key={q.quotation_id}>
                            <td>#{q.quotation_id}</td>
                            <td>{q.customer_name}</td>
                            <td>{q.contact_phone || '—'}</td>
                            <td>₹ {Number(q.total_amount).toFixed(2)}</td>
                            <td>₹ {(Number(q.total_amount) * 0.18).toFixed(2)}</td>
                            <td style={{ color: '#f59e0b', fontWeight: 600 }}>₹ {Number(q.grand_total).toFixed(2)}</td>
                            <td>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                            <td>
                                <button className="btn btn-danger" onClick={() => viewDetail(q.quotation_id)}>
                                    {selected === q.quotation_id ? 'Close' : 'View'}
                                </button>
                            </td>
                        </tr>
                        {selected === q.quotation_id && detail && (
                            <tr key={`detail-${q.quotation_id}`}>
                                <td colSpan="8">
                                    <div className="detail-panel">
                                        <h3>Line Items — Quotation #{detail.quotation_id}</h3>
                                        <table>
                                            <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Category</th>
                                                <th>Qty (m)</th>
                                                <th>Unit Price</th>
                                                <th>Line Total</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {detail.items.map((item, i) => (
                                                <tr key={i}>
                                                    <td>{item.product_name}</td>
                                                    <td>
                                <span className={`badge badge-${item.category.toLowerCase()}`}>
                                  {item.category}
                                </span>
                                                    </td>
                                                    <td>{item.quantity} m</td>
                                                    <td>₹ {Number(item.unit_price_at_time).toFixed(2)}</td>
                                                    <td>₹ {Number(item.line_total).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </>
                ))}
                </tbody>
            </table>
            {quotations.length === 0 && (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No quotations yet.</p>
            )}
        </div>
    )
}
