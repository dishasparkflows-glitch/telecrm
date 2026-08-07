/**
 * Generate a local PDF for visual inspection.
 */
const { generateInvoicePdf } = require('../apps/billing-service/src/services/invoicePdf.service');
const fs = require('fs');
const path = require('path');

async function main() {
    const mockInvoice = {
        invoiceNumber: 'INV-2026-0001',
        createdAt: new Date(),
        status: 'paid',
        paidAt: new Date(),
        currency: 'INR',
        type: 'subscription',
        description: 'Professional Plan - Monthly Subscription',
        paymentMethod: 'razorpay',
        razorpayPaymentId: 'pay_SKqar47nzjbuOC',
        items: [
            { name: 'Professional Plan', description: 'Monthly subscription to SparkCRM Professional', quantity: 1, unitPrice: 1999, total: 1999 }
        ],
        subtotal: 1999,
        tax: 360,
        taxPercent: 18,
        total: 2359,
    };

    const mockTenant = {
        companyName: 'Acme Corp Pvt. Ltd.',
        email: 'admin@acmecorp.com',
        phone: '+91 98765 43210',
    };

    console.log('📄 Generating PDF locally...');
    const pdfBuffer = await generateInvoicePdf(mockInvoice, mockTenant);

    const outputPath = path.join(__dirname, 'test_invoice_output.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`✅ PDF saved to: ${outputPath} (${pdfBuffer.length} bytes)`);
}

main().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
