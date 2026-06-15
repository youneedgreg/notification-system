# Security Policy

## Supported Versions

The following versions of Notification System are currently receiving security updates:

| Version | Supported          |
|---------|--------------------|
| latest (main) | ✅ Yes        |
| older branches | ❌ No        |

We recommend always running the latest version from `main`.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability, please report it responsibly by emailing:

**📧 greg@webtechsolutionske.co.ke**

Include the following in your report:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact (what an attacker could achieve)
- Any suggested fixes or mitigations (optional but appreciated)

---

## What to Expect

- **Acknowledgement** within 48 hours of your report
- **Status update** within 7 days — we will confirm whether the issue is valid and share our planned timeline for a fix
- **Credit** — if you'd like, we'll acknowledge your responsible disclosure in the fix's release notes

---

## Scope

The following are in scope for security reports:

- Authentication and authorisation bypasses
- JWT token vulnerabilities
- SQL injection or ORM misuse
- RabbitMQ or Redis exposure
- Sensitive data leakage in API responses
- Docker or container escape vulnerabilities
- Dependency vulnerabilities with a known exploit

The following are **out of scope:**

- Denial of service attacks requiring significant resources
- Issues in third-party services (SendGrid, Firebase, Mailtrap)
- Vulnerabilities in infrastructure you control (your own deployment)

---

## Security Best Practices for Deployment

Before deploying to production, ensure you have:

- [ ] Rotated all default credentials in `.env` files (DB, Redis, RabbitMQ, JWT secrets)
- [ ] Generated strong JWT secrets: `openssl rand -base64 32`
- [ ] Replaced Mailtrap SMTP with a production provider (SendGrid, AWS SES)
- [ ] Added a real Firebase service account for push notifications
- [ ] Restricted API access with firewall rules or an IP allowlist
- [ ] Enabled HTTPS via Nginx reverse proxy or a load balancer
- [ ] Stored `.env` files outside version control

---

## Disclosure Policy

We follow a **coordinated disclosure** model. We ask that you give us reasonable time to address the vulnerability before making any public disclosure. We will work with you to agree on a disclosure timeline that protects users while being fair to you as a researcher.

Thank you for helping keep Notification System and its users safe. 🙏
