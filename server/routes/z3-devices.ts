import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Z3Devices');

import type { Express, Request, Response } from "express";
import type { Device, RemoteCommand, InsertRemoteCommand } from "@shared/schema";
import { WebSocket } from "ws";
import type { IStorage } from "../storage";
import type { RegisterRouteFn, RouteContext } from "./types";
import { z3DevicesService } from "../services/Z3DevicesService";
import { requireMaster, auditAction } from "../middleware/auth";
import {
  getCurrentPresenceState,
  getModeTransitionHistory,
  processVoiceEvent,
  processDeviceEvent,
  triggerEmergencyMode,
  clearEmergencyMode,
  clearGuestPresence,
  updateMasterActivity,
  resetPresenceState,
  checkMasterInactivity,
  type DeviceEvent,
} from "../services/presenceDetection";

function broadcastToDevice(
  connectedUsers: Map<WebSocket, { deviceId?: string }>,
  deviceId: string,
  message: Record<string, unknown>
) {
  Array.from(connectedUsers.entries()).forEach(([ws, user]) => {
    if (user.deviceId === deviceId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

function broadcastCommandStatus(
  connectedUsers: Map<WebSocket, { deviceId?: string }>,
  command: RemoteCommand
) {
  const message = {
    type: 'COMMAND_STATUS',
    command: {
      id: command.id,
      status: command.status,
      resultPayload: command.resultPayload,
      errorMessage: command.errorMessage,
      acknowledgedAt: command.acknowledgedAt,
      completedAt: command.completedAt,
    },
  };
  
  Array.from(connectedUsers.entries()).forEach(([ws]) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

export const registerZ3DevicesRoutes: RegisterRouteFn = (
  app: Express,
  storage: IStorage,
  context: RouteContext
) => {
  const { z3Clients, connectedUsers, broadcastDataChange } = context;

  app.get("/api/z3/status", (req, res) => {
    const users = Array.from(connectedUsers.values()).map(u => ({
      userId: u.userId,
      username: u.username,
      role: u.role,
      deviceType: u.deviceType,
      connectedAt: u.connectedAt,
    }));
    
    res.json({
      connectedDevices: z3Clients.size,
      onlineUsers: users,
      wsPath: "/ws/z3",
      protocol: "SpiritCore_Stream_v7",
    });
  });

  app.get("/api/z3/devices", requireMaster, async (req, res) => {
    try {
       const devices = await z3DevicesService.getAllDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  app.post("/api/z3/devices/register", requireMaster, async (req, res) => {
    try {
      const { deviceName, deviceType, userId, capabilities } = req.body;
      if (!deviceName || !deviceType) {
        return res.status(400).json({ error: "Missing deviceName or deviceType" });
      }

      const authToken = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const crypto = await import('crypto');
      const authTokenHash = crypto.createHash('sha256').update(authToken).digest('hex');

       const device = await z3DevicesService.createDevice({
        userId: userId || 'MASTER',
        deviceName,
        deviceType,
        capabilities: capabilities || ['WAKE', 'SLEEP', 'PING', 'PUSH_MESSAGE'],
        authTokenHash,
        status: 'ONLINE',
        ipAddress: req.ip || undefined,
        userAgent: req.headers['user-agent'] || undefined,
      });

      await auditAction('DEVICE_REGISTERED', req.userRole || 'MASTER', 'device', device.id, { deviceName, deviceType }, 'SUCCESS', req);

      res.status(201).json({
        ...device,
        authToken,
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to register device", details: error });
    }
  });

  app.post("/api/z3/devices/:id/heartbeat", async (req, res) => {
    try {
       const device = await z3DevicesService.updateDeviceHeartbeat(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

       const pendingCommands = await z3DevicesService.getPendingCommands(req.params.id);
      res.json({
        device,
        pendingCommands,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });

  app.get("/api/z3/devices/:id", requireMaster, async (req, res) => {
     try {
       const device = await z3DevicesService.getDevice(req.params.id);
       if (!device) {
         return res.status(404).json({ error: "Device not found" });
       }
       res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device" });
    }
  });

  app.patch("/api/z3/devices/:id", requireMaster, async (req, res) => {
    try {
      const { status, deviceName, capabilities } = req.body;
      const updates: Partial<Pick<Device, 'status' | 'deviceName' | 'capabilities'>> = {};
      if (status) updates.status = status;
      if (deviceName) updates.deviceName = deviceName;
      if (capabilities) updates.capabilities = capabilities;

       const device = await z3DevicesService.updateDevice(req.params.id, updates);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to update device" });
    }
  });

  app.delete("/api/z3/devices/:id", requireMaster, async (req, res) => {
    try {
       const success = await z3DevicesService.deleteDevice(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Device not found" });
      }
      await auditAction('DEVICE_DELETED', req.userRole || 'MASTER', 'device', req.params.id, {}, 'SUCCESS', req);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device" });
    }
  });

  app.post("/api/z3/devices/:id/commands", requireMaster, async (req, res) => {
    try {
      const { commandType, payload } = req.body;
      if (!commandType) {
        return res.status(400).json({ error: "Missing commandType" });
      }

       const device = await z3DevicesService.getDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

       const command = await z3DevicesService.createRemoteCommand({
        deviceId: req.params.id,
        commandType,
        payload: payload || {},
        status: 'PENDING',
        issuedBy: req.userRole || 'MASTER',
      });

      broadcastToDevice(connectedUsers, req.params.id, {
        type: 'REMOTE_COMMAND',
        command: {
          id: command.id,
          commandType: command.commandType,
          payload: command.payload,
          issuedAt: command.issuedAt,
        },
      });

      await auditAction('COMMAND_SENT', req.userRole || 'MASTER', 'remote_command', command.id, { deviceId: req.params.id, commandType }, 'SUCCESS', req);

      res.status(201).json(command);
    } catch (error) {
      res.status(400).json({ error: "Failed to send command", details: error });
    }
  });

  app.get("/api/z3/devices/:id/commands", requireMaster, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
       const commands = await z3DevicesService.getDeviceCommands(req.params.id, limit);
      res.json(commands);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch commands" });
    }
  });

  app.post("/api/z3/commands/:id/ack", async (req, res) => {
    try {
      const { status, resultPayload, errorMessage } = req.body;
       const updates: Record<string, unknown> = { status: status || 'ACKNOWLEDGED' };
      
      if (status === 'ACKNOWLEDGED') {
        updates.acknowledgedAt = new Date();
      } else if (status === 'COMPLETED' || status === 'FAILED') {
        updates.completedAt = new Date();
        if (resultPayload) updates.resultPayload = resultPayload;
        if (errorMessage) updates.errorMessage = errorMessage;
      }

       const command = await z3DevicesService.updateRemoteCommand(req.params.id, updates);
      if (!command) {
        return res.status(404).json({ error: "Command not found" });
      }

      broadcastCommandStatus(connectedUsers, command);

      res.json(command);
    } catch (error) {
      res.status(500).json({ error: "Failed to acknowledge command" });
    }
  });

  app.post("/api/z3/devices/:id/request-primary", requireMaster, async (req, res) => {
    try {
       const requestingDevice = await z3DevicesService.getDevice(req.params.id);
      if (!requestingDevice) {
        return res.status(404).json({ error: "Device not found" });
      }

       const allDevices = await z3DevicesService.getAllDevices(requestingDevice.userId);
      const onlineDevices = allDevices.filter(d => d.status === 'ONLINE' || d.status === 'BUSY');
      const currentPrimary = onlineDevices.find(d => d.status === 'BUSY');

      if (currentPrimary && currentPrimary.id !== req.params.id) {
         await z3DevicesService.updateDevice(currentPrimary.id, { status: 'ONLINE' });
        
        broadcastToDevice(connectedUsers, currentPrimary.id, {
          type: 'DEVICE_DEMOTED',
          message: `设备 ${requestingDevice.deviceName} 已接管主控权`,
          newPrimaryDevice: req.params.id,
        });
        
        await auditAction('DEVICE_DEMOTED', req.userRole || 'MASTER', 'device', currentPrimary.id, 
          { demotedBy: req.params.id }, 'SUCCESS', req);
      }

       await z3DevicesService.updateDevice(req.params.id, { status: 'BUSY' });
      
      broadcastToDevice(connectedUsers, req.params.id, {
        type: 'DEVICE_PROMOTED',
        message: '已成为主控设备',
      });

      await auditAction('DEVICE_PROMOTED', req.userRole || 'MASTER', 'device', req.params.id, 
        { previousPrimary: currentPrimary?.id }, 'SUCCESS', req);

      res.json({ 
        success: true, 
        primaryDeviceId: req.params.id,
        previousPrimary: currentPrimary?.id,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to request primary status" });
    }
  });

  app.get("/api/z3/devices/primary", requireMaster, async (req, res) => {
    try {
      const userId = req.query.userId as string || "master";
       const allDevices = await z3DevicesService.getAllDevices(userId);
      const primaryDevice = allDevices.find(d => d.status === 'BUSY');
      
      if (!primaryDevice) {
        const onlineDevice = allDevices.find(d => d.status === 'ONLINE');
        return res.json({ 
          hasPrimary: false, 
          suggestedDevice: onlineDevice?.id,
          onlineCount: allDevices.filter(d => d.status === 'ONLINE').length,
          userId,
        });
      }

      res.json({ 
        hasPrimary: true, 
        primaryDevice,
        onlineCount: allDevices.filter(d => d.status === 'ONLINE' || d.status === 'BUSY').length,
        userId,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get primary device" });
    }
  });

  app.post("/api/z3/devices/resolve-conflict", requireMaster, async (req, res) => {
    try {
      const { deviceIds, priority } = req.body;
      if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length < 2) {
        return res.status(400).json({ error: "需要至少两个设备ID进行冲突仲裁" });
      }

       const devices = await Promise.all(deviceIds.map(id => z3DevicesService.getDevice(id)));
      const validDevices = devices.filter((d): d is Device => d !== undefined);
      
      if (validDevices.length < 2) {
        return res.status(400).json({ error: "设备不存在" });
      }

      const firstUserId = validDevices[0].userId;
      const sameUser = validDevices.every(d => d.userId === firstUserId);
      if (!sameUser) {
        return res.status(400).json({ error: "只能仲裁同一用户的设备" });
      }

      let winner: Device;
      
      switch (priority) {
        case 'newest':
          winner = validDevices.sort((a, b) => 
            new Date(b.lastSeen || 0).getTime() - new Date(a.lastSeen || 0).getTime()
          )[0];
          break;
        case 'desktop_first':
          winner = validDevices.find(d => d.deviceType === 'desktop') || validDevices[0];
          break;
        case 'mobile_first':
          winner = validDevices.find(d => d.deviceType === 'mobile') || validDevices[0];
          break;
        default:
          winner = validDevices[0];
      }

      const updateErrors: string[] = [];
      for (const device of validDevices) {
        try {
          if (device.id === winner.id) {
             await z3DevicesService.updateDevice(device.id, { status: 'BUSY' });
          } else {
             await z3DevicesService.updateDevice(device.id, { status: 'ONLINE' });
            broadcastToDevice(connectedUsers, device.id, {
              type: 'CONFLICT_RESOLVED',
              message: `冲突已解决，${winner.deviceName} 成为主控设备`,
              winnerId: winner.id,
              yourStatus: 'standby',
            });
          }
        } catch (err) {
          updateErrors.push(`设备 ${device.id} 更新失败`);
        }
      }

      if (updateErrors.length > 0 && updateErrors.length === validDevices.length) {
        return res.status(500).json({ error: "所有设备更新失败", details: updateErrors });
      }

      await auditAction('DEVICE_CONFLICT_RESOLVED', req.userRole || 'MASTER', 'device', winner.id, 
        { participants: deviceIds, priority, winner: winner.id, partialErrors: updateErrors }, 'SUCCESS', req);

      res.json({
        success: true,
        winner: winner.id,
        winnerName: winner.deviceName,
        resolution: priority || 'first_come',
        partialErrors: updateErrors.length > 0 ? updateErrors : undefined,
      });
    } catch (error) {
      res.status(500).json({ error: "冲突仲裁失败" });
    }
  });

  app.get("/api/z3/presence/state", requireMaster, (req, res) => {
    try {
      const state = getCurrentPresenceState();
      const inactivity = checkMasterInactivity();
      res.json({
        ...state,
        inactivity,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ error: "获取存在状态失败" });
    }
  });

  app.get("/api/z3/presence/history", requireMaster, (req, res) => {
    try {
      const history = getModeTransitionHistory();
      res.json({
        transitions: history,
        count: history.length,
      });
    } catch (error) {
      res.status(500).json({ error: "获取模式切换历史失败" });
    }
  });

  app.post("/api/z3/presence/voice-event", requireMaster, async (req, res) => {
    try {
      const { audioData, duration, sampleRate } = req.body;
      if (!audioData || !Array.isArray(audioData)) {
        return res.status(400).json({ error: "音频数据无效" });
      }

      const voiceSample = { audioData, duration: duration || 3, sampleRate: sampleRate || 16000 };
       const masterVoice = await z3DevicesService.getMasterVoiceprint();
      const template = (masterVoice?.featureVector as number[]) || null;
      
      const result = processVoiceEvent(voiceSample, template);
      
      if (result.transition) {
        broadcastDataChange('presence', 'UPDATE', { transition: result.transition });
      }
      
      res.json({
        newMode: result.newMode,
        transition: result.transition,
        state: getCurrentPresenceState(),
      });
    } catch (error) {
      res.status(500).json({ error: "处理声音事件失败" });
    }
  });

  app.post("/api/z3/presence/device-event", requireMaster, (req, res) => {
    try {
      const { type, metadata } = req.body;
      if (!type) {
        return res.status(400).json({ error: "事件类型必填" });
      }

      const event: DeviceEvent = {
        type,
        timestamp: new Date(),
        metadata,
      };
      
      const result = processDeviceEvent(event);
      
      if (result.transition) {
        broadcastDataChange('presence', 'UPDATE', { transition: result.transition });
      }
      
      res.json({
        newMode: result.newMode,
        transition: result.transition,
        state: getCurrentPresenceState(),
      });
    } catch (error) {
      res.status(500).json({ error: "处理设备事件失败" });
    }
  });

  app.post("/api/z3/presence/emergency", requireMaster, (req, res) => {
    try {
      const { reason } = req.body;
      const transition = triggerEmergencyMode(reason || '手动触发');
      
      broadcastDataChange('presence', 'UPDATE', { transition, emergency: true });
      
      res.json({
        success: true,
        transition,
        state: getCurrentPresenceState(),
      });
    } catch (error) {
      res.status(500).json({ error: "触发紧急模式失败" });
    }
  });

  app.post("/api/z3/presence/clear-emergency", requireMaster, (req, res) => {
    try {
      const result = clearEmergencyMode(true);
      
      if (result.transition) {
        broadcastDataChange('presence', 'UPDATE', { transition: result.transition, emergency: false });
      }
      
      res.json({
        newMode: result.newMode,
        transition: result.transition,
        state: getCurrentPresenceState(),
      });
    } catch (error) {
      res.status(500).json({ error: "解除紧急模式失败" });
    }
  });

  app.post("/api/z3/presence/clear-guest", requireMaster, (req, res) => {
    try {
      const result = clearGuestPresence();
      
      if (result.transition) {
        broadcastDataChange('presence', 'UPDATE', { transition: result.transition });
      }
      
      res.json({
        newMode: result.newMode,
        transition: result.transition,
        state: getCurrentPresenceState(),
      });
    } catch (error) {
      res.status(500).json({ error: "清除访客状态失败" });
    }
  });

  app.post("/api/z3/presence/activity", requireMaster, (req, res) => {
    try {
      updateMasterActivity();
      res.json({
        success: true,
        state: getCurrentPresenceState(),
      });
    } catch (error) {
      res.status(500).json({ error: "更新活动状态失败" });
    }
  });

  app.post("/api/z3/presence/reset", requireMaster, (req, res) => {
    try {
      resetPresenceState();
      res.json({
        success: true,
        state: getCurrentPresenceState(),
      });
    } catch (error) {
      res.status(500).json({ error: "重置存在状态失败" });
    }
  });
};
