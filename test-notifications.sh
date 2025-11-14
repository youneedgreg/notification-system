#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_GATEWAY="http://localhost:3000/api/v1"
USER_SERVICE="http://localhost:3001/api/v1"
EMAIL_SERVICE="http://localhost:3002/api/v1"
PUSH_SERVICE="http://localhost:3003/api/v1"
TEMPLATE_SERVICE="http://localhost:3004/api/v1"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Notification System Test Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to print test results
print_test() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Test 1: Health Checks
echo -e "${YELLOW}[1/10] Testing Health Endpoints...${NC}"
curl -s ${API_GATEWAY}/health > /dev/null && print_test $? "API Gateway Health" || print_test 1 "API Gateway Health"
curl -s ${USER_SERVICE}/health > /dev/null && print_test $? "User Service Health" || print_test 1 "User Service Health"
curl -s ${EMAIL_SERVICE}/health > /dev/null && print_test $? "Email Service Health" || print_test 1 "Email Service Health"
curl -s ${PUSH_SERVICE}/health > /dev/null && print_test $? "Push Service Health" || print_test 1 "Push Service Health"
curl -s ${TEMPLATE_SERVICE}/health > /dev/null && print_test $? "Template Service Health" || print_test 1 "Template Service Health"
echo ""

# Test 2: Create Template
    PUSH_TOKEN="ejrHWm79SSehbQczqZtrBJ:APA91bGAHCQF5_V37nqO3cUkfJXlj57rXAJZGiWUmWHbBaRANeYBOS4rUmqx4YXnjuSm9lc1DCmho9YKQPG6V_8QtVaaQwJGZ333z6YDNO-_E_1L-Dol5wU"
echo -e "${YELLOW}[2/10] Creating Email Template...${NC}"
    PUSH_NOTIF_RESPONSE=$(curl -s -X POST ${API_GATEWAY}/notifications \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d "{
        \"notification_type\": \"push\",
        \"user_id\": \"$USER_ID\",
        \"push_token\": \"$PUSH_TOKEN\",
        \"template_code\": \"ORDER_UPDATE\",
        \"variables\": {
          \"order_id\": \"ORD-12345\",
          \"status\": \"shipped\"
        },
        \"request_id\": \"test-req-push-$(date +%s)\",
        \"priority\": 2
      }")
# Test 3: Create Push Template
echo -e "${YELLOW}[3/10] Creating Push Notification Template...${NC}"
PUSH_TEMPLATE_RESPONSE=$(curl -s -X POST ${TEMPLATE_SERVICE}/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Order Update",
    "code": "ORDER_UPDATE",
    "type": "push",
    "subject": "Order #{{order_id}} Update",
    "html_content": "<p>Your order #{{order_id}} is now {{status}}</p>",
    "text_content": "Your order #{{order_id}} is now {{status}}",
    "variables": ["order_id", "status"]
  }')
echo "$PUSH_TEMPLATE_RESPONSE" | head -c 300
print_test $? "Create Order Update Push Template"
echo ""

# Test 4: Get All Templates
echo -e "${YELLOW}[4/10] Fetching All Templates...${NC}"
TEMPLATES=$(curl -s ${TEMPLATE_SERVICE}/templates)
TEMPLATE_COUNT=$(echo "$TEMPLATES" | grep -o '"total":[0-9]*' | cut -d':' -f2)
echo "Found $TEMPLATE_COUNT templates"
print_test $? "Fetch All Templates"
echo ""

# Test 5: User Registration
echo -e "${YELLOW}[5/10] Registering New User...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST ${USER_SERVICE}/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser2@example.com",
    "password": "SecurePass123!",
    "name": "Test User",
    "preferences": {
      "email_enabled": true,
      "push_enabled": true
    }
  }')
echo "$REGISTER_RESPONSE" | head -c 300
print_test $? "User Registration"
echo -e "\n"

# Test 6: User Login
echo -e "${YELLOW}[6/10] Logging In...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST ${USER_SERVICE}/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser2@example.com",
    "password": "SecurePass123!"
  }')
echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' 2>/dev/null || echo "$LOGIN_RESPONSE"
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ACCESS_TOKEN" ]; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
fi
print_test $? "User Login"
echo -e "${BLUE}Access Token: ${ACCESS_TOKEN:0:50}...${NC}\n"

