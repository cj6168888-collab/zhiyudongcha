/**
 * NavigatorConsole - Navigator-X 桌面端控制台
 * 桌面端入口 - 统御与决策中心
 */
import { useState } from "react";
import {
  Compass, Ship, Users, AlertTriangle, Activity,
  TrendingUp, Zap, Clock, CheckCircle, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function NavigatorConsole() {
  const [activeTab, setActiveTab] = useState<'fleet' | 'reports' | 'alerts' | 'experts'>('fleet');

  const [stats] = useState({
    totalNodes: 12,
    activeNodes: 10,
    pendingReports: 5,
    activeAlerts: 2,
    fleetMorale: 78,
  });

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest">Navigator-X</h1>
              <p className="text-[10px] text-gray-500 font-mono">SOVEREIGN TERMINAL</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[8px] text-gray-500 uppercase">Status</p>
              <p className="text-sm font-bold text-green-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                ONLINE
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#0a0a0f] border-b border-white/10 px-6">
        <nav className="flex gap-6">
          {[
            { id: 'fleet', label: '舰队', icon: Ship },
            { id: 'reports', label: '汇报', icon: Activity },
            { id: 'alerts', label: '预警', icon: AlertTriangle },
            { id: 'experts', label: '专家', icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "py-4 px-2 border-b-2 transition-all flex items-center gap-2",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-bold">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Stats */}
      <div className="p-6 grid grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Ship className="w-5 h-5 text-primary" />
            <span className="text-[10px] text-gray-500 uppercase">Fleet Size</span>
          </div>
          <p className="text-3xl font-black text-white">{stats.totalNodes}</p>
          <p className="text-[9px] text-green-500 mt-1">{stats.activeNodes} Active</p>
        </div>

        <div className="p-5 rounded-3xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-[10px] text-gray-500 uppercase">Pending Reports</span>
          </div>
          <p className="text-3xl font-black text-white">{stats.pendingReports}</p>
          <p className="text-[9px] text-gray-500 mt-1">Awaiting Review</p>
        </div>

        <div className="p-5 rounded-3xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-[10px] text-gray-500 uppercase">Active Alerts</span>
          </div>
          <p className="text-3xl font-black text-white">{stats.activeAlerts}</p>
          <p className="text-[9px] text-red-500 mt-1">Require Attention</p>
        </div>

        <div className="p-5 rounded-3xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-[10px] text-gray-500 uppercase">Fleet Morale</span>
          </div>
          <p className="text-3xl font-black text-white">{stats.fleetMorale}%</p>
          <p className="text-[9px] text-green-500 mt-1">Healthy</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'fleet' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Fleet Overview</h2>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 rounded-3xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold">Node #{i}</span>
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Progress</span>
                      <span>{Math.floor(Math.random() * 100)}%</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.floor(Math.random() * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Pending Reports</h2>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-5 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">N{i}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">Node #{i} Report</p>
                      <p className="text-[10px] text-gray-500">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 rounded-2xl bg-green-500/20 text-green-500">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button className="p-2 rounded-2xl bg-red-500/20 text-red-500">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-wider">Red Alerts</h2>
            <div className="p-5 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center gap-4">
              <AlertTriangle className="w-10 h-10 text-red-500" />
              <div>
                <p className="text-sm font-bold text-red-500">CRITICAL: Progress Delay</p>
                <p className="text-[10px] text-gray-400">Node #3 is behind schedule by 40%</p>
              </div>
              <button className="ml-auto px-4 py-2 rounded-2xl bg-red-500 text-white text-xs font-bold">
                Acknowledge
              </button>
            </div>
          </div>
        )}

        {activeTab === 'experts' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-wider">High Council</h2>
            <div className="grid grid-cols-5 gap-3">
              {['Legal', 'Finance', 'Strategy', 'Psychology', 'Secretary'].map((expert) => (
                <div key={expert} className="p-4 rounded-3xl bg-white/5 border border-white/10 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 mx-auto mb-2 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-xs font-bold">{expert}</p>
                  <p className="text-[8px] text-green-500 mt-1">Available</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
