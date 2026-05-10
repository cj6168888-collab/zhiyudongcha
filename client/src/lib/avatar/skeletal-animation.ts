/**
 * 小星 骨骼动画系统 - Spine-like Animation Engine
 *
 * 功能：
 * 1. 骨骼层级系统（Bone Hierarchy）
 * 2. IK约束（Inverse Kinematics）
 * 3. 物理模拟（Physics for hair/skirt）
 * 4. 眼神跟随（LookAt）
 * 5. 呼吸状态机（Breathing State Machine）
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface Bone {
  name: string;
  parent: string | null;
  length: number;
  angle: number;
  localAngle: number;
  restAngle: number;
  animationAngle: number;
  physicsOffset: number;
  position: Vector2;
  localPosition: Vector2;
  scale: Vector2;
  constraints: BoneConstraint[];
  physics?: PhysicsProperties;
}

export interface BoneConstraint {
  type: 'IK' | 'ROTATION' | 'LIMIT';
  target?: string;
  minAngle?: number;
  maxAngle?: number;
  stiffness?: number;
  damping?: number;
}

export interface PhysicsProperties {
  mass: number;
  stiffness: number;
  damping: number;
  gravity: number;
  wind: number;
  inertia: number;
  velocity: Vector2;
  acceleration: Vector2;
}

export interface SkeletonData {
  bones: Map<string, Bone>;
  slots: string[];
  animations: Map<string, Animation>;
  physicsEnabled: boolean;
}

export interface Animation {
  name: string;
  duration: number;
  loop: boolean;
  keyframes: Map<string, Keyframe[]>;
}

export interface Keyframe {
  time: number;
  angle?: number;
  position?: Vector2;
  scale?: Vector2;
  opacity?: number;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring';
}

export type AnimationState = 'IDLE' | 'BREATHING' | 'LOOK' | 'BLINK' | 'SPEAK' | 'WAVE' | 'HAPPY' | 'SAD';

const DEFAULT_PHYSICS: PhysicsProperties = {
  mass: 1.0,
  stiffness: 0.3,
  damping: 0.8,
  gravity: 0.1,
  wind: 0,
  inertia: 0.95,
  velocity: { x: 0, y: 0 },
  acceleration: { x: 0, y: 0 },
};

export function createDefaultSkeleton(): SkeletonData {
  const bones = new Map<string, Bone>();

  bones.set('root', {
    name: 'root',
    parent: null,
    length: 0,
    angle: 0,
    localAngle: 0,
    restAngle: 0,
    animationAngle: 0,
    physicsOffset: 0,
    position: { x: 0, y: 0 },
    localPosition: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    constraints: [],
  });

  bones.set('body', {
    name: 'body',
    parent: 'root',
    length: 60,
    angle: 0,
    localAngle: 0,
    restAngle: 0,
    animationAngle: 0,
    physicsOffset: 0,
    position: { x: 0, y: 0 },
    localPosition: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'LIMIT', minAngle: -5, maxAngle: 5 }],
  });

  bones.set('chest', {
    name: 'chest',
    parent: 'body',
    length: 30,
    angle: 0,
    localAngle: 0,
    restAngle: 0,
    animationAngle: 0,
    physicsOffset: 0,
    position: { x: 0, y: -60 },
    localPosition: { x: 0, y: -60 },
    scale: { x: 1, y: 1 },
    constraints: [],
  });

  bones.set('neck', {
    name: 'neck',
    parent: 'chest',
    length: 10,
    angle: 0,
    localAngle: 0,
    restAngle: 0,
    animationAngle: 0,
    physicsOffset: 0,
    position: { x: 0, y: -90 },
    localPosition: { x: 0, y: -30 },
    scale: { x: 1, y: 1 },
    constraints: [],
  });

  bones.set('head', {
    name: 'head',
    parent: 'neck',
    length: 25,
    angle: 0,
    localAngle: 0,
    restAngle: 0,
    animationAngle: 0,
    physicsOffset: 0,
    position: { x: 0, y: -100 },
    localPosition: { x: 0, y: -10 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'LIMIT', minAngle: -15, maxAngle: 15 }],
  });

  bones.set('eye_left', {
    name: 'eye_left',
    parent: 'head',
    length: 5,
    angle: 0,
    localAngle: 0,
    restAngle: 0,
    animationAngle: 0,
    physicsOffset: 0,
    position: { x: -8, y: -110 },
    localPosition: { x: -8, y: -10 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'LIMIT', minAngle: -15, maxAngle: 15 }],
  });

  bones.set('eye_right', {
    name: 'eye_right',
    parent: 'head',
    length: 5,
    angle: 0,
    localAngle: 0,
    restAngle: 0,
    animationAngle: 0,
    physicsOffset: 0,
    position: { x: 8, y: -110 },
    localPosition: { x: 8, y: -10 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'LIMIT', minAngle: -15, maxAngle: 15 }],
  });

  bones.set('pigtail_left_1', {
    name: 'pigtail_left_1',
    parent: 'head',
    length: 20,
    angle: -30,
    localAngle: -30,
    restAngle: -30,
    animationAngle: -30,
    physicsOffset: 0,
    position: { x: -15, y: -105 },
    localPosition: { x: -15, y: -5 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'IK', stiffness: 0.3, damping: 0.8 }],
    physics: { ...DEFAULT_PHYSICS, stiffness: 0.25, damping: 0.7 },
  });

  bones.set('pigtail_left_2', {
    name: 'pigtail_left_2',
    parent: 'pigtail_left_1',
    length: 15,
    angle: -45,
    localAngle: -15,
    restAngle: -15,
    animationAngle: -15,
    physicsOffset: 0,
    position: { x: -25, y: -90 },
    localPosition: { x: 0, y: 20 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'IK', stiffness: 0.2, damping: 0.7 }],
    physics: { ...DEFAULT_PHYSICS, stiffness: 0.2, damping: 0.6 },
  });

  bones.set('pigtail_right_1', {
    name: 'pigtail_right_1',
    parent: 'head',
    length: 20,
    angle: 30,
    localAngle: 30,
    restAngle: 30,
    animationAngle: 30,
    physicsOffset: 0,
    position: { x: 15, y: -105 },
    localPosition: { x: 15, y: -5 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'IK', stiffness: 0.3, damping: 0.8 }],
    physics: { ...DEFAULT_PHYSICS, stiffness: 0.25, damping: 0.7 },
  });

  bones.set('pigtail_right_2', {
    name: 'pigtail_right_2',
    parent: 'pigtail_right_1',
    length: 15,
    angle: 45,
    localAngle: 15,
    restAngle: 15,
    animationAngle: 15,
    physicsOffset: 0,
    position: { x: 25, y: -90 },
    localPosition: { x: 0, y: 20 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'IK', stiffness: 0.2, damping: 0.7 }],
    physics: { ...DEFAULT_PHYSICS, stiffness: 0.2, damping: 0.6 },
  });

  bones.set('skirt_front', {
    name: 'skirt_front',
    parent: 'body',
    length: 25,
    angle: 0,
    localAngle: 0,
    restAngle: 0,
    animationAngle: 0,
    physicsOffset: 0,
    position: { x: 0, y: 0 },
    localPosition: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'LIMIT', minAngle: -20, maxAngle: 20 }],
    physics: { ...DEFAULT_PHYSICS, stiffness: 0.35, damping: 0.75 },
  });

  bones.set('skirt_left', {
    name: 'skirt_left',
    parent: 'body',
    length: 25,
    angle: -15,
    localAngle: -15,
    restAngle: -15,
    animationAngle: -15,
    physicsOffset: 0,
    position: { x: -15, y: 0 },
    localPosition: { x: -15, y: 0 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'LIMIT', minAngle: -30, maxAngle: 10 }],
    physics: { ...DEFAULT_PHYSICS, stiffness: 0.3, damping: 0.7 },
  });

  bones.set('skirt_right', {
    name: 'skirt_right',
    parent: 'body',
    length: 25,
    angle: 15,
    localAngle: 15,
    restAngle: 15,
    animationAngle: 15,
    physicsOffset: 0,
    position: { x: 15, y: 0 },
    localPosition: { x: 15, y: 0 },
    scale: { x: 1, y: 1 },
    constraints: [{ type: 'LIMIT', minAngle: -10, maxAngle: 30 }],
    physics: { ...DEFAULT_PHYSICS, stiffness: 0.3, damping: 0.7 },
  });

  return {
    bones,
    slots: ['body', 'skirt', 'chest', 'head', 'pigtails', 'eyes', 'face'],
    animations: createDefaultAnimations(),
    physicsEnabled: true,
  };
}

function createDefaultAnimations(): Map<string, Animation> {
  const animations = new Map<string, Animation>();

  animations.set('breathing', {
    name: 'breathing',
    duration: 3000,
    loop: true,
    keyframes: new Map([
      ['chest', [
        { time: 0, scale: { x: 1, y: 1 }, easing: 'easeInOut' },
        { time: 1500, scale: { x: 1.02, y: 1.03 }, easing: 'easeInOut' },
        { time: 3000, scale: { x: 1, y: 1 }, easing: 'easeInOut' },
      ]],
      ['body', [
        { time: 0, position: { x: 0, y: 0 }, opacity: 1.0, easing: 'easeInOut' },
        { time: 1500, position: { x: 0, y: -1 }, opacity: 0.98, easing: 'easeInOut' },
        { time: 3000, position: { x: 0, y: 0 }, opacity: 1.0, easing: 'easeInOut' },
      ]],
    ]),
  });

  animations.set('blink', {
    name: 'blink',
    duration: 200,
    loop: false,
    keyframes: new Map([
      ['eye_left', [
        { time: 0, scale: { x: 1, y: 1 }, easing: 'easeIn' },
        { time: 80, scale: { x: 1, y: 0.1 }, easing: 'linear' },
        { time: 200, scale: { x: 1, y: 1 }, easing: 'easeOut' },
      ]],
      ['eye_right', [
        { time: 0, scale: { x: 1, y: 1 }, easing: 'easeIn' },
        { time: 80, scale: { x: 1, y: 0.1 }, easing: 'linear' },
        { time: 200, scale: { x: 1, y: 1 }, easing: 'easeOut' },
      ]],
    ]),
  });

  animations.set('idle_sway', {
    name: 'idle_sway',
    duration: 4000,
    loop: true,
    keyframes: new Map([
      ['body', [
        { time: 0, angle: 0, easing: 'easeInOut' },
        { time: 2000, angle: 2, easing: 'easeInOut' },
        { time: 4000, angle: 0, easing: 'easeInOut' },
      ]],
      ['head', [
        { time: 0, angle: 0, easing: 'easeInOut' },
        { time: 1000, angle: -3, easing: 'easeInOut' },
        { time: 3000, angle: 3, easing: 'easeInOut' },
        { time: 4000, angle: 0, easing: 'easeInOut' },
      ]],
    ]),
  });

  animations.set('happy', {
    name: 'happy',
    duration: 1000,
    loop: false,
    keyframes: new Map([
      ['body', [
        { time: 0, position: { x: 0, y: 0 }, easing: 'spring' },
        { time: 200, position: { x: 0, y: -10 }, easing: 'spring' },
        { time: 500, position: { x: 0, y: -5 }, easing: 'spring' },
        { time: 1000, position: { x: 0, y: 0 }, easing: 'easeOut' },
      ]],
      ['eye_left', [
        { time: 0, scale: { x: 1, y: 1 }, easing: 'easeOut' },
        { time: 200, scale: { x: 1.1, y: 0.8 }, easing: 'easeOut' },
        { time: 1000, scale: { x: 1, y: 1 }, easing: 'easeOut' },
      ]],
      ['eye_right', [
        { time: 0, scale: { x: 1, y: 1 }, easing: 'easeOut' },
        { time: 200, scale: { x: 1.1, y: 0.8 }, easing: 'easeOut' },
        { time: 1000, scale: { x: 1, y: 1 }, easing: 'easeOut' },
      ]],
    ]),
  });

  return animations;
}

export class SkeletalAnimationEngine {
  private skeleton: SkeletonData;
  private currentState: AnimationState = 'IDLE';
  private activeAnimations: Map<string, { startTime: number; animation: Animation }> = new Map();
  private lastUpdateTime: number = 0;
  private lookAtTarget: Vector2 | null = null;
  private lastPosition: Vector2 = { x: 0, y: 0 };
  private movementVelocity: Vector2 = { x: 0, y: 0 };
  private opacity: number = 1.0;
  private breathingPhase: number = 0;

  constructor() {
    this.skeleton = createDefaultSkeleton();
    this.lastUpdateTime = Date.now();
    this.startAnimation('breathing');
  }

  startAnimation(name: string): void {
    const animation = this.skeleton.animations.get(name);
    if (animation) {
      this.activeAnimations.set(name, {
        startTime: Date.now(),
        animation,
      });
    }
  }

  stopAnimation(name: string): void {
    this.activeAnimations.delete(name);
  }

  setState(state: AnimationState): void {
    if (this.currentState !== state) {
      this.currentState = state;

      switch (state) {
        case 'BREATHING':
        case 'IDLE':
          this.startAnimation('breathing');
          this.startAnimation('idle_sway');
          break;
        case 'BLINK':
          this.startAnimation('blink');
          break;
        case 'HAPPY':
          this.startAnimation('happy');
          break;
      }
    }
  }

  setLookAtTarget(target: Vector2 | null): void {
    this.lookAtTarget = target;
  }

  updatePosition(newPosition: Vector2): void {
    const dt = Math.min((Date.now() - this.lastUpdateTime) / 1000, 0.1);

    this.movementVelocity = {
      x: (newPosition.x - this.lastPosition.x) / dt,
      y: (newPosition.y - this.lastPosition.y) / dt,
    };

    this.lastPosition = { ...newPosition };
  }

  update(): { bones: Map<string, Bone>; opacity: number } {
    const now = Date.now();
    const dt = Math.min((now - this.lastUpdateTime) / 1000, 0.1);
    this.lastUpdateTime = now;

    for (const bone of this.skeleton.bones.values()) {
      bone.animationAngle = bone.restAngle;
    }

    this.updateAnimations(now);

    if (this.lookAtTarget) {
      this.updateLookAt();
    }

    if (this.skeleton.physicsEnabled) {
      this.updatePhysics(dt);
    }

    this.updateBreathing(now);

    this.blendLayers();

    this.propagateTransforms();

    return {
      bones: this.skeleton.bones,
      opacity: this.opacity,
    };
  }

  private blendLayers(): void {
    for (const bone of this.skeleton.bones.values()) {
      bone.localAngle = bone.animationAngle + bone.physicsOffset;

      for (const constraint of bone.constraints) {
        if (constraint.type === 'LIMIT' && constraint.minAngle !== undefined && constraint.maxAngle !== undefined) {
          bone.localAngle = Math.max(constraint.minAngle, Math.min(constraint.maxAngle, bone.localAngle));
        }
      }
    }
  }

  private propagateTransforms(): void {
    const processOrder = [
      'root', 'body', 'chest', 'neck', 'head',
      'eye_left', 'eye_right',
      'pigtail_left_1', 'pigtail_left_2',
      'pigtail_right_1', 'pigtail_right_2',
      'skirt_front', 'skirt_left', 'skirt_right'
    ];

    for (const boneName of processOrder) {
      const bone = this.skeleton.bones.get(boneName);
      if (!bone) continue;

      if (bone.parent) {
        const parentBone = this.skeleton.bones.get(bone.parent);
        if (parentBone) {
          const parentAngleRad = (parentBone.angle * Math.PI) / 180;
          const cosA = Math.cos(parentAngleRad);
          const sinA = Math.sin(parentAngleRad);

          const rotatedX = bone.localPosition.x * cosA - bone.localPosition.y * sinA;
          const rotatedY = bone.localPosition.x * sinA + bone.localPosition.y * cosA;

          bone.position = {
            x: parentBone.position.x + rotatedX * parentBone.scale.x,
            y: parentBone.position.y + rotatedY * parentBone.scale.y,
          };

          bone.angle = parentBone.angle + bone.localAngle;
        }
      } else {
        bone.position = { ...bone.localPosition };
        bone.angle = bone.localAngle;
      }
    }
  }

  private updateAnimations(now: number): void {
    const entries = Array.from(this.activeAnimations.entries());
    for (const [name, { startTime, animation }] of entries) {
      const elapsed = now - startTime;
      const normalizedTime = animation.loop
        ? elapsed % animation.duration
        : Math.min(elapsed, animation.duration);

      const keyframeEntries = Array.from(animation.keyframes.entries());
      for (const [boneName, keyframes] of keyframeEntries) {
        const bone = this.skeleton.bones.get(boneName);
        if (bone && keyframes.length > 0) {
          this.applyKeyframes(bone, keyframes, normalizedTime);
        }
      }

      if (!animation.loop && elapsed >= animation.duration) {
        this.activeAnimations.delete(name);
      }
    }
  }

  private applyKeyframes(bone: Bone, keyframes: Keyframe[], time: number): void {
    let prevKf = keyframes[0];
    let nextKf = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (keyframes[i].time <= time && keyframes[i + 1].time >= time) {
        prevKf = keyframes[i];
        nextKf = keyframes[i + 1];
        break;
      }
    }

    const duration = nextKf.time - prevKf.time;
    const progress = duration > 0 ? (time - prevKf.time) / duration : 1;
    const easedProgress = this.applyEasing(progress, nextKf.easing);

    if (prevKf.angle !== undefined && nextKf.angle !== undefined) {
      bone.animationAngle = this.lerp(prevKf.angle, nextKf.angle, easedProgress);
    }

    if (prevKf.position && nextKf.position) {
      bone.localPosition = {
        x: this.lerp(prevKf.position.x, nextKf.position.x, easedProgress),
        y: this.lerp(prevKf.position.y, nextKf.position.y, easedProgress),
      };
    }

    if (prevKf.scale && nextKf.scale) {
      bone.scale = {
        x: this.lerp(prevKf.scale.x, nextKf.scale.x, easedProgress),
        y: this.lerp(prevKf.scale.y, nextKf.scale.y, easedProgress),
      };
    }

    if (prevKf.opacity !== undefined && nextKf.opacity !== undefined) {
      this.opacity = this.lerp(prevKf.opacity, nextKf.opacity, easedProgress);
    }
  }

  private applyEasing(t: number, easing: Keyframe['easing']): number {
    switch (easing) {
      case 'easeIn':
        return t * t;
      case 'easeOut':
        return 1 - (1 - t) * (1 - t);
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'spring':
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1
          : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      default:
        return t;
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private updateLookAt(): void {
    if (!this.lookAtTarget) return;

    const head = this.skeleton.bones.get('head');
    const eyeLeft = this.skeleton.bones.get('eye_left');
    const eyeRight = this.skeleton.bones.get('eye_right');

    if (!head) return;

    const headPos = head.position;
    const dx = this.lookAtTarget.x - headPos.x;
    const dy = this.lookAtTarget.y - headPos.y;
    const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    const clampedAngle = Math.max(-15, Math.min(15, targetAngle * 0.3));

    head.animationAngle = this.lerpAngle(head.animationAngle, head.restAngle + clampedAngle, 0.1);

    if (eyeLeft && eyeRight) {
      const eyeAngle = Math.max(-15, Math.min(15, targetAngle * 0.5));
      eyeLeft.animationAngle = this.lerpAngle(eyeLeft.animationAngle, eyeLeft.restAngle + eyeAngle, 0.15);
      eyeRight.animationAngle = this.lerpAngle(eyeRight.animationAngle, eyeRight.restAngle + eyeAngle, 0.15);
    }
  }

  private lerpAngle(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }

  private updatePhysics(dt: number): void {
    const physicalBones = ['pigtail_left_1', 'pigtail_left_2', 'pigtail_right_1', 'pigtail_right_2',
                          'skirt_front', 'skirt_left', 'skirt_right'];

    for (const boneName of physicalBones) {
      const bone = this.skeleton.bones.get(boneName);
      if (!bone || !bone.physics) continue;

      const physics = bone.physics;

      const inertiaForce = {
        x: -this.movementVelocity.x * physics.inertia * 0.01,
        y: -this.movementVelocity.y * physics.inertia * 0.01,
      };

      physics.acceleration = {
        x: inertiaForce.x + physics.wind - physics.velocity.x * physics.damping,
        y: inertiaForce.y + physics.gravity - physics.velocity.y * physics.damping,
      };

      physics.velocity.x += physics.acceleration.x * dt;
      physics.velocity.y += physics.acceleration.y * dt;

      const currentOffset = bone.physicsOffset;
      const velocityOffset = physics.velocity.x * 5;

      const springForce = -physics.stiffness * currentOffset;
      const dampingForce = -physics.damping * velocityOffset;
      const newOffset = currentOffset + velocityOffset + springForce * dt + dampingForce * dt;

      const maxOffset = 25;
      bone.physicsOffset = Math.max(-maxOffset, Math.min(maxOffset, newOffset));

      physics.velocity.x *= 0.95;
      physics.velocity.y *= 0.95;
    }
  }

  private updateBreathing(now: number): void {
    this.breathingPhase = (now % 3000) / 3000;

    const breathValue = Math.sin(this.breathingPhase * Math.PI * 2) * 0.5 + 0.5;

    this.opacity = 0.97 + breathValue * 0.03;
  }

  getBoneTransform(boneName: string): {
    position: Vector2;
    angle: number;
    scale: Vector2;
  } | null {
    const bone = this.skeleton.bones.get(boneName);
    if (!bone) return null;

    return {
      position: { ...bone.position },
      angle: bone.angle,
      scale: { ...bone.scale },
    };
  }

  getAllBones(): Map<string, Bone> {
    return this.skeleton.bones;
  }

  getOpacity(): number {
    return this.opacity;
  }

  triggerBlink(): void {
    this.startAnimation('blink');
  }

  triggerHappy(): void {
    this.startAnimation('happy');
  }
}

export const skeletalAnimationEngine = new SkeletalAnimationEngine();
