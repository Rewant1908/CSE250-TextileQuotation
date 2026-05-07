import { useCallback, useEffect, useState } from 'react'
import API from '../api'

const PAYMENT_OPTIONS  = ['cash', 'credit', 'mixed', 'unknown']
const SEGMENT_OPTIONS  = ['budget', 'mid', 'premium']

const emptyForm = {
    shop_name: '', contact_person: '', phone: '',
    market_location: '', payment_pattern: 'cash',
    preferred_categories: '', preferred_price_segment: 'mid'
}

export default function RetailerManager({ user }) {
    const [retailers, setRetailers] = useState([])
    const [form, setForm]           = useState(emptyForm)
    const [editing, setEditing]     = useState(null)   // retailer_id being edited
    const [error, setError]         = useState('')
    const [success, setSuccess]     = useState('')
    const [loading, setLoading]     = useState(false)
    const [saving, setSaving]       = useState(false)

    const authHeader = useCallback(
        () => ({ 'x-user-id': String(user.user_id), 'x-user-role': user.role }),
        [user.user_id, user.role]
    )

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await API.get('/retailers')
            setRetailers(Array.isArray(res.data) ? res.data : [])
        } catch (e) { setError('Could not load retailers') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

    const startEdit = r => {
        setEditing(r.retailer_id)
        setForm({
            shop_name: r.shop_name || '',
            contact_person: r.contact_person || '',
            phone: r.phone || '',
            market_location: r.market_location || '',
            payment_pattern: r.payment_pattern || 'cash',
            preferred_categories: r.preferred_categories || '',
            preferred_price_segment: r.preferred_price_segment || 'mid'
        })
        setError('')
        setSuccess('')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEdit = () => { setEditing(null); setForm(emptyForm); setError(''); setSuccess('') }

    const handleSubmit = async e => {
        e.preventDefault()
        setError('')
        setSuccess('')
        if (!form.shop_name.trim()) return setError('Shop name is required')
        setSaving(true)
        try {
            if (editing) {
                await API.put(`/retailers/${editing}`, form, { headers: authHeader() })
                setSuccess(`"${form.shop_name}" updated`)
                setEditing(null)
            } else {
                await API.post('/retailers', form, { headers: authHeader() })
                setSuccess(`"${form.shop_name}" added`)
            }
            setForm(emptyForm)
            load()
        } catch (e) { setError(e?.response?.data?.error || 'Save failed') }
        finally { setSaving(false) }
    }

    const Field = ({ label, name, type = 'text', options }) => (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
            {options
                ? <select name={name} value={form[name]} onChange={handleChange} className="input" style={{ minWidth: 140 }}>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                : <input name={name} type={type} value={form[name]} onChange={handleChange} className="input" />}
        </label>
    )

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1rem 2rem' }}>
            <h2 style={{ marginBottom: '1.2rem' }}>Retailer Management</h2>

            {/* ── Form ── */}
            <section className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>{editing ? 'Edit Retailer' : 'Add New Retailer'}</h3>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        <Field label="Shop Name *" name="shop_name" />
                        <Field label="Contact Person" name="contact_person" />
                        <Field label="Phone" name="phone" />
                        <Field label="Market / Location" name="market_location" />
                        <Field label="Payment Pattern" name="payment_pattern" options={PAYMENT_OPTIONS} />
                        <Field label="Preferred Categories" name="preferred_categories" />
                        <Field label="Price Segment" name="preferred_price_segment" options={SEGMENT_OPTIONS} />
                    </div>
                    {error   && <p style={{ color: 'var(--color-error)',   marginBottom: '.6rem', fontSize: 14 }}>{error}</p>}
                    {success && <p style={{ color: 'var(--color-success)', marginBottom: '.6rem', fontSize: 14 }}>✓ {success}</p>}
                    <div style={{ display: 'flex', gap: '.8rem' }}>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Retailer'}
                        </button>
                        {editing && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>}
                    </div>
                </form>
            </section>

            {/* ── Table ── */}
            <section>
                <h3 style={{ marginBottom: '1rem' }}>All Retailers ({retailers.length})</h3>
                {loading
                    ? <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
                    : retailers.length === 0
                        ? <p style={{ color: 'var(--color-text-muted)' }}>No retailers yet — add one above.</p>
                        : <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-surface-offset)', textAlign: 'left' }}>
                                        {['Shop','Contact','Phone','Location','Payment','Prefers','Segment','Balance',''].map(h =>
                                            <th key={h} style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{h}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {retailers.map(r => (
                                        <tr key={r.retailer_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '7px 10px', fontWeight: 600 }}>{r.shop_name}</td>
                                            <td style={{ padding: '7px 10px' }}>{r.contact_person || '-'}</td>
                                            <td style={{ padding: '7px 10px' }}>{r.phone || '-'}</td>
                                            <td style={{ padding: '7px 10px' }}>{r.market_location || '-'}</td>
                                            <td style={{ padding: '7px 10px' }}>
                                                <span style={{ background: r.payment_pattern === 'cash' ? '#dcfce7' : r.payment_pattern === 'credit' ? '#fef9c3' : '#f3f4f6', color: '#374151', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                                                    {r.payment_pattern}
                                                </span>
                                            </td>
                                            <td style={{ padding: '7px 10px' }}>{r.preferred_categories || '-'}</td>
                                            <td style={{ padding: '7px 10px' }}>{r.preferred_price_segment || '-'}</td>
                                            <td style={{ padding: '7px 10px', color: Number(r.outstanding_balance) > 0 ? 'var(--color-error)' : 'inherit', fontWeight: Number(r.outstanding_balance) > 0 ? 700 : 400 }}>
                                                NPR {Number(r.outstanding_balance || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ padding: '7px 10px' }}>
                                                <button className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => startEdit(r)}>Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                          </div>
                }
            </section>
        </div>
    )
}
