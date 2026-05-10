import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';

interface WidgetWrapperProps {
  title: string;
  children: ReactNode;
  onRemove?: () => void;
  isEditMode?: boolean;
  widgetId: string;
}

export function WidgetWrapper({ 
  title, 
  children, 
  onRemove, 
  isEditMode = false,
  widgetId 
}: WidgetWrapperProps) {
  return (
    <Card 
      className="h-full bg-card/50 backdrop-blur border-border/50 overflow-hidden flex flex-col"
      data-testid={`widget-${widgetId}`}
    >
      <CardHeader className="py-2 px-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditMode && (
              <div className="drag-handle cursor-move p-1 hover:bg-muted rounded">
                <GripVertical className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {title}
            </CardTitle>
          </div>
          {isEditMode && onRemove && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5"
              onClick={onRemove}
              data-testid={`button-remove-widget-${widgetId}`}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto px-3 pb-3 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}
