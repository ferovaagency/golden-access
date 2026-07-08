import React from 'react';

export function Conversation({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`flex min-h-0 flex-1 flex-col ${className}`}>{children}</div>;
}

export function ConversationContent({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-4 ${className}`}>{children}</div>;
}

export function ConversationScrollButton() {
  return null;
}