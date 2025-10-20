import React, { useEffect, useState } from "react";
import { Table, Form, Alert } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaHome } from "react-icons/fa";
import axios from "axios";

function CustomerOrderHistory() {
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // Load customer's orders from API
  useEffect(() => {
    const fetchCustomerOrders = async () => {
      try {
        // Get token from localStorage
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.error("No authentication token found. Please login first.");
          navigate('/auth/login');
          return;
        }

        console.log("📦 Fetching customer orders...");
        
        const response = await axios.get("http://localhost:5005/api/orders", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("✅ Orders fetched:", response.data);
        
        // Sort orders by date in descending order (newest first)
        const sortedOrders = response.data.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA; // Descending order
        });
        
        setOrders(sortedOrders);
        setLoading(false);
      } catch (error) {
        console.error("❌ Error fetching orders:", error);
        setError(error.response?.data?.message || "Failed to load orders. Please try again.");
        setLoading(false);
      }
    };

    fetchCustomerOrders();
  }, [navigate]);

  // Filter orders by search query
  const filteredOrders = orders.filter((order) =>
    order.restaurantId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.deliveryAddress?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleBack = () => {
    navigate("/");
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '#ffc107'; // Yellow
      case 'confirmed':
        return '#17a2b8'; // Blue
      case 'preparing':
        return '#fd7e14'; // Orange
      case 'out for delivery':
        return '#6f42c1'; // Purple
      case 'delivered':
        return '#28a745'; // Green
      case 'canceled':
        return '#dc3545'; // Red
      default:
        return '#6c757d'; // Gray
    }
  };

  return (
    <div
      className="container"
      style={{ padding: "20px", backgroundColor: "#f8f9fa", minHeight: "100vh" }}
    >
      {/* Back Button */}
      <button
        onClick={handleBack}
        style={{
          backgroundColor: "transparent",
          border: "none",
          color: "#333",
          fontSize: "28px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <FaHome /> <span style={{ fontSize: "16px", marginLeft: "10px" }}>Back to Home</span>
      </button>

      <h1 style={{ textAlign: "center", marginBottom: "30px", color: "#333" }}>
        My Order History
      </h1>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}

      {/* Search Bar */}
      <Form.Group style={{ marginBottom: "20px" }}>
        <Form.Control
          type="text"
          placeholder="Search by Restaurant or Address"
          value={searchQuery}
          onChange={handleSearchChange}
          style={{
            padding: "12px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            maxWidth: "400px",
          }}
        />
      </Form.Group>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p style={{ marginTop: "10px" }}>Loading your orders...</p>
        </div>
      )}

      {/* No Orders Message */}
      {!loading && filteredOrders.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ fontSize: "18px", color: "#666" }}>
            {searchQuery ? "No orders found matching your search." : "You haven't placed any orders yet."}
          </p>
          <Link to="/customer/cart">
            <button
              style={{
                backgroundColor: "#ff6b35",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "16px",
                marginTop: "20px",
                cursor: "pointer",
              }}
            >
              Start Shopping
            </button>
          </Link>
        </div>
      )}

      {/* Orders Display */}
      {!loading && filteredOrders.length > 0 && (
        <div>
          {filteredOrders.map((order) => (
            <div
              key={order._id}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "20px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
            >
              {/* Order Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "2px solid #f0f0f0",
                  paddingBottom: "15px",
                  marginBottom: "15px",
                }}
              >
                <div>
                  <h5 style={{ margin: 0, color: "#333" }}>
                    Order #{order._id?.slice(-8).toUpperCase()}
                  </h5>
                  <p style={{ margin: "5px 0 0 0", color: "#666", fontSize: "14px" }}>
                    {order.createdAt ? formatDate(order.createdAt) : "Date not available"}
                  </p>
                </div>
                <div
                  style={{
                    backgroundColor: getStatusColor(order.status),
                    color: "white",
                    padding: "6px 16px",
                    borderRadius: "20px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  {order.status?.toUpperCase() || 'PENDING'}
                </div>
              </div>

              {/* Order Details */}
              <div style={{ marginBottom: "15px" }}>
                <p style={{ margin: "5px 0", fontSize: "15px" }}>
                  <strong>Restaurant:</strong> {order.restaurantId}
                </p>
                <p style={{ margin: "5px 0", fontSize: "15px" }}>
                  <strong>Delivery Address:</strong> {order.deliveryAddress}
                </p>
              </div>

              {/* Order Items */}
              <div style={{ marginBottom: "15px" }}>
                <strong style={{ fontSize: "15px" }}>Items:</strong>
                <Table
                  striped
                  bordered
                  size="sm"
                  style={{
                    marginTop: "10px",
                    backgroundColor: "#fafafa",
                  }}
                >
                  <thead style={{ backgroundColor: "#e9ecef" }}>
                    <tr>
                      <th>Food ID</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items?.map((item, index) => (
                      <tr key={`${order._id}-item-${index}`}>
                        <td>{item.foodId}</td>
                        <td>{item.quantity}</td>
                        <td>${(item.price / 100).toFixed(2)}</td>
                        <td>${((item.quantity * item.price) / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Order Total and Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "15px",
                  borderTop: "2px solid #f0f0f0",
                }}
              >
                <div>
                  <strong style={{ fontSize: "18px", color: "#ff6b35" }}>
                    Total: ${(order.totalPrice / 100).toFixed(2)}
                  </strong>
                </div>
                <Link to={`/customer/order-details/${order._id}`}>
                  <button
                    style={{
                      backgroundColor: "#17a2b8",
                      color: "white",
                      border: "none",
                      padding: "8px 20px",
                      borderRadius: "6px",
                      fontSize: "14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FaEye /> View Details
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CustomerOrderHistory;
