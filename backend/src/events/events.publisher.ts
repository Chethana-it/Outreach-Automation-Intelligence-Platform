import Redis from 'ioredis';

export class EventsPublisher {
  private static client: Redis;
  static init(redisUrl: string) {
    if (!this.client) this.client = new Redis(redisUrl);
  }
  static async publish(event: { type: string; entityId: string; payload?: any; source?: string }) {
    if (!this.client) throw new Error('Publisher not initialized');
    await this.client.publish('events', JSON.stringify(event));
  }
}
