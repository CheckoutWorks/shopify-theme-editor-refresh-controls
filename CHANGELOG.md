# Changelog

All notable public changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-08-01

### Added

- Added explicit GitHub source, update, and download metadata so direct GitHub installations have a stable update channel.

### Fixed

- Added bounded retries when Shopify's native Save control is not yet mounted during initial toolbar injection.
- Disabled loading-icon rotation when the operating system requests reduced motion.

## [1.0.1] - 2026-08-01

### Fixed

- The discard control now follows Shopify's native Save state: it is visibly disabled in clean Theme Editor sessions and becomes available when unsaved changes exist.
- Hovering the clean-state control shows a Shopify-style `There are no unsaved changes to discard.` tooltip instead of entering a transient error state.
- The expected clean-session state no longer emits a console warning.

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
