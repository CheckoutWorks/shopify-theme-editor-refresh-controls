# Security Policy

## Supported versions

Security fixes are provided for the latest published release only. The current release line is `1.0.x`.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue.

Use [GitHub's private Security Advisory reporting channel](https://github.com/CheckoutWorks/shopify-theme-editor-refresh-controls/security/advisories/new) as the preferred reporting method. If that channel is unavailable, contact CheckoutWorks through [checkoutworks.dev](https://checkoutworks.dev/) and request a private security contact.

Include:

- The affected userscript version.
- A clear description of the issue and its impact.
- Minimal reproduction steps or a proof of concept.
- Any suggested remediation.

Do not include live credentials, session cookies, Shopify HMAC values, signed Theme Editor URLs, customer data, or unnecessary store information.

CheckoutWorks will acknowledge a valid report as soon as practical, investigate it, and coordinate remediation and disclosure with the reporter.

## Security boundaries

The userscript intentionally performs no analytics, telemetry, tracking, persistent storage, or third-party network requests. Preview messages are restricted by origin, source window, nonce, design mode, and `oseid` context. Native discard-action discovery is bounded and fails closed when Shopify's internal action cannot be identified safely.

The userscript depends on Shopify's private Theme Editor implementation. Compatibility breakage alone is not necessarily a security vulnerability, but behavior that could expose data, navigate an unexpected context, or trigger an unconfirmed destructive action should be reported privately.
