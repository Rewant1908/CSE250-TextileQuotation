import React, { useCallback, useEffect, useState } from 'react'
import API from '../api'

// Full lifecycle: draft → sent → accepted | declined
const STATUS_COLORS = {
    draft:    { bg: '#1e3a5f44', color: '#93c5fd', border: '#3b82f655' },
    sent:     { bg: '#1e3a5f44', color: '#60a5fa', border: '#2563eb55' },
    pending:  { bg: '#78350f44', color: '#fbbf24', border: '#f59e0b55' },
    accepted: { bg: '#06524444', color: '#34d399', border: '#10b98155' },
    declined: { bg: '#7f1d1d44', color: '#f87171', border: '#ef444455' },
}

export default function QuotationHistory({ user }) {
    const [quotations, setQuotations] = useState([])
    const [loading, setLoading]       = useState(true)
    const [selected, setSelected]     = useState(null)
    const [detail, setDetail]         = useState(null)
    const [declineId, setDeclineId]   = useState(null)
    const [reason, setReason]         = useState('')
    const [toast, setToast]           = useState(null)

    const isAdmin = user?.role === 'admin'

    const showToast = (msg, type) => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const load = useCallback(() => {
        setLoading(true)
        API.get('/quotations', { params: { user_id: user.user_id } })
            .then(r => setQuotations(Array.isArray(r.data) ? r.data : []))
            .catch(() => showToast('Failed to load quotations.', 'error'))
            .finally(() => setLoading(false))
    }, [user.user_id])

    useEffect(() => { load() }, [load])

    const viewDetail = async (id) => {
        if (selected === id) { setSelected(null); setDetail(null); return }
        try {
            const res = await API.get(`/quotations/${id}`)
            setDetail(res.data)
            setSelected(id)
        } catch {
            showToast('Failed to load detail.', 'error')
        }
    }

    const updateStatus = async (id, status, decline_reason = '') => {
        try {
            await API.patch(`/quotations/${id}/status`,
                { status, decline_reason },
                { headers: { 'x-user-id': String(user.user_id) } }
            )
            showToast(
                status === 'sent'
                    ? `Quotation #${id} marked sent — WhatsApp notification fired! 📱`
                    : `Quotation #${id} marked ${status}.`,
                'success'
            )
            setDeclineId(null)
            load()
        } catch (err) {
            showToast(err?.response?.data?.error || 'Update failed.', 'error')
        }
    }

    if (loading) return <div className="loading">Loading quotations...</div>

    return (
        <div className="card">
            <h2>Quotation Requests</h2>
            {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
            <div style={{ overflowX: 'auto' }}>
                <table className="quotation-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Customer</th><th>Phone</th><th>Total</th>
                            <th>Status</th><th>Created</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quotations.map(q => {
                            const sc = STATUS_COLORS[q.status] || STATUS_COLORS.pending
                            // isDraft covers both 'draft' and legacy 'pending'
                            const isDraft = q.status === 'draft' || q.status === 'pending'
                            return (
                                <React.Fragment key={q.quotation_id}>
                                    <tr>
                                        <td>#{q.quotation_number || q.quotation_id}</td>
                                        <td>{q.customer_name}</td>
                                        <td style={{ fontSize: 12 }}>
                                            {q.contact_phone
                                                ? <span title="WhatsApp notifications enabled">📱 {q.contact_phone}</span>
                                                : <span style={{ color: '#64748b' }}>—</span>}
                                        </td>
                                        <td>NPR {Number(q.total_amount ?? q.grand_total ?? 0).toFixed(2)}</td>
                                        <td>
                                            <span style={{
                                                background: sc.bg, color: sc.color,
                                                border: `1px solid ${sc.border}`,
                                                borderRadius: 6, padding: '2px 10px',
                                                fontSize: 12, fontWeight: 600
                                            }}>
                                                {q.status}
                                            </span>
                                        </td>
                                        <td>{q.created_at?.slice(0, 10)}</td>
                                        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button className="btn btn-danger" onClick={() => viewDetail(q.quotation_id)}>
                                                {selected === q.quotation_id ? 'Close' : 'View'}
                                            </button>

                                            {/* draft/pending → can mark as sent (fires WhatsApp) or decline */}
                                            {isAdmin && isDraft && (
                                                <>
                                                    <button
                                                        className="btn btn-accept"
                                                        title={q.contact_phone ? 'Mark sent & notify customer via WhatsApp' : 'Mark sent (no phone — WhatsApp skipped)'}
                                                        onClick={() => updateStatus(q.quotation_id, 'sent')}
                                                    >
                                                        📱 Send
                                                    </button>
                                                    <button className="btn btn-decline" onClick={() => { setDeclineId(q.quotation_id); setReason('') }}>Decline</button>
                                                </>
                                            )}

                                            {/* sent → can accept or decline */}
                                            {isAdmin && q.status === 'sent' && (
                                                <>
                                                    <button className="btn btn-accept" onClick={() => updateStatus(q.quotation_id, 'accepted')}>Accept</button>
                                                    <button className="btn btn-decline" onClick={() => { setDeclineId(q.quotation_id); setReason('') }}>Decline</button>
                                                </>
                                            )}

                                            {/* accepted/declined → reset to draft */}
                                            {isAdmin && (q.status === 'accepted' || q.status === 'declined') && (
                                                <button className="btn btn-reset" onClick={() => updateStatus(q.quotation_id, 'draft')}>Reset</button>
                                            )}
                                        </td>
                                    </tr>

                                    {isAdmin && declineId === q.quotation_id && (
                                        <tr>
                                            <td colSpan={7}>
                                                <div className="decline-box">
                                                    <p className="decline-label">Reason for declining Quotation #{q.quotation_id}:</p>
                                                    <textarea
                                                        value={reason}
                                                        onChange={e => setReason(e.target.value)}
                                                        rows={2}
                                                        placeholder="Enter reason..."
                                                        className="decline-textarea"
                                                    />
                                                    <div className="decline-actions">
                                                        <button className="btn btn-danger"
                                                            disabled={!reason.trim()}
                                                            onClick={() => updateStatus(q.quotation_id, 'declined', reason)}
                                                        >Confirm Decline</button>
                                                        <button className="btn" onClick={() => setDeclineId(null)}>Cancel</button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {selected === q.quotation_id && detail && (
                                        <tr>
                                            <td colSpan={7}>
                                                <div className="detail-box">
                                                    <h3>Line Items — {detail.quotation_number || `#${detail.quotation_id}`}</h3>
                                                    <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                                                        Customer: {detail.customer_name}
                                                        {detail.contact_phone && ` · 📱 ${detail.contact_phone}`}
                                                    </p>
                                                    {detail.decline_reason && (
                                                        <p style={{ color: '#f87171', marginBottom: 8 }}>Reason: {detail.decline_reason}</p>
                                                    )}
                                                    <table className="detail-table">
                                                        <thead>
                                                            <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr>
                                                        </thead>
                                                        <tbody>
                                                            {(detail.items || []).map((item, i) => (
                                                                <tr key={i}>
                                                                    <td>{item.product_name}</td>
                                                                    <td>{item.quantity}</td>
                                                                    <td>NPR {Number(item.unit_price_at_time ?? item.unit_price ?? 0).toFixed(2)}</td>
                                                                    <td>NPR {Number(item.line_total).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {quotations.length === 0 && (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No quotations yet.</p>
            )}
        </div>
    )
}
