const Invoice = require('../models/Invoice');
const razorpayService = require('../services/razorpay.service');
const { ApiResponse, ApiError, asyncHandler, INVOICE_STATUS } = require('@sparkcrm/shared-utils');
const axios = require('axios');


const stripeService = require('../services/stripe.service');
const { generateInvoicePdf } = require('../services/invoicePdf.service');
const { uploadBufferToR2 } = require('@sparkcrm/shared-utils');
const { env } = require('@sparkcrm/shared-config');
const {
    getTenantPaymentMethods,
    assertTenantPaymentMethod,
} = require('../services/paymentMethods.service');
const { getActivePaymentConfig, getProviderCredentials } = require('../services/paymentConfig.service');
const { finalizeInvoicePayment } = require('../services/paymentLifecycle.service');
const { toMinorUnits } = require('../services/money.service');
const { createTenantServiceHeaders } = require('../middleware/serviceAuth.middleware');

/**
 * GET /api/billing/available-methods
 * Return globally active methods filtered by the Owner's tenant policy.
 */
const getAvailablePaymentMethods = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    try {
        const availability = await getTenantPaymentMethods(tenantId);
        ApiResponse.success(res, availability, 'Available payment methods fetched');
    } catch (error) {
        throw ApiError.internal(`Unable to load payment methods: ${error.message}`);
    }
});

/**
 * POST /api/billing/subscribe
 * Create a subscription order (Razorpay or Stripe)
 */
