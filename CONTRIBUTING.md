# Contributing to Notification System

First off — thank you for considering a contribution! 🎉 Whether it's a bug fix, a new channel, better docs, or a test — every bit helps.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Good First Issues](#good-first-issues)

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/notification-system.git
   cd notification-system
   ```
3. **Add the upstream remote:**
   ```bash
   git remote add upstream https://github.com/youneedgreg/notification-system.git
   ```

---

## Development Setup

### Prerequisites

- Docker v24+ and Docker Compose v2.20+
- Node.js v20+
- Git v2.30+

### Option A — Full Docker (Recommended)

```bash
# Build and start all services
docker-compose up -d --build

# Check everything is running
docker-compose ps

# Run the automated test suite
bash test-notifications.sh
```

### Option B — Local Node + Docker Infrastructure

```bash
# Start infrastructure only (DB, cache, queue, monitoring)
docker-compose up -d postgres redis rabbitmq prometheus grafana

# Install dependencies
npm install

# Start all microservices locally
npm run start:all
```

### Environment Variables

Each service has its own `.env` file under `apps/<service-name>/`. The defaults work for local testing out of the box — no changes needed to get started.

> ⚠️ Never commit real credentials. All `.env` files are in `.gitignore`.

---

## Project Structure

```
notification-system/
├── apps/
│   ├── api-gateway/       # Main entry point — auth, routing
│   ├── user-service/      # User management, JWT tokens
│   ├── email-service/     # SMTP delivery (Mailtrap / SendGrid)
│   ├── push-service/      # Firebase Cloud Messaging (FCM)
│   └── template-service/  # Template CRUD + Handlebars rendering
├── docker/
│   ├── grafana/           # Dashboard provisioning configs
│   ├── postgres/          # DB init scripts
│   └── prometheus/        # Metrics scrape config
├── docs/diagrams/         # Architecture diagrams
├── docker-compose.yml     # Full stack orchestration
└── test-notifications.sh  # End-to-end test suite
```

---

## Making Changes

1. **Sync with upstream** before starting:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a branch:**
   ```bash
   git checkout -b feat/sms-channel
   # or
   git checkout -b fix/retry-on-timeout
   ```

3. **Make your changes** — keep them focused. One feature or fix per PR.

4. **Lint and format:**
   ```bash
   npm run lint:fix
   npm run format
   ```

5. **Test:**
   ```bash
   bash test-notifications.sh
   ```

6. **Commit** following the convention below, then push and open a PR.

---

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>
```

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructure, no behaviour change |
| `test` | Adding or updating tests |
| `chore` | Maintenance — deps, CI config, tooling |
| `perf` | Performance improvement |

**Examples:**
```
feat: add SMS channel via Africa's Talking
fix: circuit breaker not resetting after timeout
docs: add webhook setup to README
chore: upgrade RabbitMQ image to 3.13
test: add unit tests for template-service renderer
```

---

## Pull Request Process

1. **One concern per PR** — easier to review, faster to merge.
2. **Update the README** if your change affects setup, architecture, or usage.
3. **Add tests** where applicable.
4. **Ensure CI is green** — the GitHub Actions workflow must pass before merge.
5. **Write a clear PR description** — what problem does it solve, how did you test it?
6. A maintainer will review within **48 hours** and either merge, request changes, or leave feedback.

---

## Good First Issues

New here? Check the issues tagged [`good first issue`](https://github.com/youneedgreg/notification-system/labels/good%20first%20issue) or [`help wanted`](https://github.com/youneedgreg/notification-system/labels/help%20wanted) — they are scoped to be approachable without knowing the entire codebase.

---

## Questions?

Open a [GitHub Discussion](https://github.com/youneedgreg/notification-system/discussions) or drop a comment on any open issue. We are happy to help you get unstuck.
