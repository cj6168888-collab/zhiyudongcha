import { EventEmitter } from 'events';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('EventManager');

export interface EventSubscription {
  emitter: EventEmitter;
  event: string;
  listener: (...args: unknown[]) => void;
  name: string;
  createdAt: Date;
}

export interface EventStats {
  name: string;
  event: string;
  createdAt: Date;
  callCount: number;
  lastCalledAt?: Date;
}

export class EventManager {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private stats: Map<string, { callCount: number; lastCalledAt?: Date }> = new Map();
  private isShutdown = false;

  subscribe(
    name: string,
    emitter: EventEmitter,
    event: string,
    listener: (...args: unknown[]) => void
  ): void {
    if (this.isShutdown) {
      logger.warn({ subscription: name }, 'EventManager is shutdown, ignoring subscribe');
      return;
    }

    const wrappedListener = (...args: unknown[]) => {
      const stat = this.stats.get(name);
      if (stat) {
        stat.callCount++;
        stat.lastCalledAt = new Date();
      }

      try {
        listener(...args);
      } catch (error) {
        logger.error({ subscription: name, event, error }, 'Event listener error');
      }
    };

    emitter.on(event, wrappedListener);
    
    this.subscriptions.set(name, {
      emitter,
      event,
      listener: wrappedListener,
      name,
      createdAt: new Date(),
    });
    
    this.stats.set(name, { callCount: 0 });
    
    logger.debug({ subscription: name, event }, 'Event subscription created');
  }

  subscribeOnce(
    name: string,
    emitter: EventEmitter,
    event: string,
    listener: (...args: unknown[]) => void
  ): void {
    if (this.isShutdown) {
      logger.warn({ subscription: name }, 'EventManager is shutdown, ignoring subscribeOnce');
      return;
    }

    const wrappedListener = (...args: unknown[]) => {
      const stat = this.stats.get(name);
      if (stat) {
        stat.callCount++;
        stat.lastCalledAt = new Date();
      }

      this.subscriptions.delete(name);
      this.stats.delete(name);

      try {
        listener(...args);
      } catch (error) {
        logger.error({ subscription: name, event, error }, 'Event listener error');
      }
    };

    emitter.once(event, wrappedListener);
    
    this.subscriptions.set(name, {
      emitter,
      event,
      listener: wrappedListener,
      name,
      createdAt: new Date(),
    });
    
    this.stats.set(name, { callCount: 0 });
    
    logger.debug({ subscription: name, event }, 'One-time event subscription created');
  }

  unsubscribe(name: string): void {
    const subscription = this.subscriptions.get(name);
    if (subscription) {
      subscription.emitter.removeListener(subscription.event, subscription.listener);
      this.subscriptions.delete(name);
      this.stats.delete(name);
      logger.debug({ subscription: name }, 'Event subscription removed');
    }
  }

  unsubscribeAll(): void {
    const count = this.subscriptions.size;
    
    this.subscriptions.forEach((subscription) => {
      subscription.emitter.removeListener(subscription.event, subscription.listener);
    });
    
    this.subscriptions.clear();
    this.stats.clear();
    
    logger.info({ count }, 'All event subscriptions removed');
  }

  hasSubscription(name: string): boolean {
    return this.subscriptions.has(name);
  }

  getActiveSubscriptions(): EventStats[] {
    const result: EventStats[] = [];
    
    this.subscriptions.forEach((subscription, name) => {
      const stat = this.stats.get(name) || { callCount: 0 };
      result.push({
        name,
        event: subscription.event,
        createdAt: subscription.createdAt,
        callCount: stat.callCount,
        lastCalledAt: stat.lastCalledAt,
      });
    });
    
    return result;
  }

  getStats(): { total: number; byEvent: Map<string, number> } {
    const byEvent = new Map<string, number>();
    
    this.subscriptions.forEach((subscription) => {
      const current = byEvent.get(subscription.event) || 0;
      byEvent.set(subscription.event, current + 1);
    });
    
    return {
      total: this.subscriptions.size,
      byEvent,
    };
  }

  shutdown(): void {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    this.unsubscribeAll();
    
    logger.info('EventManager shutdown complete');
  }
}

export const eventManager = new EventManager();

process.on('SIGTERM', () => {
  eventManager.shutdown();
});

process.on('SIGINT', () => {
  eventManager.shutdown();
});
