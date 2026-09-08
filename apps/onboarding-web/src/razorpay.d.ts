/** Razorpay Checkout (loaded from checkout.razorpay.com/v1/checkout.js). */
interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount?: number;
  currency?: string;
  order_id?: string;
  name?: string;
  description?: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: { email?: string; contact?: string; name?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

declare class Razorpay {
  constructor(options: RazorpayOptions);
  open(): void;
}
