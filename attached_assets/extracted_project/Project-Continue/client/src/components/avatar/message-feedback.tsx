import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageFeedbackProps {
  messageId: string;
  conversationId?: string;
  category?: string;
  userMessage?: string;
  assistantResponse?: string;
  onFeedback?: (feedbackType: "LIKE" | "DISLIKE") => void;
}

export function MessageFeedback({
  messageId,
  conversationId,
  category,
  userMessage,
  assistantResponse,
  onFeedback,
}: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<"LIKE" | "DISLIKE" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (type: "LIKE" | "DISLIKE") => {
    if (feedback || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/skills/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          conversationId,
          feedbackType: type,
          category,
          userMessage,
          assistantResponse,
        }),
      });
      
      if (response.ok) {
        setFeedback(type);
        onFeedback?.(type);
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (feedback) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[9px] text-muted-foreground">
          {feedback === "LIKE" ? "感谢反馈" : "我会改进"}
        </span>
        {feedback === "LIKE" ? (
          <ThumbsUp className="w-3 h-3 text-green-500" />
        ) : (
          <ThumbsDown className="w-3 h-3 text-red-500" />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-5 w-5 rounded-full",
          isSubmitting && "pointer-events-none opacity-50"
        )}
        onClick={() => handleFeedback("LIKE")}
        disabled={isSubmitting}
        data-testid={`button-like-${messageId}`}
      >
        <ThumbsUp className="w-3 h-3 text-muted-foreground hover:text-green-500" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-5 w-5 rounded-full",
          isSubmitting && "pointer-events-none opacity-50"
        )}
        onClick={() => handleFeedback("DISLIKE")}
        disabled={isSubmitting}
        data-testid={`button-dislike-${messageId}`}
      >
        <ThumbsDown className="w-3 h-3 text-muted-foreground hover:text-red-500" />
      </Button>
    </div>
  );
}
