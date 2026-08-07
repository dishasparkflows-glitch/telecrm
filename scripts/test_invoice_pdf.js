/**
 * Test Velzon-style PDF — check page count + upload with unique name.
 */
const { uploadBufferToR2 } = require('../libs/shared-utils/src/cloudStorage');
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
            { name: 'Professional Plan', description: 'Monthly subscription to SparkCRM Professional', quantity: 1, unitPrice: 1999, total: 1999 },
            { name: 'Add-on: WhatsApp Integration', description: 'WhatsApp Business API messaging', quantity: 1, unitPrice: 499, total: 499 },
        ],
        subtotal: 2498,
        tax: 450,
        taxPercent: 18,
        total: 2948,
    };

    const mockTenant = {
        companyName: 'Acme Corp Pvt. Ltd.',
        email: 'admin@acmecorp.com',
        phone: '+91 98765 43210',
    };

    console.log('📄 Generating PDF...');
    const pdfBuffer = await generateInvoicePdf(mockInvoice, mockTenant);
    console.log(`✅ PDF generated (${pdfBuffer.length} bytes)`);

    // Save locally
    const localPath = path.join(__dirname, 'test_invoice_velzon_v2.pdf');
    fs.writeFileSync(localPath, pdfBuffer);
    console.log(`📁 Local: ${localPath}`);

    // Quick page count check from the PDF raw content
    const pdfStr = pdfBuffer.toString('latin1');
    const pageCount = (pdfStr.match(/\/Type\\s*\/Page[^s]/g) || []).length;
    console.log(`📄 Estimated page count: ${pageCount}`);

    // Upload with a unique name to bypass CDN cache
    const ts = Date.now();
    const fileName = `invoices/test/INV-V2-${ts}.pdf`;
    const pdfUrl = await uploadBufferToR2(pdfBuffer, fileName, 'application/pdf');
    console.log(`☁️  R2 URL: ${pdfUrl}`);
}

main().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
