/**
 * parser.js - CSV/Excel file parsing and data normalization for Costco receipts.
 *
 * Uses SheetJS (XLSX) to handle .csv, .xlsx, and .xls formats.
 * Exports a global CostcoParser object.
 */
const CostcoParser = (() => {

  const EXPECTED_COLUMNS = [
    'order_number', 'receipt_id', 'receipt_type', 'transaction_date',
    'warehouse_info', 'item_sku', 'item_name', 'item_actual_name',
    'item_description_2', 'item_weight', 'full_item_image', 'quantity',
    'unit_price', 'line_total', 'department_id', 'tax_flag', 'isFSAEligible',
    'subtotal', 'instant_savings', 'discount_amount', 'shop_card_applied',
    'coupon_applied', 'tax_total', 'shipping_handling', 'delivery_fees',
    'surcharges', 'surcharge_reason', 'final_total', 'payment_methods',
    'raw_receipt_hash'
  ];

  const NUMERIC_FIELDS = [
    'quantity', 'unit_price', 'line_total', 'subtotal',
    'instant_savings', 'discount_amount', 'shop_card_applied',
    'coupon_applied', 'tax_total', 'shipping_handling',
    'delivery_fees', 'surcharges', 'final_total'
  ];

  /**
   * Read a File object and return an array of normalized row objects.
   * @param {File} file
   * @returns {Promise<Array<Object>>}
   */
  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

          if (jsonRows.length === 0) {
            reject(new Error('The file appears to be empty.'));
            return;
          }

          const normalized = normalizeRows(jsonRows);
          resolve(normalized);
        } catch (err) {
          reject(new Error('Failed to parse file: ' + err.message));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Normalize column names and parse data types.
   */
  function normalizeRows(rows) {
    return rows.map((row) => {
      const normalized = {};
      const keys = Object.keys(row);

      keys.forEach((key) => {
        const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
        normalized[cleanKey] = row[key];
      });

      NUMERIC_FIELDS.forEach((field) => {
        if (field in normalized) {
          const val = parseFloat(normalized[field]);
          normalized[field] = isNaN(val) ? 0 : val;
        } else {
          normalized[field] = 0;
        }
      });

      if (normalized.transaction_date) {
        normalized.transaction_date = parseDate(normalized.transaction_date);
      }

      normalized.item_actual_name = normalized.item_actual_name || normalized.item_name || 'Unknown';
      normalized.item_sku = String(normalized.item_sku || '').trim();
      normalized.receipt_id = String(normalized.receipt_id || '').trim();
      normalized.order_number = String(normalized.order_number || '').trim();
      normalized.department_id = String(normalized.department_id || '').trim();

      return normalized;
    });
  }

  /**
   * Parse a date value that could be a string (YYYY-MM-DD, MM/DD/YYYY) or a JS Date.
   */
  function parseDate(val) {
    if (val instanceof Date && !isNaN(val)) return val;

    const str = String(val).trim();

    // YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }

    // MM/DD/YYYY
    const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usMatch) {
      return new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
    }

    const fallback = new Date(str);
    return isNaN(fallback) ? null : fallback;
  }

  /**
   * Validate that the parsed data has the minimum required columns.
   */
  function validate(rows) {
    if (!rows || rows.length === 0) {
      return { valid: false, message: 'No data rows found in file.' };
    }

    const required = ['transaction_date', 'item_name', 'quantity', 'line_total'];
    const firstRow = rows[0];
    const missing = required.filter((col) => !(col in firstRow));

    if (missing.length > 0) {
      return {
        valid: false,
        message: `Missing required columns: ${missing.join(', ')}. Please check your file format.`
      };
    }

    return { valid: true, message: '' };
  }

  return { parseFile, validate };
})();
