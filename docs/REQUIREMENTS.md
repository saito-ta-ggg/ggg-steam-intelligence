# Phase 1 Requirements

## Purpose
Create an internal GGG Steam intelligence application inspired by the information density of SteamDB and IsThereAnyDeal, but using independent official/public Steam sources plus GGG-owned data. Core value: **Steam product/store events and GGG actual sales performance on one timeline.**

## Users
Business owners, marketing, product/DLC staff, management and analysts.

## Phase 1
Reusable app-detail experience. RPG Maker MZ (AppID 1096900) is the validation title; do not hard-code the UI to MZ.

Navigation: `Overview | Sales | Pricing & Sales | Countries | DLC | Reviews | Updates` plus product selector and date range.
Phase 2A adds a `Timeline` tab (visualization-first foundation) — see `docs/PHASE_2A_TIMELINE.md`.

### Overview
Product/AppID; Gross Sales; Revenue Share (internal NET); Gross/Net Units; Return Rate; daily timeline; known promotion/event markers; top countries; top DLC.

### Sales
Date range; daily, calendar-month and FY (Apr–Mar) trends; Gross Sales; Net Steam Sales; Revenue Share; Gross/Returned/Net Units; Return Rate.

### Pricing & Sales
Base price, sale price, observed effective discount, bundle participation and sales overlay. Event names only when a canonical event source exists.

### Countries
Country ranking by sales/units, Return Rate, Revenue Share, filters. `XC` must display as `Steam China (Country Code: XC)`.

### DLC
Package/DLC list under selected parent App; Gross Sales, units, returns, Return Rate, Revenue Share; search/sort/filter. Future design must permit MV/MZ related-DLC comparisons.

### Reviews / Updates
Data-ready placeholders until ingestion exists. Never fabricate values.

## Out of scope initially
Competitor revenue estimation; SteamDB/ITAD scraping; BigQuery writes; user-level ownership; causal claims; production SSO unless separately specified.

## Acceptance criteria
MZ renders from mock fixtures; Overview/Sales/Countries/DLC work; daily/monthly series work; metric/scope rules have tests; BigQuery repository is separate from UI; no client-side BigQuery access.
