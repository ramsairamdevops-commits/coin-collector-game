const functions = require("firebase-functions");
const Razorpay = require("razorpay");
const crypto = require("crypto");

exports.verifyPayment = functions.https.onCall((data, context) => {

  const secret = "YOUR_RAZORPAY_SECRET";

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(data.order_id + "|" + data.payment_id)
    .digest("hex");

  if (generatedSignature === data.signature) {
    return { status: "success" };
  } else {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Payment verification failed"
    );
  }
});
