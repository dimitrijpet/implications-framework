// packages/web-app/src/components/Notes/NoteCard.jsx

import { useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';

const STATUS_CONFIG = {
  draft: { color: '#6b7280', icon: '📋', label: 'Draft' },
  'in-progress': { color: '#f59e0b', icon: '🔄', label: 'In Progress' },
  solved: { color: '#10b981', icon: '✅', label: 'Solved' }
};

export default function NoteCard({
  note,
  category,
  onEdit,
  onDelete,
  onStatusChange,
  theme = defaultTheme,
  disabled = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = STATUS_CONFIG[note.status] || STATUS_CONFIG.draft;
  const categoryConfig = category || { color: '#6b7280', icon: '📌', label: 'Note' };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const previewContent = note.content.length > 100
    ? note.content.slice(0, 100) + '...'
    : note.content;

  const handleCardClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="rounded-lg overflow-hidden transition"
        style={{
          backgroundColor: theme.colors.background.primary,
          border: `1px solid ${categoryConfig.color}40`,
          opacity: disabled ? 0.6 : 1
        }}
      >
        {/* Header */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleCardClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleCardClick(e);
            }
          }}
          className="px-3 py-2 flex items-center gap-2 cursor-pointer select-none"
          style={{ backgroundColor: `${categoryConfig.color}10` }}
        >
          <span title={categoryConfig.label}>{categoryConfig.icon}</span>

          <div className="flex-1 min-w-0">
            {note.title ? (
              <div
                className="font-semibold text-sm truncate"
                style={{ color: theme.colors.text.primary }}
              >
                {note.title}
              </div>
            ) : (
              <div
                className="text-sm truncate"
                style={{ color: theme.colors.text.secondary }}
              >
                {previewContent}
              </div>
            )}
          </div>

          <span
            className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
            style={{
              backgroundColor: `${statusConfig.color}20`,
              color: statusConfig.color
            }}
          >
            {statusConfig.icon} {statusConfig.label}
          </span>

          {note.ticket && (
            <span
              className="px-2 py-0.5 rounded text-xs font-mono"
              style={{
                backgroundColor: theme.colors.background.tertiary,
                color: theme.colors.accents.blue
              }}
            >
              🎫 {note.ticket}
            </span>
          )}

          <span
            className="text-xs transition-transform"
            style={{
              color: theme.colors.text.tertiary,
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            ▼
          </span>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 py-3 space-y-3">
            <div
              className="text-sm whitespace-pre-wrap"
              style={{ color: theme.colors.text.primary }}
            >
              {note.content}
            </div>

            <div
              className="flex items-center gap-4 text-xs"
              style={{ color: theme.colors.text.tertiary }}
            >
              <span>Created: {formatDate(note.createdAt)}</span>
              {note.updatedAt !== note.createdAt && (
                <span>Updated: {formatDate(note.updatedAt)}</span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: theme.colors.border }}>
              <div className="flex items-center gap-1">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <div
                    key={status}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!disabled && note.status !== status) {
                        onStatusChange(e, status);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!disabled && note.status !== status) {
                          onStatusChange(e, status);
                        }
                      }
                    }}
                    className="px-2 py-1 rounded text-xs transition hover:brightness-110 cursor-pointer select-none"
                    style={{
                      backgroundColor: note.status === status
                        ? `${config.color}30`
                        : theme.colors.background.tertiary,
                      color: note.status === status ? config.color : theme.colors.text.tertiary,
                      opacity: (disabled || note.status === status) ? 0.7 : 1,
                      pointerEvents: disabled ? 'none' : 'auto'
                    }}
                    title={`Mark as ${config.label}`}
                  >
                    {config.icon}
                  </div>
                ))}
              </div>

              <div className="flex-1" />

              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!disabled) {
                    onEdit(e);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!disabled) {
                      onEdit(e);
                    }
                  }
                }}
                className="px-3 py-1 rounded text-xs font-semibold transition hover:brightness-110 cursor-pointer select-none"
                style={{
                  backgroundColor: theme.colors.accents.blue,
                  color: 'white',
                  opacity: disabled ? 0.5 : 1,
                  pointerEvents: disabled ? 'none' : 'auto'
                }}
              >
                ✏️ Edit
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!disabled) {
                    onDelete(e);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!disabled) {
                      onDelete(e);
                    }
                  }
                }}
                className="px-3 py-1 rounded text-xs font-semibold transition hover:brightness-110 cursor-pointer select-none"
                style={{
                  backgroundColor: `${theme.colors.accents.red}20`,
                  color: theme.colors.accents.red,
                  opacity: disabled ? 0.5 : 1,
                  pointerEvents: disabled ? 'none' : 'auto'
                }}
              >
                🗑️
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}