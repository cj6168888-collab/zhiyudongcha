import { eq, sql, desc, and } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { 
  devices, 
  remoteCommands,
  satelliteDevices,
  type Device, 
  type InsertDevice,
  type RemoteCommand,
  type InsertRemoteCommand,
  type SatelliteDevice,
  type InsertSatelliteDevice
} from "../../shared/schema";
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('DeviceRepository');

export class DeviceRepository extends BaseRepository<Device, InsertDevice> {
  constructor() {
    super('DeviceRepository');
  }

  protected getTable() {
    return devices;
  }

  protected getIdColumn() {
    return devices.id;
  }

  async getByTokenHash(tokenHash: string): Promise<Device | undefined> {
    const results = await this.db.select().from(devices).where(eq(devices.authTokenHash, tokenHash)).limit(1);
    return results[0];
  }

  async getAllByUserId(userId?: string): Promise<Device[]> {
    if (userId) {
      return await this.db.select().from(devices).where(eq(devices.userId, userId));
    }
    return await this.db.select().from(devices);
  }

  async updateLastSeen(id: string): Promise<Device | undefined> {
    const results = await this.db.update(devices)
      .set({ lastSeen: new Date() })
      .where(eq(devices.id, id))
      .returning();
    return results[0];
  }

  async createWithLastSeen(device: InsertDevice): Promise<Device> {
    const results = await this.db.insert(devices).values({
      ...device,
      lastSeen: new Date(),
    }).returning();
    return results[0];
  }

  async getActiveDevices(): Promise<Device[]> {
    return await this.db.select().from(devices).where(eq(devices.status, 'ONLINE'));
  }

  async updateStatus(id: string, status: string): Promise<Device | undefined> {
    const results = await this.db.update(devices)
      .set({ status })
      .where(eq(devices.id, id))
      .returning();
    return results[0];
  }
}

export class RemoteCommandRepository extends BaseRepository<RemoteCommand, InsertRemoteCommand> {
  constructor() {
    super('RemoteCommandRepository');
  }

  protected getTable() {
    return remoteCommands;
  }

  protected getIdColumn() {
    return remoteCommands.id;
  }

  async getByDeviceId(deviceId: string, limit: number = 50): Promise<RemoteCommand[]> {
    return await this.db.select().from(remoteCommands)
      .where(eq(remoteCommands.deviceId, deviceId))
      .orderBy(desc(remoteCommands.issuedAt))
      .limit(limit);
  }

  async getPending(deviceId: string): Promise<RemoteCommand[]> {
    return await this.db.select().from(remoteCommands).where(
      and(
        eq(remoteCommands.deviceId, deviceId),
        eq(remoteCommands.status, 'PENDING')
      )
    );
  }
}

export class SatelliteDeviceRepository extends BaseRepository<SatelliteDevice, InsertSatelliteDevice> {
  constructor() {
    super('SatelliteDeviceRepository');
  }

  protected getTable() {
    return satelliteDevices;
  }

  protected getIdColumn() {
    return satelliteDevices.id;
  }

  async getByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined> {
    const results = await this.db.select().from(satelliteDevices)
      .where(eq(satelliteDevices.deviceId, deviceId))
      .limit(1);
    return results[0];
  }

  async getAllByStatus(status?: string): Promise<SatelliteDevice[]> {
    if (status) {
      return await this.db.select().from(satelliteDevices).where(eq(satelliteDevices.status, status));
    }
    return await this.db.select().from(satelliteDevices);
  }

  async updateWithTimestamp(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined> {
    const results = await this.db.update(satelliteDevices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(satelliteDevices.id, id))
      .returning();
    return results[0];
  }
}

export const deviceRepository = new DeviceRepository();
export const remoteCommandRepository = new RemoteCommandRepository();
export const satelliteDeviceRepository = new SatelliteDeviceRepository();
