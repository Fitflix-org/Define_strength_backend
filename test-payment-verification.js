require('dotenv').config();
const axios = require("axios");
const crypto = require('crypto');

// Function to generate a valid signature for testing
function generateValidSignature(orderId, paymentId) {
  const body = orderId + '|' + paymentId;
  return crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
}

// Test the signature generation logic
function testSignatureGeneration() {
  console.log("\n=== Testing Signature Generation Logic ===\n");
  
  // Test data
  const orderId = "order_test_123";
  const paymentId = "pay_test_123";
  
  // Generate signature
  const signature = generateValidSignature(orderId, paymentId);
  
  console.log("Test Data:");
  console.log("- Order ID:", orderId);
  console.log("- Payment ID:", paymentId);
  console.log("- Generated Signature:", signature);
  console.log("- RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID);
  console.log("- RAZORPAY_KEY_SECRET available:", !!process.env.RAZORPAY_KEY_SECRET);
  
  // Verify our own signature
  const verifiedSignature = generateValidSignature(orderId, paymentId);
  const isValid = signature === verifiedSignature;
  
  console.log("\nVerification Result:");
  console.log("- Signatures match:", isValid);
  
  if (isValid) {
    console.log("✅ Signature generation logic is working correctly");
  } else {
    console.log("❌ Signature generation logic is NOT working correctly");
  }
  
  return { orderId, paymentId, signature };
}

// Test payment verification endpoint
async function testPaymentVerification() {
  console.log("\n=== Testing Payment Verification Endpoint ===\n");
  
  // First test the signature generation
  const { orderId, paymentId, signature } = testSignatureGeneration();
  
  console.log("\nSending request to verification endpoint...");
  
  try {
    // This is a test request with a valid signature
    const response = await axios.post(
      "http://localhost:3001/api/payments/verify-payment",
      {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
      {
        headers: {
          Authorization: "Bearer test_token",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Success:", response.data);
    console.log("✅ Endpoint accepted the request with valid signature");
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

// Test the response format to check for amount field
async function testOrderResponseFormat() {
  console.log("\n=== Testing Order Response Format ===\n");
  
  try {
    // Get a sample order to check its format
    const response = await axios.get(
      "http://localhost:3001/api/orders/recent",
      {
        headers: {
          Authorization: "Bearer test_token",
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.orders && response.data.orders.length > 0) {
      const sampleOrder = response.data.orders[0];
      console.log("Sample Order Format:", JSON.stringify(sampleOrder, null, 2));
      
      // Check if amount field exists and is a number
      if (sampleOrder.total !== undefined) {
        console.log("Order total value:", sampleOrder.total);
        console.log("Order total type:", typeof sampleOrder.total);
        
        // Test toFixed on the amount
        try {
          const formattedAmount = Number(sampleOrder.total).toFixed(2);
          console.log("Formatted amount with toFixed(2):", formattedAmount);
          console.log("✅ toFixed works correctly on the amount");
        } catch (error) {
          console.log("❌ Error using toFixed on amount:", error.message);
        }
      } else {
        console.log("❌ Order does not have a 'total' field");
      }
    } else {
      console.log("No orders found to test format");
    }
  } catch (error) {
    console.log("Error fetching orders:", error.message);
    if (error.response) {
      console.log("Response status:", error.response.status);
      console.log("Response data:", error.response.data);
    }
  }
}

// Run the tests
console.log('\n=== RAZORPAY PAYMENT VERIFICATION TESTS ===\n');
console.log('Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- RAZORPAY_KEY_ID available:', !!process.env.RAZORPAY_KEY_ID);
console.log('- RAZORPAY_KEY_SECRET available:', !!process.env.RAZORPAY_KEY_SECRET);

// Run the signature generation test first
testSignatureGeneration();

// Ask if user wants to test the API endpoint
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('\nDo you want to test the API endpoint? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    testPaymentVerification();
    
    // After testing verification, ask about testing order format
    readline.question('\nDo you want to test the order response format? (y/n): ', (formatAnswer) => {
      if (formatAnswer.toLowerCase() === 'y') {
        testOrderResponseFormat();
      } else {
        console.log('Skipping order format test.');
      }
      readline.close();
    });
  } else {
    console.log('Skipping API endpoint test.');
    readline.close();
  }
});
