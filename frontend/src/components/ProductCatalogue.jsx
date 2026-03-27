import { useEffect, useState } from 'react'

export default function ProductCatalogue({ token, apiBase, onAuthError }) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!token) return
        const controller = new AbortController()
        const loadProducts = async () => {
            try {
                const res = await fetch(`${apiBase}/api/products`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal
                })
                if (res.status === 401) return onAuthError()
                const data = await res.json()
                setProducts(data)
            } catch {
                // handled by state
            } finally {
                setLoading(false)
            }
        }
        loadProducts()
        return () => controller.abort()
    }, [apiBase, token, onAuthError])

    if (loading) return <div className="loading">Loading products...</div>

    return (
        <div className="card">
            <div className="card-heading">
                <div>
                    <p className="eyebrow">Inventory visibility</p>
                    <h2>📦 Product Catalogue</h2>
                </div>
                <span className="pill neutral">Live</span>
            </div>
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
                        <td className="product-name">{p.product_name}</td>
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
                <p className="empty-state">
                    No products found.
                </p>
            )}
        </div>
    )
}
