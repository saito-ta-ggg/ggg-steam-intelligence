# Phase 1 UI Specification

## Direction
Internal analytical product: dense but readable, explicit definitions, quick comparison. Do not visually copy SteamDB/ITAD.

## Global shell
Product selector; product name/AppID; date range; scope indicator. Tabs: `Overview | Sales | Pricing & Sales | Countries | DLC | Reviews | Updates`.

## Overview
KPI cards: Gross Sales, Revenue Share (Internal NET), Net Units, Return Rate. Each shows value, period, definition tooltip and comparable-period delta when available.
Main timeline defaults to daily Gross Sales; metric toggle and daily/monthly toggle; optional discount overlay; event markers for sale/update/news/DLC/bundle. Event clicks open detail. Never imply causality automatically.
Supporting panels: top countries, top DLC, recent events.

## Sales
KPI cards plus time series and table: Gross, Returns, Tax, Net Steam Sales, Revenue Share, Gross/Returned/Net Units, Return Rate. Monthly mode must follow calendar-month rules; FY = Apr–Mar.

## Pricing & Sales
Price/discount timeline; sale-period table with dates, observed discount, units, Gross Sales, Return Rate, bundle indicator. Without canonical event names, label as `Detected discounted period`.

## Countries
Columns: Country | Gross Sales | Revenue Share | Gross Units | Returned Units | Return Rate | Sales Share. Search/region/sort controls. `XC` = Steam China.

## DLC
Columns: DLC/Package | Package ID | Gross Sales | Gross Units | Returned Units | Return Rate | Revenue Share. Search, sort, minimum-units filter. Click opens future-ready detail.

## Reviews / Updates
Show clear `data not yet connected` empty states; never fabricate.

## Safeguards
Never mix Retail activation and Store sales without labels. Always show date range/scope. Missing data is `No data`, not zero. Show freshness when available.
