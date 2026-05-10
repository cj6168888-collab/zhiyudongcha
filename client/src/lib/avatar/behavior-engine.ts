/**
 * Avatar Behavior Engine (小星行为引擎)
 *
 * 实现物理惯性、视线跟随、闲置动作等自然行为
 */

export type BehaviorState = 'IDLE' | 'WALKING' | 'RUNNING' | 'SLEEPING' | 'WORKING' | 'ALERT';
export type IdleAction = 'BREATHE' | 'SWAY' | 'BLINK' | 'YAWN' | 'LEG_SWING' | 'LOOK_AROUND' | 'STRETCH';

export interface PhysicsConfig {
  mass: number;
  friction: number;
  bounciness: number;
  gravity: number;
  maxVelocity: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export interface GazeTarget {
  x: number;
  y: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface BehaviorContext {
  state: BehaviorState;
  position: Position;
  velocity: Velocity;
  gazeOffset: { x: number; y: number };
  lastAction: IdleAction | null;
  lastActionTime: number;
  isInteracting: boolean;
  energyLevel: number;
}

const DEFAULT_PHYSICS: PhysicsConfig = {
  mass: 1.0,
  friction: 0.85,
  bounciness: 0.3,
  gravity: 0.5,
  maxVelocity: 15,
};

const IDLE_ACTIONS: { action: IdleAction; weight: number; minInterval: number; duration: number }[] = [
  { action: 'BREATHE', weight: 30, minInterval: 0, duration: 3000 },
  { action: 'SWAY', weight: 20, minInterval: 5000, duration: 4000 },
  { action: 'BLINK', weight: 25, minInterval: 3000, duration: 200 },
  { action: 'YAWN', weight: 5, minInterval: 60000, duration: 2000 },
  { action: 'LEG_SWING', weight: 10, minInterval: 10000, duration: 5000 },
  { action: 'LOOK_AROUND', weight: 8, minInterval: 8000, duration: 3000 },
  { action: 'STRETCH', weight: 2, minInterval: 120000, duration: 3000 },
];

export class BehaviorEngine {
  private context: BehaviorContext;
  private physics: PhysicsConfig;
  private gazeTargets: GazeTarget[] = [];
  private animationFrame: number | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(ctx: BehaviorContext) => void> = new Set();

  constructor(initialPosition: Position = { x: 50, y: 80 }) {
    this.context = {
      state: 'IDLE',
      position: initialPosition,
      velocity: { vx: 0, vy: 0 },
      gazeOffset: { x: 0, y: 0 },
      lastAction: null,
      lastActionTime: 0,
      isInteracting: false,
      energyLevel: 100,
    };
    this.physics = { ...DEFAULT_PHYSICS };
  }

  start(): void {
    this.tick();
    this.startIdleLoop();
  }

  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private tick = (): void => {
    this.updatePhysics();
    this.updateGaze();
    this.notifyListeners();
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  private updatePhysics(): void {
    const { velocity, position } = this.context;

    velocity.vx *= this.physics.friction;
    velocity.vy *= this.physics.friction;

    if (position.y < 80) {
      velocity.vy += this.physics.gravity;
    }

    velocity.vx = Math.max(-this.physics.maxVelocity, Math.min(this.physics.maxVelocity, velocity.vx));
    velocity.vy = Math.max(-this.physics.maxVelocity, Math.min(this.physics.maxVelocity, velocity.vy));

    position.x += velocity.vx;
    position.y += velocity.vy;

    if (position.x < 5) {
      position.x = 5;
      velocity.vx = -velocity.vx * this.physics.bounciness;
    } else if (position.x > 95) {
      position.x = 95;
      velocity.vx = -velocity.vx * this.physics.bounciness;
    }

    if (position.y > 85) {
      position.y = 85;
      velocity.vy = -velocity.vy * this.physics.bounciness;
      if (Math.abs(velocity.vy) < 0.5) velocity.vy = 0;
    } else if (position.y < 10) {
      position.y = 10;
      velocity.vy = -velocity.vy * this.physics.bounciness;
    }

    if (Math.abs(velocity.vx) < 0.1) velocity.vx = 0;
    if (Math.abs(velocity.vy) < 0.1) velocity.vy = 0;
  }

  private updateGaze(): void {
    if (this.gazeTargets.length === 0) {
      this.context.gazeOffset.x *= 0.95;
      this.context.gazeOffset.y *= 0.95;
      return;
    }

    const target = this.gazeTargets.reduce((best, current) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[current.priority] > priorityOrder[best.priority] ? current : best;
    });

    const avatarCenter = {
      x: this.context.position.x,
      y: this.context.position.y - 10,
    };

    const deltaX = (target.x - avatarCenter.x) / 5;
    const deltaY = (target.y - avatarCenter.y) / 5;

    const maxOffset = 15;
    this.context.gazeOffset.x = Math.max(-maxOffset, Math.min(maxOffset, deltaX));
    this.context.gazeOffset.y = Math.max(-maxOffset / 2, Math.min(maxOffset / 2, deltaY));
  }

  private startIdleLoop(): void {
    this.idleTimer = setInterval(() => {
      if (this.context.state !== 'IDLE' || this.context.isInteracting) return;

      const now = Date.now();
      const eligibleActions = IDLE_ACTIONS.filter(
        a => now - this.context.lastActionTime >= a.minInterval
      );

      if (eligibleActions.length === 0) return;

      const totalWeight = eligibleActions.reduce((sum, a) => sum + a.weight, 0);
      let random = Math.random() * totalWeight;

      for (const actionDef of eligibleActions) {
        random -= actionDef.weight;
        if (random <= 0) {
          this.triggerIdleAction(actionDef.action, actionDef.duration);
          break;
        }
      }
    }, 2000);
  }

  private triggerIdleAction(action: IdleAction, duration: number): void {
    this.context.lastAction = action;
    this.context.lastActionTime = Date.now();

    setTimeout(() => {
      if (this.context.lastAction === action) {
        this.context.lastAction = null;
      }
    }, duration);
  }

  applyImpulse(force: { x: number; y: number }): void {
    this.context.velocity.vx += force.x / this.physics.mass;
    this.context.velocity.vy += force.y / this.physics.mass;
  }

  moveTo(target: Position, speed: number = 2): void {
    const dx = target.x - this.context.position.x;
    const dy = target.y - this.context.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      this.setState('IDLE');
      return;
    }

    const normalizedDx = (dx / distance) * speed;
    const normalizedDy = (dy / distance) * speed;

    this.context.velocity.vx = normalizedDx;
    this.context.velocity.vy = normalizedDy;

    if (speed > 5) {
      this.setState('RUNNING');
    } else if (speed > 1) {
      this.setState('WALKING');
    }
  }

  setGazeTarget(target: GazeTarget): void {
    const existing = this.gazeTargets.findIndex(t => t.priority === target.priority);
    if (existing >= 0) {
      this.gazeTargets[existing] = target;
    } else {
      this.gazeTargets.push(target);
    }
  }

  clearGazeTargets(): void {
    this.gazeTargets = [];
  }

  setState(state: BehaviorState): void {
    if (this.context.state !== state) {
      this.context.state = state;
      this.context.lastAction = null;

      if (state === 'SLEEPING') {
        this.context.velocity.vx = 0;
        this.context.velocity.vy = 0;
      }
    }
  }

  setInteracting(isInteracting: boolean): void {
    this.context.isInteracting = isInteracting;
  }

  setEnergyLevel(level: number): void {
    this.context.energyLevel = Math.max(0, Math.min(100, level));

    if (level < 20 && this.context.state === 'IDLE') {
      this.triggerIdleAction('YAWN', 2000);
    }
  }

  getContext(): BehaviorContext {
    return { ...this.context };
  }

  getPosition(): Position {
    return { ...this.context.position };
  }

  getGazeOffset(): { x: number; y: number } {
    return { ...this.context.gazeOffset };
  }

  getCurrentIdleAction(): IdleAction | null {
    return this.context.lastAction;
  }

  subscribe(listener: (ctx: BehaviorContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.context);
      } catch (e) {
        console.error('[BehaviorEngine] Listener error:', e);
      }
    });
  }
}

