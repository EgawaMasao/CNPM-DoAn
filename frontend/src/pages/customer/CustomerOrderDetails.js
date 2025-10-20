import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Alert } from "react-bootstrap";
import { FaArrowLeft, FaMapMarkerAlt, FaCalendarAlt, FaClock, FaReceipt, FaStore } from "react-icons/fa";
import { BsFilePdf } from "react-icons/bs";
import axios from "axios";
import { jsPDF } from "jspdf";

function CustomerOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.error("No authentication token found. Please login first.");
          navigate('/auth/login');
          return;
        }

        console.log("📦 Fetching order details for ID:", id);

        const response = await axios.get(`http://localhost:5005/api/orders/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("✅ Order details loaded:", response.data);
        setOrder(response.data);
        setLoading(false);
      } catch (error) {
        console.error("❌ Error fetching order details:", error);
        setError(error.response?.data?.message || "Failed to load order details.");
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [id, navigate]);

  // Format date and time
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Get status badge styling
  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return { bg: '#fff3cd', color: '#856404', border: '#ffc107' };
      case 'confirmed':
        return { bg: '#d1ecf1', color: '#0c5460', border: '#17a2b8' };
      case 'preparing':
        return { bg: '#fff3e0', color: '#e65100', border: '#fd7e14' };
      case 'out for delivery':
        return { bg: '#e7d7f5', color: '#4a148c', border: '#6f42c1' };
      case 'delivered':
        return { bg: '#d4edda', color: '#155724', border: '#28a745' };
      case 'canceled':
        return { bg: '#f8d7da', color: '#721c24', border: '#dc3545' };
      default:
        return { bg: '#e2e3e5', color: '#383d41', border: '#6c757d' };
    }
  };

  // Generate PDF receipt
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ORDER RECEIPT", pageWidth / 2, 25, { align: "center" });

    y = 50;

    // Order Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    doc.setFont("helvetica", "bold");
    doc.text(`Order #${order._id.slice(-8).toUpperCase()}`, 20, y);
    y += 10;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${formatDate(order.createdAt)}`, 20, y);
    y += 6;
    doc.text(`Time: ${formatTime(order.createdAt)}`, 20, y);
    y += 6;
    doc.text(`Status: ${order.status?.toUpperCase() || 'PENDING'}`, 20, y);
    y += 15;

    // Delivery Details
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Delivery Details", 20, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Customer: ${order.customerId}`, 20, y);
    y += 6;
    doc.text(`Restaurant: ${order.restaurantId}`, 20, y);
    y += 6;
    doc.text(`Address: ${order.deliveryAddress}`, 20, y);
    y += 15;

    // Items Header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Order Items", 20, y);
    y += 8;

    // Table Header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 5, 170, 8, 'F');
    doc.setFontSize(10);
    doc.text("Item", 25, y);
    doc.text("Qty", 120, y);
    doc.text("Price", 145, y);
    doc.text("Total", 170, y);
    y += 10;

    // Items
    doc.setFont("helvetica", "normal");
    order.items.forEach((item, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(item.foodId, 25, y);
      doc.text(item.quantity.toString(), 120, y);
      doc.text(`$${(item.price / 100).toFixed(2)}`, 145, y);
      doc.text(`$${((item.quantity * item.price) / 100).toFixed(2)}`, 170, y);
      y += 8;
    });

    // Total
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, 190, y);
    y += 8;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: $${(order.totalPrice / 100).toFixed(2)}`, 170, y, { align: "right" });

    // Footer
    y += 20;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(128, 128, 128);
    doc.text("Thank you for your order!", pageWidth / 2, y, { align: "center" });

    // Save PDF
    doc.save(`Order_${order._id.slice(-8).toUpperCase()}.pdf`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px", minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p style={{ marginTop: "20px", fontSize: "16px", color: "#666" }}>Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ padding: "40px", minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
        <div className="container" style={{ maxWidth: "800px" }}>
          <Alert variant="danger">
            {error || "Order not found"}
          </Alert>
          <Link to="/customer/order-history">
            <button
              style={{
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Back to Orders
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = getStatusStyle(order.status);

  return (
    <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh", padding: "30px 20px" }}>
      <div className="container" style={{ maxWidth: "900px" }}>
        
        {/* Back Button */}
        <Link 
          to="/customer/order-history"
          style={{
            textDecoration: "none",
            color: "#333",
            display: "inline-flex",
            alignItems: "center",
            marginBottom: "20px",
            fontSize: "16px",
            gap: "8px",
          }}
        >
          <FaArrowLeft /> Back to Order History
        </Link>

        {/* Main Order Card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "30px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
        >
          {/* Header with Order Number and Status */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "20px",
              borderBottom: "2px solid #e9ecef",
              marginBottom: "25px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "#333", fontSize: "28px" }}>
                Order #{order._id?.slice(-8).toUpperCase()}
              </h2>
              <div style={{ display: "flex", gap: "20px", marginTop: "10px", color: "#666" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaCalendarAlt /> {formatDate(order.createdAt)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaClock /> {formatTime(order.createdAt)}
                </span>
              </div>
            </div>
            <div>
              <div
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.color,
                  border: `2px solid ${statusStyle.border}`,
                  padding: "10px 20px",
                  borderRadius: "25px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                {order.status?.toUpperCase() || 'PENDING'}
              </div>
              <button
                onClick={generatePDF}
                style={{
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  cursor: "pointer",
                  marginTop: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <BsFilePdf /> Download PDF
              </button>
            </div>
          </div>

          {/* Delivery Information */}
          <div
            style={{
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "25px",
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>
              <FaReceipt style={{ marginRight: "8px" }} />
              Delivery Information
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div>
                <p style={{ margin: "5px 0", color: "#666", fontSize: "14px" }}>Customer</p>
                <p style={{ margin: "5px 0", fontSize: "16px", fontWeight: "500" }}>{order.customerId}</p>
              </div>
              <div>
                <p style={{ margin: "5px 0", color: "#666", fontSize: "14px" }}>
                  <FaStore style={{ marginRight: "4px" }} />
                  Restaurant
                </p>
                <p style={{ margin: "5px 0", fontSize: "16px", fontWeight: "500" }}>{order.restaurantId}</p>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ margin: "5px 0", color: "#666", fontSize: "14px" }}>
                  <FaMapMarkerAlt style={{ marginRight: "4px" }} />
                  Delivery Address
                </p>
                <p style={{ margin: "5px 0", fontSize: "16px", fontWeight: "500" }}>{order.deliveryAddress}</p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div style={{ marginBottom: "25px" }}>
            <h4 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>Order Items</h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8f9fa" }}>
                    <th style={{ padding: "12px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Item</th>
                    <th style={{ padding: "12px", textAlign: "center", borderBottom: "2px solid #dee2e6" }}>Quantity</th>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #dee2e6" }}>Price</th>
                    <th style={{ padding: "12px", textAlign: "right", borderBottom: "2px solid #dee2e6" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, index) => (
                    <tr key={`item-${index}`} style={{ borderBottom: "1px solid #e9ecef" }}>
                      <td style={{ padding: "15px" }}>{item.foodId}</td>
                      <td style={{ padding: "15px", textAlign: "center" }}>
                        <span
                          style={{
                            backgroundColor: "#e7f3ff",
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "14px",
                            fontWeight: "500",
                          }}
                        >
                          ×{item.quantity}
                        </span>
                      </td>
                      <td style={{ padding: "15px", textAlign: "right" }}>${(item.price / 100).toFixed(2)}</td>
                      <td style={{ padding: "15px", textAlign: "right", fontWeight: "500" }}>
                        ${((item.quantity * item.price) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Total */}
          <div
            style={{
              borderTop: "2px solid #e9ecef",
              paddingTop: "20px",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "5px 0", color: "#666", fontSize: "16px" }}>Total Amount</p>
              <p style={{ margin: "5px 0", fontSize: "32px", fontWeight: "bold", color: "#ff6b35" }}>
                ${(order.totalPrice / 100).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Order Status Timeline (Optional Enhancement) */}
          {order.status && (
            <div
              style={{
                marginTop: "30px",
                padding: "20px",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px",
              }}
            >
              <h5 style={{ marginTop: 0, marginBottom: "15px" }}>Order Status</h5>
              <p style={{ color: "#666", marginBottom: 0 }}>
                Current status: <strong style={{ color: statusStyle.color }}>{order.status}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerOrderDetails;
