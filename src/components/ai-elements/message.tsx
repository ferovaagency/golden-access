import React from 'react';
import ReactMarkdown from 'react-markdown';

export function Message({ from, children, className = '' }: React.PropsWithChildren<{ from: 'user' | 'assistant' | string; className?: string }>) {
  const align = from === 'user' ? 'justify-end' : 'justify-start';
  return <div className={`flex ${align} ${className}`}>{children}</div>;
}

export function MessageContent({ from = 'assistant', children, className = '' }: React.PropsWithChildren<{ from?: string; className?: string }>) {
  const roleClass = from === 'user'
    ? 'max-w-[82%] rounded-2xl bg-blue-600 px-4 py-3 text-white shadow-sm'
    : 'max-w-[92%] px-1 py-1 text-slate-800';
  return <div className={`${roleClass} ${className}`}>{children}</div>;
}

export function MessageResponse({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-sm max-w-none prose-slate prose-p:my-2 prose-ul:my-2 prose-li:my-1 ${className}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}