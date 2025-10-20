import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { BsArrowLeftCircle } from "react-icons/bs";
import { CartContext } from "../contexts/CartContext";

function CreateOrderFromCart() {
  const { cartItems, clearCart } = useContext(CartContext);
  const navigate = useNavigate();
  
  const [orderData, setOrderData] = useState({
    customerId: "",
    restaurantId: "",
    deliveryAddress: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);

  // Get token from localStorage
  const token = localStorage.getItem('token');

  // Calculate total price from cart items
  const totalPrice = cartItems.reduce((total, item) => total + item.price, 0);

  // Group cart items by restaurant to get the restaurantId
  const getRestaurantId = () => {
    if (cartItems.length > 0) {
      // Assuming all items in cart are from the same restaurant
      return cartItems[0].restaurantId || "";
    }
    return "";
  };

  // Get restaurant name from state
  const getRestaurantName = () => {
    return restaurantName || "Loading restaurant...";
  };

  // Load customer name and restaurant name when component mounts
  useEffect(() => {
    const getCustomerName = async () => {
      setIsLoadingCustomer(true);
      try {
        if (!token) {
          console.log("No token found in localStorage");
          setCustomerName("No Token Found");
          setIsLoadingCustomer(false);
          return;
        }

        console.log("Token found:", token.substring(0, 50) + "...");

        // Decode JWT token to get customer ID
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        const customerId = tokenPayload.id;
        console.log("Customer ID from token:", customerId);
        console.log("Token payload:", tokenPayload);
        
        // Try the correct authenticated endpoint first, then fallbacks
        const possibleEndpoints = [
          `http://localhost:5001/api/auth/customer/profile`, // Correct authenticated endpoint
          `http://localhost:5001/api/auth/customer/${customerId}`,
          `http://localhost:5001/api/customers/${customerId}`,
          `http://localhost:5001/api/auth/customers/${customerId}`,
          `http://localhost:5001/api/users/${customerId}`
        ];

        let customerData = null;
        
        for (const endpoint of possibleEndpoints) {
          try {
            console.log("Trying endpoint:", endpoint);
            const response = await axios.get(endpoint, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            console.log("Success with endpoint:", endpoint);
            console.log("Customer response:", response.data);
            customerData = response.data;
            break;
          } catch (endpointError) {
            console.log("Failed endpoint:", endpoint, endpointError.response?.status);
            continue;
          }
        }

        if (customerData) {
          // Handle nested response structure from auth service
          let customer = customerData;
          if (customerData.data && customerData.data.customer) {
            customer = customerData.data.customer;
          } else if (customerData.customer) {
            customer = customerData.customer;
          }
          
          console.log("Processed customer object:", customer);
          
          // Try different possible field combinations for customer name
          let customerName = "";
          
          // Priority 1: firstName + lastName
          if (customer.firstName || customer.lastName) {
            const firstName = customer.firstName || "";
            const lastName = customer.lastName || "";
            customerName = `${firstName} ${lastName}`.trim();
          }
          // Priority 2: Other name fields
          else if (customer.name) {
            customerName = customer.name;
          }
          else if (customer.fullName) {
            customerName = customer.fullName;
          }
          else if (customer.username) {
            customerName = customer.username;
          }
          else if (customer.email) {
            customerName = customer.email;
          }
          else {
            customerName = "Customer";
          }
          
          console.log("Final customer name:", customerName);
          setCustomerName(customerName);
          setOrderData(prev => ({ ...prev, customerId: customerName }));
        } else {
          console.error("No customer data found from any endpoint, using token data");
          console.log("Token payload details:", tokenPayload);
          
          // Fallback: try to use data from token payload
          let fallbackName = "";
          
          // Check token payload for firstName + lastName
          if (tokenPayload.firstName || tokenPayload.lastName) {
            const firstName = tokenPayload.firstName || "";
            const lastName = tokenPayload.lastName || "";
            fallbackName = `${firstName} ${lastName}`.trim();
            console.log("Using firstName + lastName from token:", fallbackName);
          } else {
            fallbackName = tokenPayload.name || tokenPayload.username || tokenPayload.email || `Customer_${customerId.substring(0, 8)}`;
            console.log("Using fallback name from token:", fallbackName);
          }
          
          setCustomerName(fallbackName);
          setOrderData(prev => ({ ...prev, customerId: fallbackName }));
        }
      } catch (error) {
        console.error("Error decoding token:", error);
        setCustomerName("Token Error");
      } finally {
        setIsLoadingCustomer(false);
      }
    };

    const getRestaurantDetails = async () => {
      // Get restaurant ID from cart items
      const restaurantId = cartItems.length > 0 ? cartItems[0].restaurantId : "";
      console.log("Cart items:", cartItems);
      console.log("Restaurant ID from cart:", restaurantId);
      
      if (restaurantId) {
        try {
          const response = await axios.get('http://localhost:5002/api/restaurant/all');
          console.log("Restaurant response:", response.data);
          const restaurant = response.data.restaurants?.find(r => r._id === restaurantId);
          console.log("Found restaurant:", restaurant);
          
          if (restaurant) {
            setRestaurantName(restaurant.name);
            setOrderData(prev => ({ ...prev, restaurantId: restaurant._id }));
          } else {
            setRestaurantName("Unknown Restaurant");
          }
        } catch (error) {
          console.error("Error fetching restaurant details:", error);
          setRestaurantName("Unknown Restaurant");
        }
      } else {
        setRestaurantName("No Restaurant Selected");
      }
    };

    getCustomerName();
    getRestaurantDetails();
  }, [token, cartItems]);

  const validateForm = () => {
    if (!orderData.customerId.trim()) {
      setError("Customer name is required");
      return false;
    }
    if (!orderData.deliveryAddress.trim()) {
      setError("Delivery address is required");
      return false;
    }
    if (cartItems.length === 0) {
      setError("Cart is empty. Please add items to cart first.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      // Transform cart items to order items format
      const orderItems = cartItems.map(item => ({
        foodId: item._id,
        quantity: 1, // Default quantity to 1, you can modify this if you track quantities
        price: item.price
      }));

      // Calculate total price
      const totalPrice = orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      // Prepare order data to pass to payment page
      const orderPayload = {
        customerId: orderData.customerId,
        restaurantId: orderData.restaurantId || getRestaurantId(),
        items: orderItems,
        deliveryAddress: orderData.deliveryAddress,
        totalPrice: totalPrice
      };

      console.log("=== REDIRECTING TO PAYMENT ===");
      console.log("Order payload:", JSON.stringify(orderPayload, null, 2));
      console.log("Total price:", totalPrice);

      // Store order data in localStorage to pass to payment page
      localStorage.setItem('pendingOrder', JSON.stringify(orderPayload));
      
      // Redirect to payment page
      // The payment page will create the order after successful payment
      navigate("/checkout", { 
        state: { 
          orderData: orderPayload,
          fromCart: true 
        } 
      });

    } catch (error) {
      console.error("Error preparing order:", error);
      setError("Failed to prepare order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setOrderData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px 0",
      }}
    >
      {/* Back Button */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
        <button
          onClick={() => navigate("/customer/cart")}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            border: "none",
            borderRadius: "50px",
            padding: "12px 20px",
            color: "white",
            fontSize: "16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "30px",
            backdropFilter: "blur(10px)",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
            e.target.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
            e.target.style.transform = "translateY(0)";
          }}
        >
          <BsArrowLeftCircle size={20} />
          Back to Cart
        </button>
      </div>

      <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 20px" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: window.innerWidth <= 1024 ? "1fr" : "1.2fr 1fr", 
          gap: window.innerWidth <= 1024 ? "20px" : "40px", 
          alignItems: "start"
        }}>
          
          {/* Left Side - Order Summary */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: "30px" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  backgroundColor: "#ff7f50",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "15px",
                }}
              >
                <span style={{ fontSize: "24px" }}>🛒</span>
              </div>
              <h2 style={{ color: "#333", fontSize: "28px", fontWeight: "700", margin: 0 }}>
                Order Summary
              </h2>
            </div>

            {/* Cart Items */}
            <div style={{ marginBottom: "30px" }}>
              {cartItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "15px 0",
                    borderBottom: index < cartItems.length - 1 ? "1px solid #eee" : "none",
                  }}
                >
                  <img
                    src={
                      item.image 
                        ? `http://localhost:5002${item.image}`
                        : "https://placehold.co/60x60?text=Food"
                    }
                    alt={item.name}
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "12px",
                      objectFit: "cover",
                      marginRight: "15px",
                    }}
                    onError={(e) => {
                      e.target.src = "https://placehold.co/60x60?text=Food";
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: "#333", fontSize: "16px", fontWeight: "600", margin: "0 0 5px 0" }}>
                      {item.name}
                    </h4>
                    <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
                      {item.category}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#ff7f50", fontSize: "18px", fontWeight: "700", margin: 0 }}>
                      {item.price.toLocaleString()} VND
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div
              style={{
                backgroundColor: "#f8f9fa",
                borderRadius: "15px",
                padding: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "20px", fontWeight: "600", color: "#333" }}>Total Amount:</span>
              <span style={{ fontSize: "28px", fontWeight: "700", color: "#ff7f50" }}>
                {totalPrice.toLocaleString()} VND
              </span>
            </div>
          </div>

          {/* Right Side - Order Form */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "20px",
              padding: "30px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
              backdropFilter: "blur(10px)",
              minHeight: "600px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: "30px" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  backgroundColor: "#667eea",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "15px",
                }}
              >
                <span style={{ fontSize: "24px" }}>📝</span>
              </div>
              <h2 style={{ color: "#333", fontSize: "28px", fontWeight: "700", margin: 0 }}>
                Delivery Details
              </h2>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div
                style={{
                  backgroundColor: "#fee",
                  color: "#c33",
                  padding: "15px",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  border: "1px solid #fcc",
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                style={{
                  backgroundColor: "#efe",
                  color: "#3c3",
                  padding: "15px",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  border: "1px solid #cfc",
                }}
              >
                {success}
              </div>
            )}

            {/* Order Form */}
            <div style={{ height: "100%" }}>
              {/* Customer Name */}
              <div style={{ marginBottom: "25px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  color: "#333" 
                }}>
                  👤 Customer Name
                </label>
                <div
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #eee",
                    borderRadius: "12px",
                    fontSize: "16px",
                    backgroundColor: "#f8f9fa",
                    color: "#666",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    minHeight: "54px",
                  }}
                >
                  {isLoadingCustomer ? "Loading customer name..." : (customerName || "Customer name not available")}
                </div>
                {/* Debug info for customer name */}
                {!isLoadingCustomer && !customerName && (
                  <div style={{ fontSize: "12px", color: "#999", marginTop: "5px" }}>
                    Debug: Check browser console for detailed logs
                  </div>
                )}
              </div>

              {/* Restaurant Name */}
              <div style={{ marginBottom: "25px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  color: "#333" 
                }}>
                  🏪 Restaurant Name
                </label>
                <div
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #eee",
                    borderRadius: "12px",
                    fontSize: "16px",
                    backgroundColor: "#f8f9fa",
                    color: "#666",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    minHeight: "54px",
                  }}
                >
                  {getRestaurantName()}
                </div>
                {/* Hidden input for restaurantId */}
                <input
                  type="hidden"
                  name="restaurantId"
                  value={orderData.restaurantId || getRestaurantId()}
                />
              </div>

              {/* Delivery Address */}
              <div style={{ marginBottom: "30px" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "8px", 
                  fontSize: "16px", 
                  fontWeight: "600", 
                  color: "#333" 
                }}>
                  📍 Delivery Address
                </label>
                <textarea
                  name="deliveryAddress"
                  value={orderData.deliveryAddress}
                  onChange={handleInputChange}
                  placeholder="Enter your complete delivery address..."
                  required
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "15px",
                    border: "2px solid #eee",
                    borderRadius: "12px",
                    fontSize: "16px",
                    transition: "border-color 0.3s ease",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#667eea";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#eee";
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={loading || cartItems.length === 0}
                style={{
                  width: "100%",
                  padding: "18px",
                  backgroundColor: loading ? "#ccc" : "#ff7f50",
                  color: "white",
                  border: "none",
                  borderRadius: "15px",
                  fontSize: "18px",
                  fontWeight: "700",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: "0 10px 20px rgba(255, 127, 80, 0.3)",
                  boxSizing: "border-box",
                  marginTop: "auto",
                }}
                onMouseEnter={(e) => {
                  if (!loading && cartItems.length > 0) {
                    e.target.style.backgroundColor = "#ff5722";
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 15px 30px rgba(255, 127, 80, 0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && cartItems.length > 0) {
                    e.target.style.backgroundColor = "#ff7f50";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 10px 20px rgba(255, 127, 80, 0.3)";
                  }
                }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        border: "2px solid transparent",
                        borderTop: "2px solid white",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Creating Order...
                  </span>
                ) : (
                  `🍽️ Place Order • ${totalPrice.toLocaleString()} VND`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default CreateOrderFromCart;