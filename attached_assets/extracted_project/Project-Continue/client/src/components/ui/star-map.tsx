import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface StarNode {
  id: string;
  name: string;
  role?: string;
  organization?: string;
  bondStrength: number;
  hasInterest?: boolean;
  interestStrength?: number;
  x?: number;
  y?: number;
  z?: number;
}

type ConnectionType = 'normal' | 'conflict' | 'interest';

interface Connection {
  from: string;
  to: string;
  strength: number;
  type: ConnectionType;
}

interface StarMapProps {
  nodes: StarNode[];
  connections?: Connection[];
  onNodeClick?: (node: StarNode) => void;
  selectedId?: string | null;
  className?: string;
}

export function StarMap({ nodes, connections = [], onNodeClick, selectedId, className = '' }: StarMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<StarNode | null>(null);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | undefined>(undefined);
  const glowPhase = useRef(0);

  const positionedNodes = useRef<Array<StarNode & { x: number; y: number; z: number }>>([]);

  useEffect(() => {
    positionedNodes.current = nodes.map((node, i) => {
      const phi = Math.acos(-1 + (2 * i) / nodes.length);
      const theta = Math.sqrt(nodes.length * Math.PI) * phi;
      const radius = 120 + (node.bondStrength || 0.5) * 30;
      
      return {
        ...node,
        x: radius * Math.cos(theta) * Math.sin(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(phi),
      };
    });
  }, [nodes]);

  const getConnectedNodeIds = useCallback((nodeId: string): Set<string> => {
    const connected = new Set<string>();
    connected.add(nodeId);
    connections.forEach(conn => {
      if (conn.from === nodeId) connected.add(conn.to);
      if (conn.to === nodeId) connected.add(conn.from);
    });
    return connected;
  }, [connections]);

  const getConnectionColor = (type: ConnectionType, alpha: number): string => {
    switch (type) {
      case 'conflict':
        return `rgba(239, 68, 68, ${alpha})`;
      case 'interest':
        return `rgba(234, 179, 8, ${alpha})`;
      default:
        return `rgba(59, 130, 246, ${alpha})`;
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const connectedIds = focusedNodeId ? getConnectedNodeIds(focusedNodeId) : null;

    const rotatedNodes = positionedNodes.current
      .filter(node => !connectedIds || connectedIds.has(node.id))
      .map(node => {
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.x * sinY + node.z * cosY;

        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        const y1 = node.y * cosX - z1 * sinX;
        const z2 = node.y * sinX + z1 * cosX;

        const perspective = 400;
        const depthScale = perspective / Math.max(50, perspective + z2);
        const finalScale = depthScale * zoom;
        
        return {
          ...node,
          screenX: centerX + x1 * finalScale,
          screenY: centerY + y1 * finalScale,
          scale: finalScale,
          z: z2,
        };
      }).sort((a, b) => a.z - b.z);

    const filteredConnections = focusedNodeId 
      ? connections.filter(c => c.from === focusedNodeId || c.to === focusedNodeId)
      : connections;

    filteredConnections.forEach(conn => {
      const from = rotatedNodes.find(n => n.id === conn.from);
      const to = rotatedNodes.find(n => n.id === conn.to);
      if (!from || !to) return;

      const avgZ = (from.z + to.z) / 2;
      const baseAlpha = Math.max(0.2, Math.min(0.8, (150 - avgZ) / 300));
      const alpha = baseAlpha * conn.strength;
      const lineWidth = Math.max(1.5, 4 * conn.strength * from.scale);

      ctx.beginPath();
      ctx.moveTo(from.screenX, from.screenY);
      ctx.lineTo(to.screenX, to.screenY);
      ctx.strokeStyle = getConnectionColor(conn.type, alpha);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    rotatedNodes.forEach(node => {
      const isSelected = selectedId === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isFocused = focusedNodeId === node.id;
      const baseRadius = 6 + node.bondStrength * 10;
      const radius = baseRadius * node.scale * (isSelected || isHovered || isFocused ? 1.4 : 1);
      const alpha = Math.max(0.5, (150 - node.z) / 300);

      if (node.hasInterest && (node.interestStrength || 0) > 0.3) {
        const glowIntensity = 0.35 + 0.25 * Math.sin(glowPhase.current * 2);
        const glowRadius = radius + 20 + (node.interestStrength || 0.5) * 15;
        
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, glowRadius, 0, Math.PI * 2);
        const glowGradient = ctx.createRadialGradient(
          node.screenX, node.screenY, radius,
          node.screenX, node.screenY, glowRadius
        );
        glowGradient.addColorStop(0, `rgba(234, 179, 8, ${alpha * glowIntensity})`);
        glowGradient.addColorStop(0.5, `rgba(234, 179, 8, ${alpha * glowIntensity * 0.4})`);
        glowGradient.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.fillStyle = glowGradient;
        ctx.fill();
      }

      if (isSelected || isHovered || isFocused) {
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, radius + 12, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          node.screenX, node.screenY, radius,
          node.screenX, node.screenY, radius + 12
        );
        const highlightColor = isFocused ? '251, 191, 36' : '59, 130, 246';
        gradient.addColorStop(0, `rgba(${highlightColor}, ${alpha * 0.7})`);
        gradient.addColorStop(1, `rgba(${highlightColor}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.screenX, node.screenY, radius, 0, Math.PI * 2);
      
      const nodeGradient = ctx.createRadialGradient(
        node.screenX - radius * 0.3, node.screenY - radius * 0.3, 0,
        node.screenX, node.screenY, radius
      );
      
      if (isFocused) {
        nodeGradient.addColorStop(0, `rgba(251, 191, 36, ${alpha})`);
        nodeGradient.addColorStop(1, `rgba(200, 140, 0, ${alpha * 0.8})`);
      } else if (isSelected) {
        nodeGradient.addColorStop(0, `rgba(251, 191, 36, ${alpha})`);
        nodeGradient.addColorStop(1, `rgba(234, 179, 8, ${alpha * 0.7})`);
      } else if (node.hasInterest) {
        nodeGradient.addColorStop(0, `rgba(251, 191, 36, ${alpha})`);
        nodeGradient.addColorStop(1, `rgba(180, 120, 0, ${alpha * 0.8})`);
      } else {
        nodeGradient.addColorStop(0, `rgba(100, 180, 255, ${alpha})`);
        nodeGradient.addColorStop(1, `rgba(30, 80, 160, ${alpha * 0.8})`);
      }
      
      ctx.fillStyle = nodeGradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.screenX, node.screenY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (node.scale > 0.4) {
        const fontSize = Math.max(10, Math.round(13 * node.scale));
        ctx.font = `600 ${fontSize}px "Noto Sans SC", "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
        ctx.fillText(node.name, node.screenX + 1, node.screenY + radius + fontSize + 4);
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText(node.name, node.screenX, node.screenY + radius + fontSize + 3);
      }
    });

    glowPhase.current += 0.05;
  }, [rotationX, rotationY, zoom, connections, selectedId, hoveredNode, focusedNodeId, getConnectedNodeIds]);

  useEffect(() => {
    if (!isDragging && !focusedNodeId) {
      const animate = () => {
        setRotationY(r => r + 0.002);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDragging, focusedNodeId]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      draw();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setRotationY(r => r + dx * 0.008);
      setRotationX(r => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, r + dy * 0.008)));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const connectedIds = focusedNodeId ? getConnectedNodeIds(focusedNodeId) : null;

    let closest: (StarNode & { screenX: number; screenY: number; scale: number }) | null = null;
    let closestDist = Infinity;

    positionedNodes.current
      .filter(node => !connectedIds || connectedIds.has(node.id))
      .forEach(node => {
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.x * sinY + node.z * cosY;

        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        const y1 = node.y * cosX - z1 * sinX;
        const z2 = node.y * sinX + z1 * cosX;

        const perspective = 400;
        const depthScale = perspective / Math.max(50, perspective + z2);
        const finalScale = depthScale * zoom;
        const screenX = centerX + x1 * finalScale;
        const screenY = centerY + y1 * finalScale;
        
        const dist = Math.sqrt((x - screenX) ** 2 + (y - screenY) ** 2);
        const hitRadius = (6 + node.bondStrength * 10) * finalScale + 15;
        
        if (dist < hitRadius && dist < closestDist) {
          closest = { ...node, screenX, screenY, scale: finalScale };
          closestDist = dist;
        }
      });

    setHoveredNode(closest);
    canvas.style.cursor = closest ? 'pointer' : 'grab';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.5, Math.min(3, z * delta)));
  };

  const handleClick = () => {
    if (hoveredNode) {
      if (focusedNodeId === hoveredNode.id) {
        setFocusedNodeId(null);
      } else {
        setFocusedNodeId(hoveredNode.id);
      }
      if (onNodeClick) {
        onNodeClick(hoveredNode);
      }
    } else if (focusedNodeId) {
      setFocusedNodeId(null);
    }
  };

  const handleReset = () => {
    setRotationX(0);
    setRotationY(0);
    setZoom(1);
    setFocusedNodeId(null);
  };

  const focusedNode = focusedNodeId ? nodes.find(n => n.id === focusedNodeId) : null;
  const connectedCount = focusedNodeId ? getConnectedNodeIds(focusedNodeId).size - 1 : 0;

  return (
    <div ref={containerRef} className={`relative w-full h-full min-h-[400px] ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />
      
      <div className="absolute top-3 left-3 flex gap-2">
        <button
          onClick={() => setZoom(z => Math.min(3, z * 1.2))}
          className="p-2 bg-card/80 backdrop-blur border border-border rounded-lg hover:bg-card transition-colors"
          title="放大"
        >
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.5, z * 0.8))}
          className="p-2 bg-card/80 backdrop-blur border border-border rounded-lg hover:bg-card transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-card/80 backdrop-blur border border-border rounded-lg hover:bg-card transition-colors"
          title="重置视图"
        >
          <RotateCcw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 text-xs bg-card/80 backdrop-blur p-2 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-blue-500 rounded"></div>
          <span className="text-muted-foreground">普通关系</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-yellow-500 rounded"></div>
          <span className="text-muted-foreground">利益关系</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-red-500 rounded"></div>
          <span className="text-muted-foreground">冲突关系</span>
        </div>
      </div>

      <AnimatePresence>
        {focusedNode && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-16 left-3 p-3 bg-yellow-500/20 backdrop-blur border border-yellow-500/30 rounded-lg max-w-[200px]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-yellow-400 font-medium">聚焦模式</span>
              <button
                onClick={() => setFocusedNodeId(null)}
                className="p-1 hover:bg-yellow-500/20 rounded transition-colors"
              >
                <X className="w-3 h-3 text-yellow-400" />
              </button>
            </div>
            <div className="text-sm font-medium text-foreground">{focusedNode.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              显示 {connectedCount} 个关联人员
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 left-4 right-4 p-3 bg-card/90 backdrop-blur border border-border rounded-lg pointer-events-none"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                hoveredNode.hasInterest 
                  ? 'bg-yellow-500/20 text-yellow-400' 
                  : 'bg-primary/20 text-primary'
              }`}>
                {hoveredNode.name.charAt(0)}
              </div>
              <div>
                <div className="font-medium text-foreground">{hoveredNode.name}</div>
                <div className="text-xs text-muted-foreground">
                  {hoveredNode.role && <span>{hoveredNode.role}</span>}
                  {hoveredNode.role && hoveredNode.organization && <span> · </span>}
                  {hoveredNode.organization && <span>{hoveredNode.organization}</span>}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-muted-foreground">
                  关系强度: {Math.round((hoveredNode.bondStrength || 0.5) * 100)}%
                </div>
                {hoveredNode.hasInterest && (
                  <div className="text-xs text-yellow-400">
                    利益关系
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card/60 backdrop-blur px-2 py-1 rounded">
        拖拽旋转 · 滚轮缩放 · 点击聚焦
      </div>
    </div>
  );
}

export function PersonDetailOverlay({ 
  person, 
  onClose 
}: { 
  person: {
    name: string;
    role?: string | null;
    organization?: string | null;
    weakness?: string | null;
    bondStrength?: number | null;
    tags?: string[] | null;
    decisionStyle?: string | null;
    accessLevel?: string | null;
  }; 
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-xl p-6 max-w-lg w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
            {person.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">{person.name}</h2>
            <p className="text-muted-foreground">
              {person.role && <span>{person.role}</span>}
              {person.role && person.organization && <span> @ </span>}
              {person.organization && <span>{person.organization}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-3">
          {person.weakness && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="text-xs text-red-400 mb-1">弱点分析</div>
              <div className="text-sm text-foreground">{person.weakness}</div>
            </div>
          )}
          
          {person.tags && person.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {person.tags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-primary/20 text-primary text-xs rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">决策风格:</span>
              <span className="ml-2 text-foreground">{person.decisionStyle || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">关系强度:</span>
              <span className="ml-2 text-foreground">{Math.round((person.bondStrength || 0.5) * 100)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">访问等级:</span>
              <span className={`ml-2 ${
                person.accessLevel === 'ZONE_RED' ? 'text-red-400' : 
                person.accessLevel === 'ZONE_BLUE' ? 'text-blue-400' : 'text-green-400'
              }`}>{person.accessLevel || 'ZONE_BLUE'}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
