import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('health')
export class HealthController {
  constructor(
    @InjectQueue('notification-queue') private notificationQueue: Queue,
  ) {}

  @Get()
  async healthCheck() {
    try {
      const queueHealth = await this.checkQueueHealth();
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          api: 'ok',
          queue: queueHealth.status,
          redis: queueHealth.redis
        },
        queue_stats: queueHealth.stats
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        services: {
          api: 'ok',
          queue: 'error',
          redis: 'unknown'
        }
      };
    }
  }

  private async checkQueueHealth() {
    try {
      const waiting = await this.notificationQueue.getWaiting();
      const active = await this.notificationQueue.getActive();
      const completed = await this.notificationQueue.getCompleted();
      const failed = await this.notificationQueue.getFailed();

      return {
        status: 'ok',
        redis: 'connected',
        stats: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        redis: 'disconnected',
        stats: null
      };
    }
  }
}
