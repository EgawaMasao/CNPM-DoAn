import React, { useState, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../../styles/checkout.css";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const location = useLocation();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [cardType, setCardType] = useState("");
  const [disablePayment, setDisablePayment] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null); // Store customer info
  const hasInitialized = useRef(false); // Prevent duplicate API calls

  const API_BASE_URL = "http://localhost:5004";
  const ORDER_SERVICE_URL = "http://localhost:5005";
  const AUTH_SERVICE_URL = "http://localhost:5001";

  // Get order data from navigation state or localStorage
  const pendingOrderData = location.state?.orderData || JSON.parse(localStorage.getItem('pendingOrder') || '{}');
  
  // Calculate amount in cents for Stripe (amount * 100)
  const totalAmount = pendingOrderData.totalPrice || 0;
  const amountInCents = Math.round(totalAmount * 100);

  // Prepare payment data - will be updated with customer info
  const orderData = {
    orderId: `ORDER${Date.now()}`,
    userId: pendingOrderData.customerId || "GUEST",
    amount: amountInCents / 100, // Convert back to dollars for display
    currency: "usd",
    firstName: customerInfo?.firstName || pendingOrderData.customerId?.split(' ')[0] || "Customer",
    lastName: customerInfo?.lastName || pendingOrderData.customerId?.split(' ')[1] || "",
    email: customerInfo?.email || "customer@example.com",
    phone: customerInfo?.phone || "+1234567890",
  };

  // Fetch customer profile data
  useEffect(() => {
    const fetchCustomerProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        console.log("📋 Fetching customer profile...");

        // Fetch customer profile from auth service
        const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/customer/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("✅ Customer profile loaded:", response.data);
        
        // Extract customer data from response
        const customer = response.data.data.customer || response.data.data;
        setCustomerInfo(customer);
      } catch (error) {
        console.error("❌ Error fetching customer profile:", error);
        // Continue with default values if profile fetch fails
      }
    };

    fetchCustomerProfile();
  }, []);

  useEffect(() => {
    // Prevent duplicate calls in React StrictMode
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    // Check if we have pending order data
    if (!pendingOrderData.items || pendingOrderData.items.length === 0) {
      setError("⚠️ No order data found. Please create an order first.");
      return;
    }
    
    createPaymentIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPaymentIntent = async () => {
    // Prevent duplicate calls
    if (clientSecret) {
      console.log("✅ Payment intent already exists, skipping creation");
      return;
    }
    
    try {
      console.log("🔄 Creating payment intent for order:", orderData.orderId);
      const response = await axios.post(`${API_BASE_URL}/api/payment/process`, orderData);
      console.log("✅ Response from payment API:", response.data);

      if (response.data.paymentStatus === "Paid" || response.data.disablePayment) {
        setMessage("✅ This order has already been paid successfully.");
        setDisablePayment(true);
        return;
      }

      if (response.data.clientSecret) {
        console.log("💳 Setting client secret:", response.data.clientSecret);
        setClientSecret(response.data.clientSecret);
      } else {
        setError("⚠️ No valid payment secret found.");
      }
    } catch (err) {
      console.error("Error creating PaymentIntent", err.response?.data || err.message);
      setError("❌ Failed to create payment. Please try again.");
    }
  };

  const handleCardChange = (event) => {
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
    if (event.brand) {
      setCardType(event.brand);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) {
      setError("⚠️ Payment secret is missing.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage("");

    const cardElement = elements.getElement(CardNumberElement);
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
      billing_details: {
        name: `${orderData.firstName} ${orderData.lastName}`,
        email: orderData.email,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    console.log("Using Client Secret:", clientSecret);
    if (!clientSecret.includes("_secret_")) {
      setError("⚠️ Invalid payment secret format.");
      setLoading(false);
      return;
    }

    try {
      const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod.id,
      });

      if (confirmError) {
        setError(confirmError.message);
      } else if (paymentIntent.status === "succeeded") {
        setMessage("✅ Payment Successful! Creating your order...");
        setDisablePayment(true);

        // Payment successful - Now create the order in database
        try {
          const token = localStorage.getItem('token'); // Fixed: was 'authToken', should be 'token'
          
          console.log("📦 Creating order in database...");
          console.log("Order data being sent:", JSON.stringify(pendingOrderData, null, 2));
          console.log("Order service URL:", ORDER_SERVICE_URL);
          console.log("Auth token exists:", !!token);
          
          const response = await axios.post(`${ORDER_SERVICE_URL}/api/orders`, pendingOrderData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
          });

          console.log("✅ Order created successfully:", response.data);
          setMessage("✅ Payment Successful! Order created successfully!");
          
          // Clear pending order from localStorage
          localStorage.removeItem('pendingOrder');
          
          // Clear cart (you can import clearCart from CartContext if needed)
          // For now, we'll clear it from localStorage
          localStorage.removeItem('cart');
          
          // Redirect to customer order history page after 2 seconds
          setTimeout(() => {
            navigate("/customer/order-history");
          }, 2000);

        } catch (orderError) {
          console.error("❌ Error creating order:", orderError);
          console.error("Error response:", orderError.response?.data);
          console.error("Error status:", orderError.response?.status);
          console.error("Error message:", orderError.message);
          setError("⚠️ Payment successful but failed to create order. Please contact support with payment ID: " + paymentIntent.id);
        }
      } else {
        setError("❌ Payment failed. Please try again.");
      }
    } catch (err) {
      setError("❌ An unexpected error occurred. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="checkout-container">
      <h2 className="checkout-title">Secure Payment</h2>
      
      {/* Order Summary */}
      {pendingOrderData.items && pendingOrderData.items.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "20px"
        }}>
          <h3 style={{ marginTop: 0 }}>Order Summary</h3>
          {customerInfo && (
            <>
              <p><strong>Customer:</strong> {customerInfo.firstName} {customerInfo.lastName}</p>
              <p><strong>Email:</strong> {customerInfo.email}</p>
              <p><strong>Phone:</strong> {customerInfo.phone}</p>
            </>
          )}
          <p><strong>Delivery Address:</strong> {pendingOrderData.deliveryAddress}</p>
          <p><strong>Items:</strong> {pendingOrderData.items.length} item(s)</p>
          <p style={{ fontSize: "24px", fontWeight: "bold", marginTop: "10px" }}>
            Total: ${orderData.amount.toFixed(2)}
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="checkout-form">
        <div className="input-group">
          <label>Card Number</label>
          <CardNumberElement className="stripe-input" onChange={handleCardChange} />
          {cardType && <span className={`card-icon ${cardType}`}></span>}
        </div>
        <div className="input-group">
          <label>Expiry Date</label>
          <CardExpiryElement className="stripe-input" onChange={handleCardChange} />
        </div>
        <div className="input-group">
          <label>CVC</label>
          <CardCvcElement className="stripe-input" onChange={handleCardChange} />
        </div>
        <button type="submit" disabled={!stripe || loading || disablePayment} className="checkout-btn">
          {loading ? <span className="spinner"></span> : `Pay $${orderData.amount.toFixed(2)}`}
        </button>
        {error && <div className="checkout-error">{error}</div>}
        {message && <div className="checkout-success">{message}</div>}
      </form>
    </div>
  );
};

const Checkout = () => {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
};

export default Checkout;
