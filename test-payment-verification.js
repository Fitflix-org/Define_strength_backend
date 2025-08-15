const axios = require("axios");

// Test payment verification endpoint
async function testPaymentVerification() {
  console.log("Testing payment verification endpoint...");

  try {
    // This is a test request to see if the endpoint validates correctly
    const response = await axios.post(
      "http://localhost:3001/payments/verify-payment",
      {
        razorpay_order_id: "order_test_123",
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: "signature_test_123",
      },
      {
        headers: {
          Authorization: "Bearer test_token",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Success:", response.data);
  } catch (error) {
    if (error.response) {
      console.log("Response status:", error.response.status);
      console.log("Response data:", error.response.data);

      // Check if it's validation error (which is expected with test data)
      if (
        error.response.status === 400 &&
        error.response.data.message === "Invalid Razorpay order ID"
      ) {
        console.log(
          "✅ Validation is working correctly - endpoint properly rejects invalid Razorpay order ID"
        );
      } else if (error.response.status === 401) {
        console.log(
          "✅ Authentication is working correctly - endpoint requires valid token"
        );
      } else {
        console.log("❌ Unexpected error:", error.response.data);
      }
    } else {
      console.log("❌ Network error:", error.message);
    }
  }
}

// Test the endpoint
testPaymentVerification();
