/**
 * analytics.js - Compute all metrics from parsed Costco receipt data.
 *
 * Exports a global CostcoAnalytics object.
 */
const CostcoAnalytics = (() => {

  const DEPARTMENT_LABELS = {
    '12': 'Snacks & Candy',
    '13': 'Dry Grocery & Pantry',
    '14': 'Household & Cleaning',
    '17': 'Dairy & Refrigerated',
    '18': 'Frozen Foods',
    '19': 'Prepared & Deli',
    '20': 'Health & Baby Care',
    '22': 'Tires & Auto',
    '23': 'Electronics & Batteries',
    '24': 'Computers & Tech',
    '25': 'Home Fragrance',
    '26': 'Luggage & Travel',
    '28': 'Toys & Seasonal',
    '31': 'Apparel & Shoes',
    '32': 'Home & Kitchen',
    '33': 'Small Appliances',
    '38': 'Furniture & Lighting',
    '39': 'Baby Apparel',
    '48': 'Tire Services',
    '62': 'Bakery',
    '65': 'Fresh Produce',
    '87': 'Tire Center Services',
    '93': 'Pharmacy & OTC'
  };

  function getDeptLabel(id) {
    return DEPARTMENT_LABELS[id] || `Dept ${id}`;
  }

  /**
   * Main entry: compute everything from an array of parsed rows.
   */
  function computeAll(rows) {
    const purchases = rows.filter(r => r.quantity > 0);
    const returns = rows.filter(r => r.quantity < 0);

    return {
      summary: computeSummary(rows, purchases, returns),
      monthly: computeMonthly(rows),
      departments: computeDepartments(purchases),
      basketSize: computeBasketSize(rows),
      topFrequency: computeTopFrequency(purchases, 20),
      topSpend: computeTopSpend(purchases, 20),
      frequencyTable: computeFrequencyTable(purchases),
      priceChanges: computePriceChanges(purchases),
      returnsTable: buildReturnsTable(returns),
      savingsBreakdown: computeSavingsBreakdown(rows),
      monthlySavings: computeMonthlySavings(rows),
      topDiscounts: computeTopDiscounts(rows),
      potentialReturns: computePotentialReturns(rows),
      insights: generateInsights(rows, purchases, returns)
    };
  }

  /* ---- Summary ---- */

  function computeSummary(rows, purchases, returns) {
    const totalSpent = sum(rows, 'line_total');
    const totalPurchaseAmount = sum(purchases, 'line_total');
    const totalReturnAmount = Math.abs(sum(returns, 'line_total'));

    const receiptIds = new Set();
    const purchaseReceiptIds = new Set();
    rows.forEach(r => {
      receiptIds.add(r.receipt_id);
      if (r.quantity > 0) purchaseReceiptIds.add(r.receipt_id);
    });

    const totalTrips = purchaseReceiptIds.size || receiptIds.size;
    const totalItemsPurchased = purchases.reduce((s, r) => s + Math.abs(r.quantity), 0);
    const totalItemsReturned = returns.reduce((s, r) => s + Math.abs(r.quantity), 0);

    const totalSavings =
      Math.abs(sum(rows, 'instant_savings')) +
      Math.abs(sum(rows, 'discount_amount')) +
      Math.abs(sum(rows, 'coupon_applied')) +
      Math.abs(sum(rows, 'shop_card_applied'));

    // Deduplicate savings at the receipt level since they repeat per line item
    const receiptSavings = deduplicateReceiptField(rows, [
      'instant_savings', 'discount_amount', 'coupon_applied', 'shop_card_applied'
    ]);
    const dedupedTotalSavings =
      Math.abs(receiptSavings.instant_savings) +
      Math.abs(receiptSavings.discount_amount) +
      Math.abs(receiptSavings.coupon_applied) +
      Math.abs(receiptSavings.shop_card_applied);

    const avgPerTrip = totalTrips > 0 ? totalSpent / totalTrips : 0;

    return {
      totalSpent,
      totalPurchaseAmount,
      totalReturnAmount,
      totalTrips,
      totalItemsPurchased,
      totalItemsReturned,
      totalSavings: dedupedTotalSavings,
      avgPerTrip
    };
  }

  /**
   * Since savings fields (instant_savings, etc.) are repeated on every line item
   * within the same receipt, we need to deduplicate by taking only one value per receipt.
   */
  function deduplicateReceiptField(rows, fields) {
    const seen = {};
    const totals = {};
    fields.forEach(f => totals[f] = 0);

    rows.forEach(r => {
      const key = r.receipt_id || r.order_number;
      if (!seen[key]) {
        seen[key] = true;
        fields.forEach(f => {
          totals[f] += (r[f] || 0);
        });
      }
    });

    return totals;
  }

  /* ---- Monthly Spending ---- */

  function computeMonthly(rows) {
    const map = {};
    rows.forEach(r => {
      const key = monthKey(r.transaction_date);
      if (!key) return;
      if (!map[key]) map[key] = { purchases: 0, returns: 0 };
      if (r.quantity > 0) {
        map[key].purchases += r.line_total;
      } else {
        map[key].returns += Math.abs(r.line_total);
      }
    });

    const labels = Object.keys(map).sort();
    return {
      labels,
      purchases: labels.map(k => round2(map[k].purchases)),
      returns: labels.map(k => round2(map[k].returns))
    };
  }

  /* ---- Department Spending ---- */

  function computeDepartments(purchases) {
    const map = {};
    purchases.forEach(r => {
      const label = getDeptLabel(r.department_id);
      map[label] = (map[label] || 0) + r.line_total;
    });

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(e => e[0]),
      values: sorted.map(e => round2(e[1]))
    };
  }

  /* ---- Basket Size ---- */

  function computeBasketSize(rows) {
    const trips = {};
    rows.forEach(r => {
      if (r.quantity <= 0) return;
      const key = r.receipt_id || r.order_number;
      const mk = monthKey(r.transaction_date);
      if (!mk) return;
      if (!trips[key]) trips[key] = { month: mk, items: 0 };
      trips[key].items += Math.abs(r.quantity);
    });

    const monthItems = {};
    const monthCounts = {};
    Object.values(trips).forEach(t => {
      monthItems[t.month] = (monthItems[t.month] || 0) + t.items;
      monthCounts[t.month] = (monthCounts[t.month] || 0) + 1;
    });

    const labels = Object.keys(monthItems).sort();
    return {
      labels,
      values: labels.map(k => round2(monthItems[k] / (monthCounts[k] || 1)))
    };
  }

  /* ---- Top Items by Frequency ---- */

  function computeTopFrequency(purchases, limit) {
    const map = {};
    purchases.forEach(r => {
      const key = r.item_sku || r.item_name;
      if (!map[key]) map[key] = { name: r.item_actual_name, count: 0 };
      map[key].count += Math.abs(r.quantity);
    });

    const sorted = Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
    return {
      labels: sorted.map(e => truncate(e.name, 35)),
      values: sorted.map(e => e.count),
      fullNames: sorted.map(e => e.name)
    };
  }

  /* ---- Top Items by Spend ---- */

  function computeTopSpend(purchases, limit) {
    const map = {};
    purchases.forEach(r => {
      const key = r.item_sku || r.item_name;
      if (!map[key]) map[key] = { name: r.item_actual_name, total: 0 };
      map[key].total += r.line_total;
    });

    const sorted = Object.values(map).sort((a, b) => b.total - a.total).slice(0, limit);
    return {
      labels: sorted.map(e => truncate(e.name, 35)),
      values: sorted.map(e => round2(e.total)),
      fullNames: sorted.map(e => e.name)
    };
  }

  /* ---- Full Frequency Table ---- */

  function computeFrequencyTable(purchases) {
    const map = {};
    purchases.forEach(r => {
      const key = r.item_sku || r.item_name;
      if (!map[key]) {
        map[key] = {
          sku: r.item_sku,
          name: r.item_actual_name,
          count: 0,
          totalSpent: 0,
          firstDate: r.transaction_date,
          lastDate: r.transaction_date
        };
      }
      map[key].count += Math.abs(r.quantity);
      map[key].totalSpent += r.line_total;
      if (r.transaction_date && r.transaction_date < map[key].firstDate) {
        map[key].firstDate = r.transaction_date;
      }
      if (r.transaction_date && r.transaction_date > map[key].lastDate) {
        map[key].lastDate = r.transaction_date;
      }
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }

  /* ---- Price Changes ---- */

  function computePriceChanges(purchases) {
    const map = {};
    purchases.forEach(r => {
      const key = r.item_sku || r.item_name;
      if (!map[key]) map[key] = { name: r.item_actual_name, prices: [] };
      map[key].prices.push({
        price: r.unit_price,
        date: r.transaction_date
      });
    });

    const changes = [];
    Object.values(map).forEach(item => {
      if (item.prices.length < 2) return;
      item.prices.sort((a, b) => a.date - b.date);
      const uniquePrices = new Set(item.prices.map(p => p.price));
      if (uniquePrices.size > 1) {
        const first = item.prices[0];
        const last = item.prices[item.prices.length - 1];
        changes.push({
          name: item.name,
          oldPrice: first.price,
          newPrice: last.price,
          change: round2(last.price - first.price),
          changePercent: round2(((last.price - first.price) / first.price) * 100),
          firstDate: first.date,
          lastDate: last.date
        });
      }
    });

    return changes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  }

  /* ---- Returns Table ---- */

  function buildReturnsTable(returns) {
    return returns.map(r => ({
      date: r.transaction_date,
      name: r.item_actual_name,
      quantity: Math.abs(r.quantity),
      refund: Math.abs(r.line_total)
    })).sort((a, b) => b.date - a.date);
  }

  /* ---- Savings Breakdown ---- */

  function computeSavingsBreakdown(rows) {
    const receipt = deduplicateReceiptField(rows, [
      'instant_savings', 'discount_amount', 'coupon_applied', 'shop_card_applied'
    ]);

    const data = {};
    if (Math.abs(receipt.instant_savings) > 0) data['Instant Savings'] = Math.abs(receipt.instant_savings);
    if (Math.abs(receipt.discount_amount) > 0) data['Discounts'] = Math.abs(receipt.discount_amount);
    if (Math.abs(receipt.coupon_applied) > 0) data['Coupons'] = Math.abs(receipt.coupon_applied);
    if (Math.abs(receipt.shop_card_applied) > 0) data['Shop Card'] = Math.abs(receipt.shop_card_applied);

    return {
      labels: Object.keys(data),
      values: Object.values(data).map(v => round2(v))
    };
  }

  /* ---- Monthly Savings ---- */

  function computeMonthlySavings(rows) {
    const seen = {};
    const map = {};

    rows.forEach(r => {
      const key = r.receipt_id || r.order_number;
      const mk = monthKey(r.transaction_date);
      if (!mk || seen[key]) return;
      seen[key] = true;

      if (!map[mk]) map[mk] = 0;
      map[mk] += Math.abs(r.instant_savings || 0)
        + Math.abs(r.discount_amount || 0)
        + Math.abs(r.coupon_applied || 0)
        + Math.abs(r.shop_card_applied || 0);
    });

    const labels = Object.keys(map).sort();
    return {
      labels,
      values: labels.map(k => round2(map[k]))
    };
  }

  /* ---- Top Discount Items ---- */

  function computeTopDiscounts(rows) {
    const purchases = rows.filter(r => r.quantity > 0 && r.instant_savings > 0);
    const map = {};

    purchases.forEach(r => {
      const key = r.item_sku || r.item_name;
      if (!map[key]) {
        map[key] = {
          name: r.item_actual_name,
          unitPrice: r.unit_price,
          savings: r.instant_savings,
          discountPct: r.unit_price > 0
            ? round2((r.instant_savings / r.unit_price) * 100)
            : 0
        };
      }
    });

    return Object.values(map).sort((a, b) => b.discountPct - a.discountPct);
  }

  /* ---- Potential Returns ---- */

  // Departments where items are typically returnable (non-consumable)
  const RETURNABLE_DEPTS = {
    '22': { label: 'Tires & Auto', policy: 'standard' },
    '23': { label: 'Electronics & Batteries', policy: '90-day' },
    '24': { label: 'Computers & Tech', policy: '90-day' },
    '26': { label: 'Luggage & Travel', policy: 'standard' },
    '28': { label: 'Toys & Seasonal', policy: 'standard' },
    '31': { label: 'Apparel & Shoes', policy: 'standard' },
    '32': { label: 'Home & Kitchen', policy: 'standard' },
    '33': { label: 'Small Appliances', policy: 'standard' },
    '38': { label: 'Furniture & Lighting', policy: 'standard' },
    '39': { label: 'Baby Apparel', policy: 'standard' }
  };

  function computePotentialReturns(rows) {
    const today = new Date();
    const purchases = rows.filter(r => r.quantity > 0);
    const returns = rows.filter(r => r.quantity < 0);

    // Build a set of returned item SKUs with their returned quantities
    const returnedMap = {};
    returns.forEach(r => {
      const key = r.item_sku || r.item_name;
      returnedMap[key] = (returnedMap[key] || 0) + Math.abs(r.quantity);
    });

    // Track purchased quantities per SKU to compute net unreturned
    const purchasedMap = {};
    purchases.forEach(r => {
      const key = r.item_sku || r.item_name;
      if (!purchasedMap[key]) {
        purchasedMap[key] = {
          sku: r.item_sku,
          name: r.item_actual_name,
          department_id: r.department_id,
          totalQty: 0,
          unitPrice: r.unit_price,
          totalSpent: 0,
          purchaseDate: r.transaction_date,
          image: r.full_item_image || ''
        };
      }
      purchasedMap[key].totalQty += Math.abs(r.quantity);
      purchasedMap[key].totalSpent += r.line_total;
      // Keep the most recent purchase date
      if (r.transaction_date > purchasedMap[key].purchaseDate) {
        purchasedMap[key].purchaseDate = r.transaction_date;
        purchasedMap[key].unitPrice = r.unit_price;
      }
    });

    const results = [];
    const categories = {};

    Object.entries(purchasedMap).forEach(([key, item]) => {
      const deptInfo = RETURNABLE_DEPTS[item.department_id];
      if (!deptInfo) return; // Not a returnable category

      const returnedQty = returnedMap[key] || 0;
      const netQty = item.totalQty - returnedQty;
      if (netQty <= 0) return; // Already fully returned

      const daysSincePurchase = Math.floor(
        (today - item.purchaseDate) / (1000 * 60 * 60 * 24)
      );

      const is90Day = deptInfo.policy === '90-day';
      const daysRemaining = is90Day ? 90 - daysSincePurchase : null;
      const isExpired = is90Day && daysRemaining <= 0;

      let status;
      if (isExpired) {
        status = 'expired';
      } else if (is90Day && daysRemaining <= 14) {
        status = 'urgent';
      } else if (is90Day) {
        status = 'limited';
      } else {
        status = 'anytime';
      }

      const entry = {
        sku: item.sku,
        name: item.name,
        department: deptInfo.label,
        departmentId: item.department_id,
        quantity: netQty,
        unitPrice: item.unitPrice,
        refundEstimate: round2(netQty * item.unitPrice),
        purchaseDate: item.purchaseDate,
        daysSincePurchase,
        policy: is90Day ? '90-Day Return' : 'Anytime Return',
        daysRemaining,
        status,
        image: item.image
      };

      results.push(entry);

      // Group by category
      const cat = deptInfo.label;
      if (!categories[cat]) {
        categories[cat] = { items: [], totalRefund: 0 };
      }
      categories[cat].items.push(entry);
      categories[cat].totalRefund += entry.refundEstimate;
    });

    // Sort: urgent first, then by refund amount descending
    const statusOrder = { urgent: 0, limited: 1, anytime: 2, expired: 3 };
    results.sort((a, b) => {
      const sDiff = statusOrder[a.status] - statusOrder[b.status];
      if (sDiff !== 0) return sDiff;
      return b.refundEstimate - a.refundEstimate;
    });

    const totalPotentialRefund = results
      .filter(r => r.status !== 'expired')
      .reduce((s, r) => s + r.refundEstimate, 0);

    const urgentItems = results.filter(r => r.status === 'urgent');
    const expiredItems = results.filter(r => r.status === 'expired');
    const returnableItems = results.filter(r => r.status !== 'expired');

    return {
      all: results,
      returnable: returnableItems,
      urgent: urgentItems,
      expired: expiredItems,
      categories,
      totalPotentialRefund: round2(totalPotentialRefund),
      totalReturnableItems: returnableItems.reduce((s, r) => s + r.quantity, 0)
    };
  }

  /* ---- Insights ---- */

  function generateInsights(rows, purchases, returns) {
    const insights = [];

    // 1. Price increases
    const priceChanges = computePriceChanges(purchases);
    const increases = priceChanges.filter(c => c.change > 0);
    if (increases.length > 0) {
      const top = increases.slice(0, 3);
      insights.push({
        type: 'warning',
        title: 'Rising Prices Detected',
        text: `${increases.length} item(s) have increased in price. Top: ` +
          top.map(i => `${i.name} (+$${i.change.toFixed(2)}, +${i.changePercent}%)`).join('; ') + '.'
      });
    }

    // 2. Most expensive repeat purchases
    const freq = computeFrequencyTable(purchases);
    const expensiveRepeats = freq
      .filter(f => f.count >= 2)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 3);

    if (expensiveRepeats.length > 0) {
      insights.push({
        type: 'info',
        title: 'Biggest Repeat Expenses',
        text: 'Your most costly repeat purchases: ' +
          expensiveRepeats.map(i =>
            `${i.name} (${i.count}x, $${i.totalSpent.toFixed(2)} total)`
          ).join('; ') + '. Consider bulk alternatives or sales timing.'
      });
    }

    // 3. Weekly staples vs. one-time buys
    const repeats = freq.filter(f => f.count >= 3);
    const oneTimers = freq.filter(f => f.count === 1);
    insights.push({
      type: 'info',
      title: 'Purchase Patterns',
      text: `You have ${repeats.length} staple item(s) purchased 3+ times and ` +
        `${oneTimers.length} one-time purchase(s). ` +
        (repeats.length > 0
          ? `Your top staples: ${repeats.slice(0, 5).map(r => r.name).join(', ')}.`
          : '')
    });

    // 4. Return rate
    const totalItems = purchases.reduce((s, r) => s + Math.abs(r.quantity), 0);
    const returnedItems = returns.reduce((s, r) => s + Math.abs(r.quantity), 0);
    const returnRate = totalItems > 0 ? (returnedItems / totalItems * 100) : 0;
    if (returnRate > 5) {
      insights.push({
        type: 'warning',
        title: 'High Return Rate',
        text: `Your return rate is ${returnRate.toFixed(1)}%. Review returned items to identify patterns ` +
          `and reduce unnecessary purchases.`
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Low Return Rate',
        text: `Your return rate is only ${returnRate.toFixed(1)}%, which suggests good purchasing decisions.`
      });
    }

    // 5. Spending trend
    const monthly = computeMonthly(rows);
    if (monthly.labels.length >= 3) {
      const vals = monthly.purchases;
      const lastThree = vals.slice(-3);
      const isIncreasing = lastThree[2] > lastThree[1] && lastThree[1] > lastThree[0];
      const isDecreasing = lastThree[2] < lastThree[1] && lastThree[1] < lastThree[0];
      if (isIncreasing) {
        insights.push({
          type: 'warning',
          title: 'Spending Is Trending Up',
          text: `Your spending has been increasing over the last 3 months ` +
            `($${lastThree.map(v => v.toFixed(0)).join(' -> $')}). Review recent purchases for discretionary items.`
        });
      } else if (isDecreasing) {
        insights.push({
          type: 'success',
          title: 'Spending Is Trending Down',
          text: `Great news! Your spending has decreased over the last 3 months ` +
            `($${lastThree.map(v => v.toFixed(0)).join(' -> $')}).`
        });
      }
    }

    // 6. Savings utilization
    const savingsBreakdown = computeSavingsBreakdown(rows);
    const totalSavingsValue = savingsBreakdown.values.reduce((s, v) => s + v, 0);
    const totalPurchaseAmount = sum(purchases, 'line_total');
    if (totalPurchaseAmount > 0) {
      const savingsRate = (totalSavingsValue / totalPurchaseAmount * 100);
      insights.push({
        type: savingsRate > 5 ? 'success' : 'info',
        title: 'Savings Rate',
        text: `You saved ${savingsRate.toFixed(1)}% on your total purchases through discounts and coupons. ` +
          (savingsRate < 5
            ? 'Check Costco\'s monthly coupon book and app for more savings opportunities.'
            : 'You\'re doing well at capturing available discounts!')
      });
    }

    return insights;
  }

  /* ---- Utilities ---- */

  function sum(arr, field) {
    return arr.reduce((s, r) => s + (r[field] || 0), 0);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function monthKey(date) {
    if (!date || !(date instanceof Date)) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  return { computeAll, getDeptLabel };
})();
