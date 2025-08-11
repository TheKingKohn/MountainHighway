import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './AdminPanel.css'

interface Order {
  id: string
  status: string
  totalCents: number
  platformFeeCents: number
  sellerPayoutCents: number
  createdAt: string
  listing: {
    title: string
    description: string
  }
  buyer: {
    email: string
  }
}

const AdminPanel: React.FC = () => {
  const { user, token } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  useEffect(() => {
    fetchAdminData()
  }, [token])

  const fetchAdminData = async () => {
    if (!token) {
      setError('Authentication required')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Fetch held orders
      const ordersResponse = await fetch(`${API_URL}/admin/orders/held`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!ordersResponse.ok) {
        throw new Error(`Failed to fetch orders: ${ordersResponse.status}`)
      }

      const ordersData = await ordersResponse.json()
      setOrders(ordersData.orders || [])

      // Fetch stats
      const statsResponse = await fetch(`${API_URL}/admin/orders/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

    } catch (err) {
      console.error('Admin data fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const releaseFunds = async (orderId: string) => {
    if (!token) return

    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/release-funds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Refresh data
        fetchAdminData()
        alert('Funds released successfully!')
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (err) {
      alert('Failed to release funds')
    }
  }

  const processRefund = async (orderId: string) => {
    if (!token) return

    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Refresh data
        fetchAdminData()
        alert('Refund processed successfully!')
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (err) {
      alert('Failed to process refund')
    }
  }

  if (!user) {
    return (
      <div className="admin-panel">
        <div className="admin-error">
          <h2>🔒 Admin Access Required</h2>
          <p>Please sign in to access the admin panel.</p>
          <p className="admin-hint">💡 <strong>Admin Access:</strong> Navigate to <code>/admin</code> after signing in</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="admin-loading">
          <h2>🔄 Loading Admin Panel...</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-panel">
        <div className="admin-error">
          <h2>❌ Access Denied</h2>
          <p>{error}</p>
          <p>This account may not have admin privileges.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🛠️ Mountain Highway Admin Panel</h1>
        <p>Manage orders, releases, and platform operations</p>
      </div>

      {stats && (
        <div className="admin-stats">
          <div className="stat-card">
            <h3>💰 Total Held Funds</h3>
            <p>${(stats.totalHeldFunds / 100).toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <h3>📦 Pending Orders</h3>
            <p>{stats.pendingOrders}</p>
          </div>
          <div className="stat-card">
            <h3>🏪 Platform Fees</h3>
            <p>${(stats.totalPlatformFees / 100).toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="orders-section">
        <h2>📋 Orders Awaiting Fund Release</h2>
        
        {orders.length === 0 ? (
          <div className="no-orders">
            <p>🎉 No orders pending fund release!</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <h3>{order.listing.title}</h3>
                  <span className={`status ${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                </div>
                
                <div className="order-details">
                  <p><strong>Order ID:</strong> {order.id}</p>
                  <p><strong>Buyer:</strong> {order.buyer.email}</p>
                  <p><strong>Total:</strong> ${(order.totalCents / 100).toFixed(2)}</p>
                  <p><strong>Platform Fee:</strong> ${(order.platformFeeCents / 100).toFixed(2)}</p>
                  <p><strong>Seller Payout:</strong> ${(order.sellerPayoutCents / 100).toFixed(2)}</p>
                  <p><strong>Created:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
                </div>

                <div className="order-actions">
                  <button 
                    className="release-button"
                    onClick={() => releaseFunds(order.id)}
                  >
                    💰 Release Funds
                  </button>
                  <button 
                    className="refund-button"
                    onClick={() => processRefund(order.id)}
                  >
                    🔄 Process Refund
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPanel
