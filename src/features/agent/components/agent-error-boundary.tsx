"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertTriangleIcon,
  RefreshCwIcon,
  MessageSquarePlusIcon,
  ShieldAlertIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface AgentErrorBoundaryProps {
  children: ReactNode;
  /** Callback when the user clicks "Start New Chat". */
  onNewChat?: () => void;
}

interface AgentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ─── Error Code Mapping ──────────────────────────────────────

function getErrorInfo(error: Error): {
  icon: ReactNode;
  title: string;
  message: string;
  canRetry: boolean;
} {
  const errorMessage = error.message || "";

  if (errorMessage.includes("AGENT_SAFETY_BLOCKED")) {
    return {
      icon: <ShieldAlertIcon className="size-8 text-orange-500" />,
      title: "Message Blocked",
      message:
        "Your message was blocked by the safety policy. Please rephrase and try again.",
      canRetry: false,
    };
  }

  if (
    errorMessage.includes("AGENT_RUN_FAILED") ||
    errorMessage.includes("AGENT_TIMEOUT")
  ) {
    return {
      icon: <AlertTriangleIcon className="size-8 text-amber-500" />,
      title: "Agent Run Failed",
      message:
        "The agent encountered an error while processing your request. This is usually temporary — try again.",
      canRetry: true,
    };
  }

  if (
    errorMessage.includes("AGENT_RATE_LIMITED") ||
    errorMessage.includes("429")
  ) {
    return {
      icon: <AlertTriangleIcon className="size-8 text-amber-500" />,
      title: "Rate Limited",
      message:
        "You've sent too many requests. Please wait a moment before trying again.",
      canRetry: true,
    };
  }

  if (
    errorMessage.includes("NetworkError") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("Failed to fetch")
  ) {
    return {
      icon: <AlertTriangleIcon className="size-8 text-red-500" />,
      title: "Connection Error",
      message:
        "Unable to connect to the agent. Check your network connection and try again.",
      canRetry: true,
    };
  }

  // Default
  return {
    icon: <AlertTriangleIcon className="size-8 text-red-500" />,
    title: "Something Went Wrong",
    message:
      "An unexpected error occurred in the agent chat. You can try reloading the page or starting a new conversation.",
    canRetry: true,
  };
}

// ─── Component ───────────────────────────────────────────────

export class AgentErrorBoundary extends Component<
  AgentErrorBoundaryProps,
  AgentErrorBoundaryState
> {
  constructor(props: AgentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AgentErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleNewChat = () => {
    this.setState({ hasError: false, error: null });
    this.props.onNewChat?.();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const errorInfo = getErrorInfo(this.state.error);

      return (
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
          <div className="flex flex-col items-center gap-4 max-w-sm">
            <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center ring-1 ring-border/50">
              {errorInfo.icon}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">
                {errorInfo.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {errorInfo.message}
              </p>
            </div>

            <div className="flex items-center gap-2 mt-2">
              {errorInfo.canRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                  className="gap-1.5"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Try Again
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={this.handleNewChat}
                className="gap-1.5 bg-gradient-to-b from-[#5c54a4] to-[#9187ce] text-white border-0"
              >
                <MessageSquarePlusIcon className="size-3.5" />
                Start New Chat
              </Button>
            </div>

            {/* Error details for debugging */}
            <details className="mt-4 w-full text-left">
              <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Show error details
              </summary>
              <pre className="mt-1 text-[10px] font-mono text-muted-foreground bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
