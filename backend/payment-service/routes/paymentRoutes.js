const express = require("express");
const router = express.Router();
const Payment = require("../models/PaymentModel");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
require("dotenv").config();
const { sendSmsNotification } = require("../utils/twilioService"); // Import Twilio service

router.post("/process", async (req, res) => {
  try {
    const { orderId, userId, amount, currency, email, phone } = req.body; 

    // Validate required fields
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    console.log(`Processing payment request for order ${orderId}`);

    // Check if a payment record already exists for this order.
    let payment = await Payment.findOne({ orderId });
    if (payment && payment.stripeClientSecret) {
      console.log("Existing Payment Found:", payment);
      if (payment.status === "Paid") {
        return res.status(200).json({
          message: "✅ This order has already been paid successfully.",
          paymentStatus: "Paid",
          disablePayment: true,
        });
      }
      
      // For pending payments, check if the payment intent is still valid
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
        if (existingIntent && existingIntent.status === 'requires_payment_method') {
          // Payment intent is still valid and can be reused
          console.log("✅ Reusing existing valid payment intent");
          return res.json({
            clientSecret: payment.stripeClientSecret,
            paymentId: payment._id,
            disablePayment: false,
          });
        }
      } catch (err) {
        console.log("⚠️ Old payment intent invalid or expired, creating new one");
      }
      
      // If we get here, old payment intent is expired/invalid - cancel it and create new one
      try {
        await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
        console.log("🗑️ Cancelled old payment intent");
      } catch (err) {
        console.log("Could not cancel old payment intent (may already be expired):", err.message);
      }
      
      // Delete old payment record so we can create a fresh one
      await Payment.deleteOne({ orderId });
      console.log("🗑️ Deleted old payment record");
    }

    // Create a new PaymentIntent.
    const amountInCents = Math.round(parseFloat(amount) * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency || "usd",
      metadata: { orderId, userId },
      receipt_email: email,
    });
    console.log("✅ Created PaymentIntent:", paymentIntent);

    // Create a new Payment record.
    payment = new Payment({
      orderId,
      userId,
      amount,
      currency: currency || "usd",
      status: "Pending",
      stripePaymentIntentId: paymentIntent.id, // store only the id (without secret)
      stripeClientSecret: paymentIntent.client_secret, // store client secret for frontend
      phone, // Use `phone` to match the schema
      email,
    });
    await payment.save();
    console.log("Stored Payment Record:", payment);

    // Send SMS notification
    // const message = `Your payment of $${orderId} has been processed successfully.`;
    // await sendSmsNotification(phone, message);

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: payment._id,
      disablePayment: false,
    });
  } catch (error) {
    // If duplicate key error occurs, recover gracefully.
    if (error.code === 11000) {
      let existingPayment = await Payment.findOne({ orderId: req.body.orderId });
      if (existingPayment) {
        console.log("⚠️ Duplicate detected; checking payment status:", existingPayment);
        if (existingPayment.status === "Paid") {
          return res.status(200).json({
            message: "✅ This order has already been paid successfully.",
            paymentStatus: "Paid",
            disablePayment: true,
          });
        }
        
        // Verify the payment intent is still valid before returning it
        try {
          const existingIntent = await stripe.paymentIntents.retrieve(existingPayment.stripePaymentIntentId);
          if (existingIntent && existingIntent.status === 'requires_payment_method') {
            console.log("✅ Returning valid existing payment intent");
            return res.json({
              clientSecret: existingPayment.stripeClientSecret,
              paymentId: existingPayment._id,
              disablePayment: false,
            });
          }
        } catch (err) {
          console.log("⚠️ Existing payment intent invalid, client should retry");
          return res.status(409).json({ 
            error: "Payment intent expired. Please refresh the page and try again.",
            shouldRetry: true 
          });
        }
      }
      return res.status(500).json({ error: "Duplicate key error but no payment record found." });
    }
    console.error("❌ Stripe Payment processing error:", error.message);
    res.status(500).json({ error: "❌ Payment processing failed. Please try again." });
  }
});

module.exports = router;
