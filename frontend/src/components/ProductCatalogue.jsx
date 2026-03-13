import { useEffect, useState } from 'react'

const API = 'http://localhost:5000'

export default function ProductCatalogue() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API}/api/products`)
            .then(r => r.json())
            .then(data => { setProducts(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div className="loading">Loading products...</div>

    return (
        <div className="card">
            <h2>📦 Product Catalogue</h2>
            <table>
                <thead>
                <tr>
                    <th>#</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Base Price (₹/m)</th>
                </tr>
                </thead>
                <tbody>
                {products.map((p, i) => (
                    <tr key={p.product_id}>
                        <td>{i + 1}</td>
                        <td>{p.product_name}</td>
                        <td>
                <span className={`badge badge-${p.category.toLowerCase()}`}>
                  {p.category}
                </span>
                        </td>
                        <td>₹ {Number(p.base_price).toFixed(2)}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            {products.length === 0 && (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                    No products found.
                </p>
            )}
        </div>
    )
}