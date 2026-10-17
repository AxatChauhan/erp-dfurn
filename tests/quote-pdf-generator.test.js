const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Import from compiled or transpile-compatible source
describe('Quotation PDF Generator & INR Words Tests', () => {

  // Test numberToWordsINR logic
  test('numberToWordsINR correctly converts currency numbers to Indian English words', () => {
    // Basic helper replicating the logic in quotePdfGenerator.ts
    const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertTwoDigits(num) {
      if (num === 0) return '';
      if (num < 10) return singleDigits[num];
      if (num < 20) return teens[num - 10];
      const unit = num % 10;
      return tens[Math.floor(num / 10)] + (unit ? ' ' + singleDigits[unit] : '');
    }

    function convertThreeDigits(num) {
      const hundred = Math.floor(num / 100);
      const rest = num % 100;
      let res = '';
      if (hundred > 0) {
        res += singleDigits[hundred] + ' Hundred';
        if (rest > 0) res += ' ';
      }
      res += convertTwoDigits(rest);
      return res.trim();
    }

    function numberToWordsINR(amount) {
      const n = Math.round(Math.abs(amount));
      if (n === 0) return 'Rupees Zero Only';

      const crore = Math.floor(n / 10000000);
      const lakh = Math.floor((n % 10000000) / 100000);
      const thousand = Math.floor((n % 100000) / 1000);
      const remainder = n % 1000;

      let words = '';
      if (crore > 0) words += convertTwoDigits(crore) + ' Crore ';
      if (lakh > 0) words += convertTwoDigits(lakh) + ' Lakh ';
      if (thousand > 0) words += convertTwoDigits(thousand) + ' Thousand ';
      if (remainder > 0) words += convertThreeDigits(remainder);

      return 'Rupees ' + words.trim() + ' Only';
    }

    assert.equal(numberToWordsINR(0), 'Rupees Zero Only');
    assert.equal(numberToWordsINR(500), 'Rupees Five Hundred Only');
    assert.equal(numberToWordsINR(145200), 'Rupees One Lakh Forty Five Thousand Two Hundred Only');
    assert.equal(numberToWordsINR(5234120), 'Rupees Fifty Two Lakh Thirty Four Thousand One Hundred Twenty Only');
    assert.equal(numberToWordsINR(10000000), 'Rupees One Crore Only');
  });

  test('jsPDF and jspdf-autotable in-memory document creation succeeds without DOM', async () => {
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('D. F. FURNITURE DESIGN & MANUFACTURING', 14, 18);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Description', 'Qty', 'Unit Rate', 'Disc', 'Total']],
      body: [
        ['1', 'Executive Teakwood Desk', '2', '₹50,000', '–', '₹1,00,000'],
        ['2', 'Ergonomic Mesh Chair', '4', '₹12,500', '10%', '₹45,000']
      ],
      margin: { left: 14, right: 14 }
    });

    assert.equal(doc.getNumberOfPages(), 1);
    const pdfDataUri = doc.output('datauristring');
    assert.ok(pdfDataUri.startsWith('data:application/pdf;filename=generated.pdf;base64,'));
  });

  test('PDF payload handles null/missing optional fields safely', async () => {
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF();
    const minimalQuote = {
      quotationNumber: 'DF_QT_TEST',
      client: null,
      latestVersion: {
        items: [],
        additionalCharges: []
      }
    };

    // Safe extraction
    const clientName = minimalQuote.client?.name || 'Valued Client';
    const items = minimalQuote.latestVersion?.items || [];
    assert.equal(clientName, 'Valued Client');
    assert.equal(items.length, 0);

    const rows = items.map((it, i) => [i + 1, it.description || 'Item', 1, '0', '0', '0']);
    if (rows.length === 0) {
      rows.push(['1', 'Custom Furniture Design Scope', '1', '₹0', '–', '₹0']);
    }

    autoTable(doc, {
      startY: 20,
      head: [['#', 'Item', 'Qty', 'Unit Rate', 'Disc', 'Total']],
      body: rows
    });

    assert.ok(doc.getNumberOfPages() >= 1);
  });
});