export function createBehaviorEngine(initialPosition?: Position): BehaviorEngine {
  return new BehaviorEngine(initialPosition);
}

export function getIdleActionAnimation(action: IdleAction): {
  keyframes: Record<string, number[]>;
  duration: number;
} {
  switch (action) {
    case 'BREATHE':
      return {
        keyframes: { scale: [1, 1.02, 1] },
        duration: 3000,
      };
    case 'SWAY':
      return {
        keyframes: { rotate: [-2, 2, -2] },
        duration: 4000,
      };
    case 'BLINK':
      return {
        keyframes: { scaleY: [1, 0.1, 1] },
        duration: 200,
      };
    case 'YAWN':
      return {
        keyframes: {
          scale: [1, 1.05, 1.08, 1.05, 1],
          rotate: [-5, 0, 5, 0, -5],
        },
        duration: 2000,
      };
    case 'LEG_SWING':
      return {
        keyframes: {
          y: [0, -2, 0, -2, 0],
        },
        duration: 5000,
      };
    case 'LOOK_AROUND':
      return {
        keyframes: {
          rotateY: [0, -15, 0, 15, 0],
        },
        duration: 3000,
      };
    case 'STRETCH':
      return {
        keyframes: {
          scaleY: [1, 1.1, 1],
          y: [0, -5, 0],
        },
        duration: 3000,
      };
    default:
      return {
        keyframes: {},
        duration: 0,
      };
  }
}

export default BehaviorEngine;
