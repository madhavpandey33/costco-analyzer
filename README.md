# Costco Spending Analyzer

A privacy-first, client-side spending analytics dashboard for Costco warehouse receipts. Upload your receipt export (CSV or Excel) and get instant insights — all processing happens in your browser.

## Features

- **Spending Overview** — Total spent, monthly trends, department breakdown, basket size over time
- **Item Analysis** — Most frequently purchased items, top items by spend, price change detection
- **Returns Tracking** — Returned items table, total refund amount, return rate
- **Savings & Optimization** — Savings breakdown (instant savings, coupons, discounts), monthly savings trend, algorithmically generated spending insights

## Tech Stack

- [Oat UI](https://oat.ink/) — Ultra-lightweight, zero-dependency HTML/CSS component library
- [Chart.js](https://www.chartjs.org/) — Lightweight charting
- [SheetJS](https://sheetjs.com/) — Client-side CSV/Excel parsing
- Vanilla JS — No framework, no build step

## Getting Started

1. Clone this repository
2. Open `index.html` in your browser (or use any static file server)
3. Upload your Costco receipt CSV/Excel file
4. Explore the dashboard

## Deployment

This project is configured to auto-deploy to GitHub Pages via GitHub Actions. Push to `main` and it deploys automatically.

To set up:
1. Create a GitHub repository
2. Push this code to `main`
3. Go to **Settings > Pages** and select **GitHub Actions** as the source

## Privacy

All data processing happens entirely in the browser. No data is sent to any server.
