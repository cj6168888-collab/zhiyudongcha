import { useState, useCallback, useMemo } from 'react';
import RGL from 'react-grid-layout';
import { Button } from '@/components/ui/button';
import { Settings, Plus, Save, X, RotateCcw } from 'lucide-react';
import { WidgetWrapper } from './widget-wrapper';
import { HpWidget } from './widgets/hp-widget';
import { ComputePoolWidget } from './widgets/compute-pool-widget';
import { ModulesWidget } from './widgets/modules-widget';
import { CollaborationWidget } from './widgets/collaboration-widget';
import { VoiceprintWidget } from './widgets/voiceprint-widget';
import { QuickActionsWidget } from './widgets/quick-actions-widget';
import { AiConfigWidget } from './widgets/ai-config-widget';
import { 
  WIDGET_TYPES, 
  DEFAULT_LAYOUT, 
  DEFAULT_WIDGETS,
  type LayoutItem 
} from '@/lib/widget-registry';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const STORAGE_KEY = 'avatar_dashboard_layout';
const WIDGETS_KEY = 'avatar_dashboard_widgets';

function getStoredLayout(): LayoutItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function getStoredWidgets(): string[] {
  try {
    const stored = localStorage.getItem(WIDGETS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveLayout(layout: LayoutItem[], widgets: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets));
}

const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  hp_monitor: HpWidget,
  compute_pool: ComputePoolWidget,
  modules: ModulesWidget,
  collaboration: CollaborationWidget,
  voiceprint: VoiceprintWidget,
  quick_actions: QuickActionsWidget,
  ai_config: AiConfigWidget,
};

interface DraggableDashboardProps {
  containerWidth: number;
}

export function DraggableDashboard({ containerWidth }: DraggableDashboardProps) {
  const [layout, setLayout] = useState<LayoutItem[]>(getStoredLayout);
  const [widgets, setWidgets] = useState<string[]>(getStoredWidgets);
  const [isEditMode, setIsEditMode] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayout(newLayout);
  }, []);

  const handleSave = useCallback(() => {
    saveLayout(layout, widgets);
    setIsEditMode(false);
  }, [layout, widgets]);

  const handleReset = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    setWidgets(DEFAULT_WIDGETS);
    saveLayout(DEFAULT_LAYOUT, DEFAULT_WIDGETS);
  }, []);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w !== widgetId));
    setLayout(prev => prev.filter(l => l.i !== widgetId));
  }, []);

  const handleAddWidget = useCallback((widgetType: string) => {
    if (widgets.includes(widgetType)) return;
    
    const config = WIDGET_TYPES[widgetType];
    if (!config) return;

    const newLayoutItem: LayoutItem = {
      i: widgetType,
      x: 0,
      y: Infinity,
      w: config.defaultW,
      h: config.defaultH,
      minW: config.minW,
      minH: config.minH,
    };

    setWidgets(prev => [...prev, widgetType]);
    setLayout(prev => [...prev, newLayoutItem]);
    setAddDialogOpen(false);
  }, [widgets]);

  const availableWidgets = useMemo(() => {
    return Object.values(WIDGET_TYPES).filter(w => !widgets.includes(w.id));
  }, [widgets]);

  const cols = 12;
  const rowHeight = 50;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-light text-muted-foreground">控制面板</h2>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-add-widget">
                    <Plus className="w-4 h-4 mr-1" />
                    添加组件
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加组件</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {availableWidgets.map(widget => (
                      <Button
                        key={widget.id}
                        variant="outline"
                        className="h-16 flex flex-col items-center justify-center gap-1"
                        onClick={() => handleAddWidget(widget.id)}
                        data-testid={`button-add-${widget.id}`}
                      >
                        <span className="text-sm">{widget.title}</span>
                      </Button>
                    ))}
                    {availableWidgets.length === 0 && (
                      <p className="col-span-2 text-center text-muted-foreground text-sm py-4">
                        所有组件已添加
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset-layout">
                <RotateCcw className="w-4 h-4 mr-1" />
                重置
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)} data-testid="button-cancel-edit">
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} data-testid="button-save-layout">
                <Save className="w-4 h-4 mr-1" />
                保存
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} data-testid="button-edit-layout">
              <Settings className="w-4 h-4 mr-1" />
              编辑布局
            </Button>
          )}
        </div>
      </div>

      <RGL
        className="layout"
        layout={layout}
        cols={cols}
        rowHeight={rowHeight}
        width={containerWidth}
        onLayoutChange={handleLayoutChange as any}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        draggableHandle=".drag-handle"
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms={true}
      >
        {widgets.map(widgetId => {
          const config = WIDGET_TYPES[widgetId];
          const WidgetComponent = WIDGET_COMPONENTS[widgetId];
          
          if (!config || !WidgetComponent) return null;

          return (
            <div key={widgetId} data-testid={`widget-container-${widgetId}`}>
              <WidgetWrapper
                title={config.title}
                widgetId={widgetId}
                isEditMode={isEditMode}
                onRemove={() => handleRemoveWidget(widgetId)}
              >
                <WidgetComponent />
              </WidgetWrapper>
            </div>
          );
        })}
      </RGL>

      {isEditMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-sm shadow-lg">
          拖拽组件以调整位置，拖动边角调整大小
        </div>
      )}
    </div>
  );
}
