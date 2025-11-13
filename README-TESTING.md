# Notification System - Testing Guide

## Quick Start Testing

### 1. Start All Services

```bash
# Option 1: Use startup script
npm start

# Option 2: Start services separately
docker-compose up -d
npm run start:all
```

### 2. Run Automated Tests

```bash
# Run complete test suite
bash test-notifications.sh
```

This will test:
- ✅ Health checks for all services
- ✅ Template creation (email & push)
- ✅ User registration
- ✅ User login & authentication
- ✅ Sending email notifications
- ✅ Sending push notifications
- ✅ Fetching notification history

### 3. Manual Testing with REST Client

Open `test-notifications.http` in VS Code with the REST Client extension and execute requests manually.

## Service Endpoints

### API Gateway
- **Base URL**: `http://localhost:3000/api/v1`
- **Health**: `GET /health`
- **Swagger**: `http://localhost:3000/api/docs`

### User Service
- **Base URL**: `http://localhost:4000/api/v1`
- **Health**: `GET /health`

### Email Service
- **Base URL**: `http://localhost:3001/api/v1`
- **Health**: `GET /health`

### Push Service
- **Base URL**: `http://localhost:3002/api/v1`
- **Health**: `GET /health`

### Template Service
- **Base URL**: `http://localhost:3004/api/v1`
- **Health**: `GET /health`

## Test Scenarios

### Scenario 1: Complete User Flow

1. **Register a new user**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

2. **Login and get token**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

3. **Send notification**
```bash
curl -X POST http://localhost:3000/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "email",
    "recipient": "user@example.com",
    "template_code": "WELCOME_EMAIL",
    "variables": {
      "username": "John Doe",
      "app_name": "Notification System"
    }
  }'
```

### Scenario 2: Template Management

1. **Create email template**
```bash
curl -X POST http://localhost:3004/api/v1/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Email",
    "code": "WELCOME_EMAIL",
    "type": "email",
    "subject": "Welcome to {{app_name}}!",
    "html_content": "<h1>Welcome {{username}}!</h1>",
    "variables": ["username", "app_name"]
  }'
```

2. **Get all templates**
```bash
curl http://localhost:3004/api/v1/templates
```

3. **Get template by code**
```bash
curl http://localhost:3004/api/v1/templates/code/WELCOME_EMAIL
```

### Scenario 3: Push Notifications

1. **Register device token**
```bash
curl -X PATCH http://localhost:3000/api/v1/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "push_token": "fcm_device_token_12345"
  }'
```

2. **Send push notification**
```bash
curl -X POST http://localhost:3000/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "push",
    "recipient": "fcm_device_token_12345",
    "template_code": "ORDER_UPDATE",
    "variables": {
      "order_id": "ORD-12345",
      "status": "shipped"
    }
  }'
```

## Monitoring & Debugging

### RabbitMQ Management UI
- **URL**: http://localhost:15672
- **Username**: `rabbitmq_user`
- **Password**: `rabbitmq_pass_2024`

**Check Queues**:
- `email.queue` - Email notifications
- `push.queue` - Push notifications
- `failed.queue` - Failed notifications (DLQ)

### Prometheus Metrics
- **URL**: http://localhost:9090
- Query metrics for service health and performance

### Grafana Dashboards
- **URL**: http://localhost:3100
- **Username**: `admin`
- **Password**: `admin123`

### PostgreSQL Database
```bash
# Connect to database
docker exec -it notification-postgres psql -U notif_user -d notification_system

# View notifications table
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

# View users table
SELECT id, email, name, created_at FROM users;

# Check notification status counts
SELECT status, COUNT(*) FROM notifications GROUP BY status;
```

### Redis Cache
```bash
# Connect to Redis
docker exec -it notification-redis redis-cli

# Check cached data
KEYS *
GET key_name
```

## Common Issues & Solutions

### Issue: Database connection error
**Solution**: Ensure database exists
```bash
docker exec notification-postgres psql -U notif_user -d postgres -c "CREATE DATABASE notification_system;"
```

### Issue: RabbitMQ connection refused
**Solution**: Wait for RabbitMQ to fully start
```bash
docker-compose ps
# Wait until rabbitmq shows "Up" status
```

### Issue: Push notifications not sending
**Solution**: Check Firebase configuration
- Verify `FIREBASE_SERVICE_ACCOUNT_PATH` in push-service `.env`
- Ensure Firebase credentials are valid
- Check push-service logs for Firebase initialization

### Issue: Email not sending
**Solution**: Check email service configuration
- Verify SMTP settings in email-service `.env`
- Check email-service logs
- Test with a valid email provider

## Performance Testing

### Load Testing with Apache Bench
```bash
# Test user registration
ab -n 100 -c 10 -p register.json -T application/json \
  http://localhost:3000/api/v1/auth/register

# Test notification sending (requires auth token)
ab -n 1000 -c 50 -p notification.json -T application/json \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/notifications/send
```

### Monitoring Queue Performance
```bash
# Watch RabbitMQ queue stats
watch -n 1 'curl -s -u rabbitmq_user:rabbitmq_pass_2024 \
  http://localhost:15672/api/queues | jq ".[].messages"'
```

## Test Data Cleanup

### Clear all data
```bash
# Stop and remove all volumes
npm run docker:clean

# Restart fresh
docker-compose up -d
```

### Clear specific data
```bash
# Clear notifications
docker exec -it notification-postgres psql -U notif_user -d notification_system \
  -c "TRUNCATE notifications CASCADE;"

# Flush Redis cache
docker exec -it notification-redis redis-cli FLUSHALL

# Purge RabbitMQ queues
docker exec notification-rabbitmq rabbitmqctl purge_queue email.queue
docker exec notification-rabbitmq rabbitmqctl purge_queue push.queue
```

## CI/CD Testing

See `.github/workflows/` for automated testing pipelines (if configured).

## Need Help?

- Check service logs: `docker-compose logs [service-name]`
- View all logs: `docker-compose logs -f`
- Check specific microservice: `cd apps/[service-name] && npm run start:dev`
