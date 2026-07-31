# Changelog

All notable public changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-31

### Initial Public Release

- Added a storefront preview refresh control that reloads only the active design-mode preview iframe.
- Added a discard-and-refresh Theme Editor control that invokes Shopify's currently mounted native refresh action.
- Added browser confirmation before the destructive refresh can discard unsaved Theme Editor changes.
- Added language-independent native action discovery based on destructive-action structure, callback identity, and conflict-action correlation.
- Verified native action discovery in English, Simplified Chinese, and Japanese Shopify Admin interfaces.
- Added Shopify-style tooltips with native surface styling, accessible interaction, viewport-aware positioning, and directional tails.
- Added toolbar reinjection after Shopify React redraws and route-driven toolbar replacement.
- Added preview acknowledgement, validated fallback, timeout, cooldown, and error states.
- Fails closed without a full-page Shopify Admin reload fallback when an action cannot be completed safely.
- Includes no analytics, telemetry, shop-data storage, or external runtime requests.
- Preserves signed editor URLs and Shopify HMAC parameters instead of reconstructing them.