# Test 7: Get User Profile
if [ -n "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}[7/10] Fetching User Profile...${NC}"
    PROFILE_RESPONSE=$(curl -s ${API_GATEWAY}/auth/me \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    echo "$PROFILE_RESPONSE" | head -c 500
    USER_ID=$(echo "$PROFILE_RESPONSE" | grep -o '"sub":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -z "$USER_ID" ]; then
        USER_ID=$(echo "$PROFILE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
    print_test $? "Get User Profile"
    echo -e "\n${BLUE}User ID: ${USER_ID}${NC}\n"
else
    echo -e "${RED}[7/10] Skipping - No access token${NC}\n"
fi

# Test 8: Send Email Notification
if [ -n "$ACCESS_TOKEN" ] && [ -n "$USER_ID" ]; then
    echo -e "${YELLOW}[8/10] Sending Email Notification...${NC}"
    EMAIL_NOTIF_RESPONSE=$(curl -s -X POST ${API_GATEWAY}/notifications \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d "{
        \"notification_type\": \"email\",
        \"user_id\": \"$USER_ID\",
        \"email\": \"testuser2@example.com\",
        \"template_code\": \"welcome_email\",
        \"variables\": {
          \"name\": \"Test User\",
          \"app_name\": \"Notification System\",
          \"link\": \"https://example.com/welcome\"
        },
        \"request_id\": \"test-req-email-$(date +%s)\",
        \"priority\": 1
      }")
    echo "$EMAIL_NOTIF_RESPONSE" | head -c 500
    EMAIL_NOTIF_ID=$(echo "$EMAIL_NOTIF_RESPONSE" | grep -o '"notification_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    print_test $? "Send Email Notification"
    echo -e "\n${BLUE}Notification ID: ${EMAIL_NOTIF_ID}${NC}\n"
else
    echo -e "${RED}[8/10] Skipping - No access token${NC}\n"
fi

# Test 9: Send Push Notification
if [ -n "$ACCESS_TOKEN" ] && [ -n "$USER_ID" ]; then
    echo -e "${YELLOW}[9/10] Sending Push Notification...${NC}"
    PUSH_NOTIF_RESPONSE=$(curl -s -X POST ${API_GATEWAY}/notifications \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d "{
        \"notification_type\": \"push\",
        \"user_id\": \"$USER_ID\",
        \"push_token\": \"ejrHWm79SSehbQczqZtrBJ:APA91bGAHCQF5_V37nqO3cUkfJXlj57rXAJZGiWUmWHbBaRANeYBOS4rUmqx4YXnjuSm9lc1DCmho9YKQPG6V_8QtVaaQwJGZ333z6YDNO-_E_1L-Dol5wU\",
        \"template_code\": \"ORDER_UPDATE\",
        \"variables\": {
          \"order_id\": \"ORD-12345\",
          \"status\": \"shipped\"
        },
        \"request_id\": \"test-req-push-$(date +%s)\",
        \"priority\": 2
      }")
    echo "$PUSH_NOTIF_RESPONSE" | head -c 500
    PUSH_NOTIF_ID=$(echo "$PUSH_NOTIF_RESPONSE" | grep -o '"notification_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    print_test $? "Send Push Notification"
    echo -e "\n${BLUE}Notification ID: ${PUSH_NOTIF_ID}${NC}\n"
else
    echo -e "${RED}[9/10] Skipping - No access token${NC}\n"
fi

# Test 10: Send Broadcast Notification (Email + Push)
if [ -n "$ACCESS_TOKEN" ] && [ -n "$USER_ID" ]; then
    echo -e "${YELLOW}[10/11] Sending Broadcast Notification (Email + Push)...${NC}"
    BROADCAST_RESPONSE=$(curl -s -X POST ${API_GATEWAY}/notifications/broadcast \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d "{
        \"user_id\": \"$USER_ID\",
        \"email\": \"testuser2@example.com\",
        \"push_token\": \"$PUSH_TOKEN\",
        \"email_template_code\": \"welcome_email\",
        \"push_template_code\": \"ORDER_UPDATE\",
        \"variables\": {
          \"name\": \"Test User\",
          \"app_name\": \"Notification System\",
          \"order_id\": \"ORD-BROADCAST-001\",
          \"status\": \"delivered\",
          \"link\": \"https://example.com/orders\"
        },
        \"request_id\": \"test-req-broadcast-$(date +%s)\",
        \"priority\": 1
      }")
    echo "$BROADCAST_RESPONSE" | head -c 500
    BROADCAST_EMAIL_ID=$(echo "$BROADCAST_RESPONSE" | grep -o '"email":{[^}]*"notification_id":"[^"]*"' | grep -o '"notification_id":"[^"]*"' | cut -d'"' -f4)
    BROADCAST_PUSH_ID=$(echo "$BROADCAST_RESPONSE" | grep -o '"push":{[^}]*"notification_id":"[^"]*"' | grep -o '"notification_id":"[^"]*"' | cut -d'"' -f4)
    print_test $? "Send Broadcast Notification"
    echo -e "\n${BLUE}Email Notification ID: ${BROADCAST_EMAIL_ID}${NC}"
    echo -e "${BLUE}Push Notification ID: ${BROADCAST_PUSH_ID}${NC}\n"
    
    # Check status after 3 seconds
    if [ -n "$BROADCAST_EMAIL_ID" ]; then
        echo -e "${YELLOW}Checking broadcast notification statuses...${NC}"
        sleep 3
        EMAIL_STATUS=$(curl -s "${API_GATEWAY}/notifications/status/${BROADCAST_EMAIL_ID}" \
          -H "Authorization: Bearer $ACCESS_TOKEN" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        PUSH_STATUS=$(curl -s "${API_GATEWAY}/notifications/status/${BROADCAST_PUSH_ID}" \
          -H "Authorization: Bearer $ACCESS_TOKEN" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}Email Status: ${EMAIL_STATUS}${NC}"
        echo -e "${GREEN}Push Status: ${PUSH_STATUS}${NC}\n"
    fi
else
    echo -e "${RED}[10/11] Skipping - No access token${NC}\n"
fi

# Test 11: Get Notification Stats
if [ -n "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}[11/11] Fetching Notification Stats...${NC}"
    sleep 2  # Wait for notifications to process
    HISTORY_RESPONSE=$(curl -s "${API_GATEWAY}/notifications/stats" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    echo "$HISTORY_RESPONSE" | head -c 500
    print_test $? "Fetch Notification Stats"
else
    echo -e "${RED}[11/11] Skipping - No access token${NC}\n"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}   Test Suite Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "\n${YELLOW}📧 Check your Mailtrap inbox: https://mailtrap.io${NC}"
echo -e "${YELLOW}🐰 RabbitMQ Management UI: http://localhost:15672${NC}"
echo -e "${YELLOW}📊 Grafana Dashboard: http://localhost:3100${NC}"
echo -e "\n${GREEN}Note: Email notifications are sent to Mailtrap, not real email addresses.${NC}"
echo -e "${GREEN}Push notifications require valid FCM device tokens to be delivered.${NC}\n"
