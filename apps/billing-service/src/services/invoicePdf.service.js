const PDFDocument = require('pdfkit');

/**
 * Generates a clean, modern PDF Invoice styled after the Velzon template.
 * 
 * IMPORTANT: Every doc.text() with explicit x,y coordinates MUST include
 * { lineBreak: false } to prevent pdfkit from auto-paginating.
 * 
 * @param {Object} invoice - The invoice document from the DB.
 * @param {Object} tenant - The tenant profile.
 * @returns {Promise<Buffer>} - A promise resolving to the PDF Buffer.
 */
const generateInvoicePdf = (invoice, tenant) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margin: 40,
                size: 'A4',
                autoFirstPage: true,
            });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // ═══════════════════════════════════════
            //  Color Palette (Velzon-inspired)
            // ═══════════════════════════════════════
            const primaryColor = '#405189';
            const successColor = '#0AB39C';
            const dangerColor = '#F06548';
            const warningColor = '#F7B84B';
            const textDark = '#212529';
            const textBody = '#495057';
            const textMuted = '#878A99';
            const bgLight = '#F3F6F9';
            const borderColor = '#E9EBEC';
            const white = '#FFFFFF';

            const pageWidth = doc.page.width;
            const marginL = 40;
            const contentWidth = pageWidth - marginL - 40;

            // Shorthand: draw filled rect
            const fillRect = (x, y, w, h, color) => {
                doc.save().rect(x, y, w, h).fill(color).restore();
            };

            // Shorthand: draw horizontal line
            const hLine = (x1, x2, y, color) => {
                doc.save().moveTo(x1, y).lineTo(x2, y)
                    .strokeColor(color || borderColor).lineWidth(0.5).stroke().restore();
            };

            // Shorthand: positioned text (NO lineBreak to avoid pdfkit cursor advance)
            const putText = (str, x, y, opts = {}) => {
                doc.text(str, x, y, { lineBreak: false, ...opts });
            };

            // Format currency
            const fmtCurrency = (amt) => {
                const sym = (invoice.currency || 'INR') === 'INR' ? '₹' : '$';
                return `${sym}${(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            };

            // Format date
            const fmtDate = (d) => {
                if (!d) return 'N/A';
                return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            };

            // ═══════════════════════════════════════
            //  1. COMPANY HEADER
            // ═══════════════════════════════════════
            let y = 40;

            // Company Name (left)
            doc.fillColor(textDark).fontSize(22).font('Helvetica-Bold');
            putText('SparkCRM', marginL, y);

            // Company Contact (right-aligned)
            doc.fillColor(textMuted).fontSize(8).font('Helvetica');
            putText('Email: support@sparkcrm.com', marginL, y, { align: 'right', width: contentWidth });
            putText('Website: www.sparkcrm.com', marginL, y + 11, { align: 'right', width: contentWidth });
            putText('Contact: +(91) 98765 43210', marginL, y + 22, { align: 'right', width: contentWidth });

            // ─── Company Address ───
            y = 72;
            doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold');
            putText('ADDRESS', marginL, y);
            doc.fillColor(textBody).fontSize(9).font('Helvetica');
            putText('India', marginL, y + 13);

            // ═══════════════════════════════════════
            //  2. INVOICE META BAR
            // ═══════════════════════════════════════
            y = 108;
            fillRect(marginL, y, contentWidth, 50, bgLight);
            hLine(marginL, marginL + contentWidth, y, borderColor);
            hLine(marginL, marginL + contentWidth, y + 50, borderColor);

            const colW = contentWidth / 4;
            const metaY = y + 10;

            // Invoice No
            doc.fillColor(textMuted).fontSize(7).font('Helvetica-Bold');
            putText('INVOICE NO', marginL + 10, metaY);
            doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold');
            putText(`#${invoice.invoiceNumber}`, marginL + 10, metaY + 13);

            // Date
            doc.fillColor(textMuted).fontSize(7).font('Helvetica-Bold');
            putText('DATE', marginL + colW + 10, metaY);
            doc.fillColor(textDark).fontSize(10).font('Helvetica');
            putText(fmtDate(invoice.paidAt || invoice.createdAt), marginL + colW + 10, metaY + 13);

            // Payment Status
            doc.fillColor(textMuted).fontSize(7).font('Helvetica-Bold');
            putText('PAYMENT STATUS', marginL + colW * 2 + 10, metaY);

            const statusStr = (invoice.status || 'pending').toUpperCase();
            const badgeClr = invoice.status === 'paid' ? successColor
                : invoice.status === 'pending' ? warningColor : dangerColor;
            doc.fontSize(7);
            const badgeW = doc.widthOfString(statusStr) + 12;
            const bx = marginL + colW * 2 + 10;
            const by = metaY + 12;
            fillRect(bx, by, badgeW, 14, badgeClr);
            doc.fillColor(white).fontSize(7).font('Helvetica-Bold');
            putText(statusStr, bx + 6, by + 3);

            // Total Amount
            doc.fillColor(textMuted).fontSize(7).font('Helvetica-Bold');
            putText('TOTAL AMOUNT', marginL + colW * 3 + 10, metaY);
            doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold');
            putText(fmtCurrency(invoice.total), marginL + colW * 3 + 10, metaY + 12);

            // ═══════════════════════════════════════
            //  3. BILLING ADDRESS
            // ═══════════════════════════════════════
            y = 175;
            doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold');
            putText('BILLING ADDRESS', marginL, y);

            doc.fillColor(textDark).fontSize(10).font('Helvetica-Bold');
            putText(tenant.companyName || 'Customer', marginL, y + 15);

            doc.fillColor(textBody).fontSize(9).font('Helvetica');
            let addrY = y + 28;
            if (tenant.email) { putText(`Email: ${tenant.email}`, marginL, addrY); addrY += 13; }
            if (tenant.phone) { putText(`Phone: ${tenant.phone}`, marginL, addrY); addrY += 13; }

            // ═══════════════════════════════════════
            //  4. LINE ITEMS TABLE
            // ═══════════════════════════════════════
            y = addrY + 15;
            fillRect(marginL, y, contentWidth, 26, bgLight);
            hLine(marginL, marginL + contentWidth, y + 26);

            // Column X positions
            const c1 = marginL + 10;
            const c2 = marginL + 40;
            const c3 = marginL + contentWidth - 200;
            const c4 = marginL + contentWidth - 120;
            const c5 = marginL + contentWidth - 10;

            doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold');
            putText('#', c1, y + 8);
            putText('Product Details', c2, y + 8);
            putText('Rate', c3, y + 8);
            putText('Quantity', c4, y + 8);
            putText('Amount', c5 - 45, y + 8, { width: 45, align: 'right' });

            y += 26;

            (invoice.items || []).forEach((item, idx) => {
                const rowY = y + 10;

                doc.fillColor(textBody).fontSize(9).font('Helvetica');
                putText(String(idx + 1).padStart(2, '0'), c1, rowY);

                doc.fillColor(textDark).font('Helvetica-Bold').fontSize(9);
                putText(item.name || 'Item', c2, rowY);

                if (item.description || invoice.description) {
                    doc.fillColor(textMuted).font('Helvetica').fontSize(7);
                    putText(item.description || invoice.description, c2, rowY + 13, { width: c3 - c2 - 10 });
                }

                doc.fillColor(textBody).font('Helvetica').fontSize(9);
                putText(fmtCurrency(item.unitPrice), c3, rowY);
                putText(String(item.quantity || 1).padStart(2, '0'), c4, rowY);
                putText(fmtCurrency(item.total), c5 - 60, rowY, { width: 60, align: 'right' });

                y += 38;
                hLine(marginL, marginL + contentWidth, y);
            });

            // ═══════════════════════════════════════
            //  5. TOTALS SECTION
            // ═══════════════════════════════════════
            y += 8;
            const tLabelX = marginL + contentWidth - 200;
            const tValX = marginL + contentWidth - 10;

            doc.fillColor(textBody).fontSize(9).font('Helvetica');
            putText('Sub Total', tLabelX, y, { width: 130, align: 'right' });
            doc.fillColor(textDark).font('Helvetica-Bold');
            putText(fmtCurrency(invoice.subtotal), tValX - 60, y, { width: 60, align: 'right' });

            y += 18;

            if (invoice.tax > 0) {
                doc.fillColor(textBody).font('Helvetica').fontSize(9);
                putText(`Estimated Tax (${invoice.taxPercent || 18}%)`, tLabelX, y, { width: 130, align: 'right' });
                doc.fillColor(textDark).font('Helvetica-Bold');
                putText(fmtCurrency(invoice.tax), tValX - 60, y, { width: 60, align: 'right' });
                y += 18;
            }

            hLine(tLabelX, marginL + contentWidth, y);
            y += 8;

            doc.fillColor(textDark).fontSize(11).font('Helvetica-Bold');
            putText('Total Amount', tLabelX, y, { width: 130, align: 'right' });
            doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold');
            putText(fmtCurrency(invoice.total), tValX - 70, y, { width: 70, align: 'right' });

            // ═══════════════════════════════════════
            //  6. PAYMENT DETAILS
            // ═══════════════════════════════════════
            y += 30;
            doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold');
            putText('PAYMENT DETAILS:', marginL, y);

            y += 14;
            doc.fillColor(textBody).fontSize(9).font('Helvetica');
            if (invoice.paymentMethod) {
                putText(`Payment Method: ${invoice.paymentMethod.charAt(0).toUpperCase() + invoice.paymentMethod.slice(1)}`, marginL, y);
                y += 13;
            }
            if (invoice.razorpayPaymentId) {
                putText(`Transaction ID: ${invoice.razorpayPaymentId}`, marginL, y);
                y += 13;
            }
            if (invoice.stripeSessionId) {
                putText(`Session ID: ${invoice.stripeSessionId}`, marginL, y);
                y += 13;
            }
            putText(`Total Amount: ${fmtCurrency(invoice.total)}`, marginL, y);

            // ═══════════════════════════════════════
            //  7. NOTES BOX
            // ═══════════════════════════════════════
            y += 25;
            const notesH = 42;
            if (y + notesH < doc.page.height - 50) {
                fillRect(marginL, y, contentWidth, notesH, '#FEF4E4');
                fillRect(marginL, y, 3, notesH, warningColor);

                doc.fillColor('#B5731F').fontSize(8).font('Helvetica-Bold');
                putText('NOTES:', marginL + 12, y + 8);

                doc.fillColor('#B5731F').fontSize(7).font('Helvetica');
                putText('All accounts are to be paid within 7 days from receipt of invoice.', marginL + 50, y + 8);
                putText('This is a computer-generated invoice and does not require a physical signature.', marginL + 50, y + 20);

                y += notesH;
            }

            // ═══════════════════════════════════════
            //  8. FOOTER — flows after notes (no absolute positioning)
            // ═══════════════════════════════════════
            y += 15;
            hLine(marginL, marginL + contentWidth, y);
            y += 8;
            doc.fillColor(textMuted).fontSize(7).font('Helvetica');
            putText('Thank you for your business!', marginL, y);
            putText('Powered by SparkCRM', marginL, y, { width: contentWidth, align: 'right' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateInvoicePdf };


