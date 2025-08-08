@echo off
echo Installing required packages for webhook system...
echo Using official NestJS BullMQ implementation
echo.

npm install @nestjs/bullmq bullmq @nestjs/config class-validator class-transformer

echo.
echo Installation complete!
echo.
echo Next steps:
echo 1. Copy .env.example to .env and configure your settings
echo 2. Install and start Redis server
echo 3. Run: npm run start:dev
echo.
echo Note: This implementation uses BullMQ (modern TypeScript)
echo See BULLMQ_GUIDE.md for detailed implementation info
echo.
pause
