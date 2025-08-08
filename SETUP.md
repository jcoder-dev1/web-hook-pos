# Quick Setup Guide

## 1. Install Dependencies

Run the batch file to install required packages:
```bash
./install-packages.bat
```

Or manually run:
```bash
npm install @nestjs/bullmq bullmq @nestjs/config class-validator class-transformer
```

## 2. Setup Redis

### Option A: Local Redis (Windows)
1. Download Redis from: https://github.com/microsoftarchive/redis/releases
2. Extract and run `redis-server.exe`
3. Default port: 6379

### Option B: Docker Redis
```bash
docker run -d -p 6379:6379 redis:alpine
```

### Option C: Cloud Redis
- AWS ElastiCache
- Azure Redis Cache
- Google Cloud Memorystore

## 3. Environment Configuration

1. Copy environment file:
```bash
copy .env.example .env
```

2. Edit `.env` with your settings:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
WEBHOOK_SECRET=your-secret-here
SMS_DEFAULT_RECIPIENTS=+1234567890
EMAIL_DEFAULT_RECIPIENTS=your-email@example.com
```

## 4. Start the Application

```bash
npm run start:dev
```

The server will start on http://localhost:3000

## 5. Test the Setup

### Health Check
```bash
curl http://localhost:3000/health
```

### Get Sample Webhook Data
```bash
curl http://localhost:3000/test/webhook-sample
```

### Test Webhook Processing
```bash
curl -X POST http://localhost:3000/test/simulate-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_123",
    "event_type": "pos_save",
    "timestamp": "2024-01-01T12:00:00Z",
    "data": {
      "transactionId": "TXN_123",
      "amount": 50.00
    }
  }'
```

## 6. Production POS Webhook

Your POS system should send webhooks to:
```
POST http://localhost:3000/webhooks/pos
Authorization: Bearer your-auth-token
Content-Type: application/json
```

## Troubleshooting

### Common Issues:

1. **Redis Connection Error**
   - Ensure Redis is running: `redis-cli ping`
   - Check Redis host/port in `.env`

2. **PowerShell Execution Policy**
   - Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
   - Or run batch file as administrator

3. **Module Not Found Errors**
   - Run: `npm install` to install all dependencies
   - Check that all packages are installed correctly

4. **Port Already in Use**
   - Change PORT in `.env` file
   - Or kill process using port 3000

### Support

Check the full WEBHOOK_README.md for detailed documentation and advanced configuration options.
