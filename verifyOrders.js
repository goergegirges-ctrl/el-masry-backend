


async function verify() {
  console.log("Fetching active product...");
  const res = await fetch('http://localhost:4000/api/product/active');
  const d = await res.json();
  const product = d.data && d.data[0];
  if (!product) { console.warn("No product found, skipping order verify"); return; }
  
  const initialStock = product.stock;
  console.log(`Product "${product.name}" stock: ${initialStock}`);
  
  // Place Order
  console.log("Placing order...");
  const orderRes = await fetch('http://localhost:4000/api/order/place', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { firstName: "Test", lastName: "Test", email: "test@example.com", phone: "123" },
      items: [{ productId: product.id, name: product.name, price: 100, quantity: 1 }],
      shippingAddress: { street: "123", city: "Test", state: "Test", zip: "1" },
      subtotal: 100,
    })
  });
  const text = await orderRes.text();
  console.log("Order response text:", text);
  if (!orderRes.ok) return;
  const orderData = JSON.parse(text);
  console.log("Order placed:", orderData);
  const orderId = orderData.orderId;
  
  // Check stock after place
  const res2 = await fetch(`http://localhost:4000/api/product/${product.id}`);
  const d2 = await res2.json();
  console.log(`Stock after order (expected ${initialStock - 1}):`, d2.data.stock);
  
  // Cancel Order
  console.log("Cancelling order...");
  const cancelRes = await fetch('http://localhost:4000/api/order/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: orderId, status: "cancelled" })
  });
  const cancelData = await cancelRes.json();
  console.log("Order cancelled:", cancelData);
  
  // Check stock after cancel
  const res3 = await fetch(`http://localhost:4000/api/product/${product.id}`);
  const d3 = await res3.json();
  console.log(`Stock after cancel (expected ${initialStock}):`, d3.data.stock);
  
  // Test analytics
  const analyticsUrls = [
    '/api/admin/analytics/summary',
    '/api/admin/analytics/bestsellers',
    '/api/admin/analytics/wishlist',
    '/api/admin/analytics/categories',
    '/api/admin/analytics/inventory'
  ];
  for (const a of analyticsUrls) {
      const resA = await fetch(`http://localhost:4000${a}`);
      const dA = await resA.json();
      console.log(`Analytics ${a} success: ${dA.success}`);
  }
}

verify();
