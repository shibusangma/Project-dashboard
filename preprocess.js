const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'Country Delight Diary Sales and Inventory Dataset.csv');
const outPath = path.join(__dirname, 'dashboard_data.json');

console.log('Reading CSV...');
const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim());
const headers = lines[0].split(',');

console.log(`Parsing ${lines.length - 1} rows...`);

// --- Accumulators ---
const revenueByState = {};
const revenueByProduct = {};
const revenueByBrand = {};
const revenueByChannel = {};
const revenueByMonth = {};      // "2019-01" → revenue
const revenueByYear = {};
const soldByProduct = {};
const soldByState = {};          // customer location
const customerLocationRevenue = {};

// Inventory health
let totalRows = 0;
let belowThresholdCount = 0;
let outOfStockCount = 0;
const inventoryAlerts = [];      // products with stock < threshold

// Farm stats
const farmSizeCounts = { Small: 0, Medium: 0, Large: 0 };
let totalLandArea = 0;
let totalCows = 0;

// Storage conditions
const storageConditionCounts = {};

// Shelf life by product
const shelfLifeByProduct = {};
const shelfLifeCountByProduct = {};

let totalRevenue = 0;
let totalQuantitySold = 0;
const brandSet = new Set();
const productSet = new Set();
const stateSet = new Set();

for (let i = 1; i < lines.length; i++) {
  // Smart CSV parsing (handles commas in values if needed)
  const cols = lines[i].split(',');
  if (cols.length < 23) continue;

  const location = cols[0].trim();
  const landArea = parseFloat(cols[1]) || 0;
  const numCows = parseFloat(cols[2]) || 0;
  const farmSize = cols[3].trim();
  const dateStr = cols[4].trim();
  const productName = cols[6].trim();
  const brand = cols[7].trim();
  const quantity = parseFloat(cols[8]) || 0;
  const pricePerUnit = parseFloat(cols[9]) || 0;
  const totalValue = parseFloat(cols[10]) || 0;
  const shelfLife = parseFloat(cols[11]) || 0;
  const storageCondition = cols[12].trim();
  const qtySold = parseFloat(cols[15]) || 0;
  const priceSold = parseFloat(cols[16]) || 0;
  const revenue = parseFloat(cols[17]) || 0;
  const customerLocation = cols[18].trim();
  const salesChannel = cols[19].trim();
  const qtyInStock = parseFloat(cols[20]) || 0;
  const minStockThreshold = parseFloat(cols[21]) || 0;
  const reorderQty = parseFloat(cols[22]) || 0;

  // Parse date (DD-MM-YYYY)
  const dateParts = dateStr.split('-');
  let year = '', month = '', monthKey = '';
  if (dateParts.length === 3) {
    year = dateParts[2];
    month = dateParts[1];
    monthKey = `${year}-${month}`;
  }

  totalRows++;
  totalRevenue += revenue;
  totalQuantitySold += qtySold;
  brandSet.add(brand);
  productSet.add(productName);
  stateSet.add(location);

  // Revenue by state (farm location)
  revenueByState[location] = (revenueByState[location] || 0) + revenue;

  // Revenue by product
  revenueByProduct[productName] = (revenueByProduct[productName] || 0) + revenue;

  // Quantity sold by product
  soldByProduct[productName] = (soldByProduct[productName] || 0) + qtySold;

  // Revenue by brand
  revenueByBrand[brand] = (revenueByBrand[brand] || 0) + revenue;

  // Revenue by channel
  revenueByChannel[salesChannel] = (revenueByChannel[salesChannel] || 0) + revenue;

  // Revenue by month
  if (monthKey) {
    revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + revenue;
  }

  // Revenue by year
  if (year) {
    revenueByYear[year] = (revenueByYear[year] || 0) + revenue;
  }

  // Customer location revenue
  customerLocationRevenue[customerLocation] = (customerLocationRevenue[customerLocation] || 0) + revenue;

  // Sold by customer state
  soldByState[customerLocation] = (soldByState[customerLocation] || 0) + qtySold;

  // Farm stats
  if (farmSizeCounts[farmSize] !== undefined) farmSizeCounts[farmSize]++;
  totalLandArea += landArea;
  totalCows += numCows;

  // Storage
  storageConditionCounts[storageCondition] = (storageConditionCounts[storageCondition] || 0) + 1;

  // Shelf life
  if (!shelfLifeByProduct[productName]) {
    shelfLifeByProduct[productName] = 0;
    shelfLifeCountByProduct[productName] = 0;
  }
  shelfLifeByProduct[productName] += shelfLife;
  shelfLifeCountByProduct[productName]++;

  // Inventory health
  if (qtyInStock <= 0) outOfStockCount++;
  if (qtyInStock < minStockThreshold) {
    belowThresholdCount++;
    // Collect for inventory alerts (sample — keep limited)
    if (inventoryAlerts.length < 500) {
      inventoryAlerts.push({
        product: productName,
        brand,
        location,
        stock: Math.round(qtyInStock * 100) / 100,
        threshold: Math.round(minStockThreshold * 100) / 100,
        reorder: Math.round(reorderQty * 100) / 100,
        deficit: Math.round((minStockThreshold - qtyInStock) * 100) / 100
      });
    }
  }
}

// Compute average shelf life per product
const avgShelfLife = {};
for (const p of Object.keys(shelfLifeByProduct)) {
  avgShelfLife[p] = Math.round(shelfLifeByProduct[p] / shelfLifeCountByProduct[p]);
}

// Sort helpers
function sortedObj(obj, limit) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit || 999)
    .map(([k, v]) => ({ name: k, value: Math.round(v) }));
}

// Sort inventory alerts by deficit (most critical first)
inventoryAlerts.sort((a, b) => b.deficit - a.deficit);

// Monthly trend — sorted chronologically
const monthlyTrend = Object.entries(revenueByMonth)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([k, v]) => ({ month: k, revenue: Math.round(v) }));

// Build output
const output = {
  summary: {
    totalRows,
    totalRevenue: Math.round(totalRevenue),
    totalQuantitySold: Math.round(totalQuantitySold),
    totalBrands: brandSet.size,
    totalProducts: productSet.size,
    totalStates: stateSet.size,
    avgLandArea: Math.round(totalLandArea / totalRows),
    avgCows: Math.round(totalCows / totalRows),
    outOfStockCount,
    belowThresholdCount,
    belowThresholdPct: Math.round((belowThresholdCount / totalRows) * 10000) / 100
  },
  revenueByState: sortedObj(revenueByState),
  revenueByProduct: sortedObj(revenueByProduct),
  revenueByBrand: sortedObj(revenueByBrand, 15),
  revenueByChannel: sortedObj(revenueByChannel),
  revenueByYear: sortedObj(revenueByYear),
  customerLocationRevenue: sortedObj(customerLocationRevenue),
  soldByProduct: sortedObj(soldByProduct),
  soldByState: sortedObj(soldByState),
  monthlyTrend,
  farmSizeCounts,
  storageConditionCounts,
  avgShelfLife,
  inventoryAlerts: inventoryAlerts.slice(0, 20)   // top 20 critical
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Done! Written to ${outPath}`);
console.log(`Summary: ${totalRows} rows, ₹${Math.round(totalRevenue).toLocaleString()} total revenue, ${brandSet.size} brands, ${productSet.size} products`);
