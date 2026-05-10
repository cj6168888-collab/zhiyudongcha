import { deviceRepository, remoteCommandRepository, satelliteDeviceRepository } from '../../repositories';
import type { Device, RemoteCommand, SatelliteDevice, InsertDevice, InsertRemoteCommand, InsertSatelliteDevice } from '@shared/schema';

export interface IDeviceStorage {
  getDevice(id: string): Promise<Device | undefined>;
  getDeviceByToken(tokenHash: string): Promise<Device | undefined>;
  getAllDevices(userId?: string): Promise<Device[]>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined>;
  updateDeviceHeartbeat(id: string): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<boolean>;
  
  getRemoteCommand(id: string): Promise<RemoteCommand | undefined>;
  getDeviceCommands(deviceId: string, limit?: number): Promise<RemoteCommand[]>;
  getPendingCommands(deviceId: string): Promise<RemoteCommand[]>;
  createRemoteCommand(command: InsertRemoteCommand): Promise<RemoteCommand>;
  updateRemoteCommand(id: string, updates: Partial<InsertRemoteCommand>): Promise<RemoteCommand | undefined>;
  
  getSatelliteDevice(id: string): Promise<SatelliteDevice | undefined>;
  getSatelliteDeviceByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined>;
  getAllSatelliteDevices(status?: string): Promise<SatelliteDevice[]>;
  createSatelliteDevice(device: InsertSatelliteDevice): Promise<SatelliteDevice>;
  updateSatelliteDevice(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined>;
  deleteSatelliteDevice(id: string): Promise<boolean>;
}

export class DeviceStorage implements IDeviceStorage {
  async getDevice(id: string): Promise<Device | undefined> {
    return await deviceRepository.findById(id);
  }

  async getDeviceByToken(tokenHash: string): Promise<Device | undefined> {
    return await deviceRepository.getByTokenHash(tokenHash);
  }

  async getAllDevices(userId?: string): Promise<Device[]> {
    return await deviceRepository.getAllByUserId(userId);
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    return await deviceRepository.create(device);
  }

  async updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined> {
    return await deviceRepository.update(id, updates);
  }

  async updateDeviceHeartbeat(id: string): Promise<Device | undefined> {
    return await deviceRepository.updateLastSeen(id);
  }

  async deleteDevice(id: string): Promise<boolean> {
    return await deviceRepository.delete(id);
  }
  
  async getRemoteCommand(id: string): Promise<RemoteCommand | undefined> {
    return await remoteCommandRepository.findById(id);
  }

  async getDeviceCommands(deviceId: string, limit?: number): Promise<RemoteCommand[]> {
    return await remoteCommandRepository.getByDeviceId(deviceId, limit);
  }

  async getPendingCommands(deviceId: string): Promise<RemoteCommand[]> {
    return await remoteCommandRepository.getPending(deviceId);
  }

  async createRemoteCommand(command: InsertRemoteCommand): Promise<RemoteCommand> {
    return await remoteCommandRepository.create(command);
  }

  async updateRemoteCommand(id: string, updates: Partial<InsertRemoteCommand>): Promise<RemoteCommand | undefined> {
    return await remoteCommandRepository.update(id, updates);
  }
  
  async getSatelliteDevice(id: string): Promise<SatelliteDevice | undefined> {
    return await satelliteDeviceRepository.findById(id);
  }

  async getSatelliteDeviceByDeviceId(deviceId: string): Promise<SatelliteDevice | undefined> {
    return await satelliteDeviceRepository.getByDeviceId(deviceId);
  }

  async getAllSatelliteDevices(status?: string): Promise<SatelliteDevice[]> {
    return await satelliteDeviceRepository.getAllByStatus(status);
  }

  async createSatelliteDevice(device: InsertSatelliteDevice): Promise<SatelliteDevice> {
    return await satelliteDeviceRepository.create(device);
  }

  async updateSatelliteDevice(id: string, updates: Partial<InsertSatelliteDevice>): Promise<SatelliteDevice | undefined> {
    return await satelliteDeviceRepository.update(id, updates);
  }

  async deleteSatelliteDevice(id: string): Promise<boolean> {
    return await satelliteDeviceRepository.delete(id);
  }
}

export const deviceStorage = new DeviceStorage();
