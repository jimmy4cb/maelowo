import { withSupabase } from 'npm:@supabase/server@^1'

const deliveryFee = 350
const taxRate = 0.105

type CartLine = {
  id: string
  qty: number
}

type PaymentRequest = {
  reference?: unknown
  items?: unknown
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'POST') {
      return jsonError('Method not allowed.', 405)
    }

    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecret) {
      console.error('PAYSTACK_SECRET_KEY is not configured for the payment verification function.')
      return jsonError('Payment verification is not configured. Contact the store.', 503)
    }

    let payload: PaymentRequest
    try {
      payload = await request.json()
    } catch {
      return jsonError('Invalid request body.', 400)
    }

    if (
      typeof payload.reference !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(payload.reference)
    ) {
      return jsonError('A valid payment reference is required.', 400)
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 100) {
      return jsonError('The order must contain at least one item.', 400)
    }

    const quantities = new Map<string, number>()
    for (const value of payload.items) {
      if (
        typeof value !== 'object' ||
        value === null ||
        !('id' in value) ||
        !('qty' in value) ||
        typeof value.id !== 'string' ||
        typeof value.qty !== 'number' ||
        !Number.isInteger(value.qty) ||
        value.qty < 1 ||
        value.qty > 99
      ) {
        return jsonError('The order contains an invalid product or quantity.', 400)
      }
      quantities.set(value.id, (quantities.get(value.id) ?? 0) + value.qty)
      if ((quantities.get(value.id) ?? 0) > 99) {
        return jsonError('The requested quantity is too large.', 400)
      }
    }

    const reference = payload.reference
    const userId = context.userClaims.sub
    const userEmail = context.userClaims.email
    if (!userId || !userEmail) {
      return jsonError('A signed-in user with an email address is required.', 401)
    }

    const { data: existingOrder, error: existingOrderError } = await context.supabaseAdmin
      .from('orders')
      .select('id, user_id, total, currency')
      .eq('provider_reference', reference)
      .maybeSingle()
    if (existingOrderError) {
      console.error('Could not check for an existing order.', existingOrderError)
      return jsonError('Could not verify the order. Try again.', 500)
    }
    if (existingOrder) {
      if (existingOrder.user_id !== userId) {
        return jsonError('This payment reference is already linked to another order.', 409)
      }
      return Response.json({
        verified: true,
        orderId: existingOrder.id,
        total: existingOrder.total,
        currency: existingOrder.currency
      })
    }

    const productIds = [...quantities.keys()]
    const { data: products, error: productsError } = await context.supabase
      .from('products')
      .select('id, name, price, active')
      .in('id', productIds)
      .eq('active', true)
    if (productsError) {
      console.error('Could not load product prices for order verification.', productsError)
      return jsonError('Could not verify current product prices. Try again.', 500)
    }
    if (!products || products.length !== productIds.length) {
      return jsonError('One or more products are no longer available.', 409)
    }

    const orderItems = products.map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      qty: quantities.get(product.id) as number
    }))
    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0)
    const tax = Math.round(subtotal * taxRate)
    const total = subtotal + deliveryFee + tax

    let paystackResponse: Response
    try {
      paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${paystackSecret}` } }
      )
    } catch (error) {
      console.error('Paystack verification request failed.', error)
      return jsonError('Could not reach the payment provider. Try again.', 502)
    }
    if (!paystackResponse.ok) {
      console.error('Paystack returned a non-success response.', paystackResponse.status)
      return jsonError('The payment provider could not verify this transaction.', 502)
    }

    const verification = await paystackResponse.json()
    const transaction = verification?.data
    if (
      verification?.status !== true ||
      transaction?.status !== 'success' ||
      transaction?.reference !== reference ||
      transaction?.currency !== 'KES' ||
      transaction?.amount !== total * 100 ||
      String(transaction?.customer?.email ?? '').toLowerCase() !== userEmail.toLowerCase()
    ) {
      return jsonError('Payment details do not match this order. Do not retry payment; contact the store.', 409)
    }

    const { data: order, error: insertError } = await context.supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        provider_reference: reference,
        customer_email: userEmail,
        currency: 'KES',
        items: orderItems,
        subtotal,
        delivery_fee: deliveryFee,
        tax,
        total,
        payment_status: 'paid'
      })
      .select('id, total, currency')
      .single()
    if (insertError) {
      console.error('Verified payment could not be saved as an order.', insertError)
      return jsonError('Payment was verified, but the order could not be recorded. Contact the store with your payment reference.', 500)
    }

    return Response.json({
      verified: true,
      orderId: order.id,
      total: order.total,
      currency: order.currency
    })
  })
}