const createSubscription = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const {
        planSlug,
        billingCycle,
        provider = 'razorpay',
        paymentMethod = 'card',
    } = req.body;

    if (!planSlug) throw ApiError.badRequest('Plan slug is required');
    if (!['monthly', 'yearly'].includes(billingCycle)) throw ApiError.badRequest('Invalid billing cycle');

    try {
        await assertTenantPaymentMethod(tenantId, paymentMethod, provider);
    } catch (error) {
        if (error.code === 'PAYMENT_METHOD_NOT_AVAILABLE') {
            throw ApiError.forbidden(error.message);
        }
        throw ApiError.internal(`Unable to validate payment method: ${error.message}`);
    }

    // 1. Fetch Plan details from Tenant Service via internal API
    const tenantServiceUrl = env.SERVICES.TENANT || 'http://localhost:8002';
    let plan;
    try {
        const path = `/internal/plans/${encodeURIComponent(planSlug)}`;
        const headers = createTenantServiceHeaders('GET', path, { tenantId: String(tenantId) });
        const planRes = await axios.get(`${tenantServiceUrl}${path}`, { timeout: 5000, headers });
        plan = planRes.data?.data;
    } catch (err) {
        if (err.response?.status === 404) throw ApiError.notFound('Plan not found');
        throw ApiError.internal(`Failed to fetch plan details: ${err.message}`);
    }
    if (!plan) throw ApiError.notFound('Plan not found');

    const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
    if (amount === 0) throw ApiError.badRequest('Cannot subscribe to a free plan via payment gateway');

    // 2. Fetch active payment configuration for the requested provider
    const paymentConfig = await getActivePaymentConfig(provider);
    const providerCredentials = getProviderCredentials(paymentConfig);

    // 3. Initiate payment session based on provider
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const tax = Math.round(amount * 0.18);
    const total = amount + tax;
    const currency = String(plan.currency || 'INR').toUpperCase();
    const subtotalMinor = toMinorUnits(amount, currency);
    const taxMinor = toMinorUnits(tax, currency);
    const totalMinor = toMinorUnits(total, currency);

    let responsePayload = {
        invoiceNumber,
        provider,
        amount: total,
        currency,
    };

    let gatewayOrderId = null;
    let qrCode = null;
    if (paymentMethod === 'google_pay_qr' && provider !== 'razorpay') {
        throw ApiError.badRequest('Google Pay QR is available only through Razorpay');
    }
    if (paymentMethod === 'google_pay_qr' && currency !== 'INR') {
        throw ApiError.badRequest('Google Pay QR is available only for INR payments');
    }

    if (provider === 'razorpay') {
        const { keyId: rzpKeyId, keySecret: rzpSecret } = providerCredentials;

        try {
            if (paymentMethod === 'google_pay_qr') {
                qrCode = await razorpayService.createAdhocQrCode(
                    rzpKeyId,
                    rzpSecret,
                    {
                        amount: total,
                        name: `SparkCRM ${plan.name}`,
                        description: `${plan.name} plan - ${billingCycle}`,
                        notes: { tenantId: tenantId.toString(), planSlug, billingCycle, invoiceNumber },
                    }
                );
                gatewayOrderId = qrCode.id;
                responsePayload.qrCodeId = qrCode.id;
                responsePayload.qrImageUrl = qrCode.image_url;
                responsePayload.qrExpiresAt = new Date(qrCode.close_by * 1000);
            } else {
                const order = await razorpayService.createAdhocOrder(
                    rzpKeyId,
                    rzpSecret,
                    {
                        amount: total,
                        currency,
                        receipt: invoiceNumber,
                        notes: { tenantId: tenantId.toString(), planSlug, billingCycle, paymentMethod },
                    }
                );
                gatewayOrderId = order.id;
                responsePayload.orderId = order.id;
                responsePayload.amount = order.amount;
                responsePayload.currency = order.currency;
                responsePayload.razorpayKeyId = rzpKeyId; // Public checkout key
            }
        } catch (rzpErr) {
            console.error('[createSubscription] Razorpay payment creation failed:', rzpErr.message, rzpErr.statusCode || '');
            if (rzpErr.statusCode === 401 || rzpErr.response?.status === 401 || rzpErr.message?.includes('unauthorized') || rzpErr.message?.includes('401')) {
                throw ApiError.badRequest('Razorpay API authentication failed. Please verify that valid API keys are configured in the payment settings.');
            }
            throw ApiError.internal(`Razorpay payment creation failed: ${rzpErr.response?.data?.error?.description || rzpErr.message}`);
        }
    } else if (provider === 'stripe') {
        const { publishableKey, secretKey } = providerCredentials;

        const session = await stripeService.createCheckoutSession(
            secretKey,
            {
                amount: total,
                currency,
                name: `${plan.name} Plan - ${billingCycle}`,
                tenantId: tenantId.toString(),
                planSlug,
                billingCycle,
                paymentMethod,
                successUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?canceled=true`,
            }
        );
        gatewayOrderId = session.id;
        responsePayload.sessionId = session.id;
        responsePayload.sessionUrl = session.url;
        responsePayload.stripePublishableKey = publishableKey;
    } else {
        throw ApiError.badRequest('Unsupported payment provider');
    }

    // 4. Create a pending invoice
    const invoice = await Invoice.create({
        tenantId,
        invoiceNumber,
        type: 'subscription',
        description: `${plan.name} plan - ${billingCycle}`,
        planId: plan._id,
        planSlug: plan.slug,
        billingCycle,
        paymentProvider: provider,
        paymentMethod,
        items: [{ name: `${plan.name} Plan`, quantity: 1, unitPrice: amount, total: amount }],
        subtotal: amount,
        tax,
        total,
        subtotalMinor,
        taxMinor,
        totalMinor,
        currency,
        checkoutStatus: 'ready',
        razorpayOrderId: provider === 'razorpay' && paymentMethod !== 'google_pay_qr' ? gatewayOrderId : undefined,
        stripeSessionId: provider === 'stripe' ? gatewayOrderId : undefined,
        razorpayQrCodeId: qrCode?.id,
        qrCodeImageUrl: qrCode?.image_url,
        qrCodeExpiresAt: qrCode?.close_by ? new Date(qrCode.close_by * 1000) : null,
        status: INVOICE_STATUS.PENDING,
    });

    responsePayload.invoiceId = invoice._id;
    responsePayload.paymentMethod = paymentMethod;

    ApiResponse.success(res, responsePayload, 'Subscription session created');
});

/**
 * POST /api/billing/verify-payment
 * Verify Razorpay payment after client-side checkout
 */
const verifyPayment = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw ApiError.badRequest('Razorpay payment verification details are required');
    }

    const paymentConfig = await getActivePaymentConfig('razorpay');
    const { keySecret: rzpSecret } = getProviderCredentials(paymentConfig);

    const isValid = razorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        secret: rzpSecret
    });

    if (!isValid) throw ApiError.badRequest('Invalid payment signature');

    // Update invoice
    let invoice = await Invoice.findOne({
        razorpayOrderId: razorpay_order_id,
        tenantId,
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');

    if (invoice.status === INVOICE_STATUS.PAID) {
        return ApiResponse.success(res, { invoice }, 'Payment already verified');
    }

    const finalized = await finalizeInvoicePayment(invoice, {
        provider: 'razorpay',
        paymentId: razorpay_payment_id,
        paymentMethod: 'card',
    });
    invoice = finalized.invoice;

    let newPlan = null;

    try {
        // Generate and upload PDF
        const tenantServiceUrl = env.SERVICES.TENANT || 'http://localhost:8002';
        const path = `/internal/tenants/${encodeURIComponent(String(invoice.tenantId))}`;
        const headers = createTenantServiceHeaders('GET', path, { tenantId: String(invoice.tenantId) });
        const tenantRes = await axios.get(`${tenantServiceUrl}${path}`, { timeout: 5000, headers });
        const tenant = tenantRes.data?.data;
        newPlan = tenant?.planId || null;

        if (tenant) {
            const pdfBuffer = await generateInvoicePdf(invoice, tenant);
            const fileName = `invoices/${invoice.tenantId}/${invoice.invoiceNumber}.pdf`;
            const pdfUrl = await uploadBufferToR2(pdfBuffer, fileName, 'application/pdf');

            invoice.pdfUrl = pdfUrl;
            await invoice.save();
            console.log(`✅ Invoice PDF generated and uploaded to R2: ${pdfUrl}`);
        }
    } catch (pdfErr) {
        console.error('❌ Failed to generate or upload invoice PDF:', pdfErr.message);
        // Do not fail the verification if PDF generation fails
    }

    ApiResponse.success(res, { invoice, plan: newPlan }, 'Payment verified successfully');
});

/**
 * GET /api/billing/payment-status/:invoiceId
 * Lightweight tenant-scoped status used while a QR payment is open.
 */
const getPaymentStatus = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const invoice = await Invoice.findOne({
        _id: req.params.invoiceId,
        tenantId,
    }).select('_id status paymentMethod paymentProvider paidAt planId planSlug qrCodeExpiresAt');

    if (!invoice) throw ApiError.notFound('Invoice not found');

    const status = invoice.status === INVOICE_STATUS.PENDING
        && invoice.qrCodeExpiresAt
        && invoice.qrCodeExpiresAt <= new Date()
        ? 'expired'
        : invoice.status;

    ApiResponse.success(res, {
        invoiceId: invoice._id,
        status,
        paymentMethod: invoice.paymentMethod,
        provider: invoice.paymentProvider,
        paidAt: invoice.paidAt,
        planId: invoice.planId,
        planSlug: invoice.planSlug,
        qrExpiresAt: invoice.qrCodeExpiresAt,
    }, 'Payment status fetched');
});

/**
 * GET /api/billing/invoices
 * Get all invoices for the current tenant
 */
const getInvoices = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { page = 1, limit = 20, status } = req.query;

    const filter = { tenantId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [invoices, total] = await Promise.all([
        Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        Invoice.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, invoices, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
    });
});

/**
 * GET /api/billing/invoices/:id
 * Get a single invoice
 */
const getInvoice = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    ApiResponse.success(res, invoice);
});

module.exports = {
    getAvailablePaymentMethods,
    createSubscription,
    verifyPayment,
    getPaymentStatus,
    getInvoices,
    getInvoice,
};
