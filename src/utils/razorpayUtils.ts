import Razorpay from 'razorpay';
import crypto from 'crypto';

export function getRazorpayInstance() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export interface CreateOrderOptions {
  amount: number; // Amount in paise (1 INR = 100 paise)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface VerifyPaymentSignature {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Create a new Razorpay order
 */
export const createRazorpayOrder = async (options: CreateOrderOptions) => {
  try {
    const orderOptions = {
      amount: options.amount, // Amount in paise
      currency: options.currency || 'INR',
      receipt: options.receipt || `receipt_${Date.now()}`,
      notes: options.notes || {},
    };

    const order = await getRazorpayInstance().orders.create(orderOptions);
    return {
      success: true,
      order,
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    };
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyRazorpaySignature = (paymentData: VerifyPaymentSignature): boolean => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

    // Create expected signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    
    // Make sure the key secret is available
    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('RAZORPAY_KEY_SECRET is not defined in environment variables');
      return false;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    // Compare signatures
    const isValid = expectedSignature === razorpay_signature;
    
    // Log verification details for debugging
    console.log('Signature verification:', {
      expected: expectedSignature,
      received: razorpay_signature,
      isValid: isValid
    });
    
    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};

/**
 * Get payment details by payment ID
 */
export const getPaymentDetails = async (paymentId: string) => {
  try {
    const payment = await getRazorpayInstance().payments.fetch(paymentId);
    return {
      success: true,
      payment,
    };
  } catch (error) {
    console.error('Error fetching payment details:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment details',
    };
  }
};

/**
 * Refund a payment
 */
export const createRefund = async (paymentId: string, amount?: number, notes?: Record<string, string>) => {
  try {
    const refundOptions: any = {
      notes: notes || {},
    };

    if (amount) {
      refundOptions.amount = amount; // Amount in paise
    }

    const refund = await getRazorpayInstance().payments.refund(paymentId, refundOptions);
    return {
      success: true,
      refund,
    };
  } catch (error) {
    console.error('Error creating refund:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create refund',
    };
  }
};

/**
 * Get all orders with pagination
 */
export const getAllOrders = async (options: { from?: number; to?: number; count?: number; skip?: number } = {}) => {
  try {
    const orders = await getRazorpayInstance().orders.all(options);
    return {
      success: true,
      orders,
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orders',
    };
  }
};

/**
 * Get order details by order ID
 */
export const getOrderDetails = async (orderId: string) => {
  try {
    const order = await getRazorpayInstance().orders.fetch(orderId);
    return {
      success: true,
      order,
    };
  } catch (error) {
    console.error('Error fetching order details:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order details',
    };
  }
};

/**
 * Convert amount from INR to paise
 */
export const convertToPaise = (amountInINR: number): number => Math.round(amountInINR * 100);

/**
 * Convert amount from paise to INR
 */
export const convertToINR = (amountInPaise: number): number => amountInPaise / 100;
