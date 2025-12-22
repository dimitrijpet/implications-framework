// packages/web-app/src/components/Notes/NoteEditorModal.jsx

import { useState, useEffect } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';

const DEFAULT_CATEGORIES = {
  bug: { color: '#ef4444', icon: '🐛', label: 'Bug' },
  feature: { color: '#3b82f6', icon: '✨', label: 'Feature' },
  question: { color: '#f59e0b', icon: '❓', label: 'Question' },
  todo: { color: '#8b5cf6', icon: '📝', label: 'To-Do' },
  note: { color: '#6b7280', icon: '📌', label: 'Note' }
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', icon: '📋' },
  { value: 'in-progress', label: 'In Progress', icon: '🔄' },
  { value: 'solved', label: 'Solved', icon: '✅' }
];

export default function NoteEditorModal({
  isOpen,
  onClose,
  onSave,
  note = null,
  categories = DEFAULT_CATEGORIES,
  theme = defaultTheme,
  loading = false
}) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'note',
    ticket: '',
    status: 'draft'
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (note) {
      setFormData({
        title: note.title || '',
        content: note.content || '',
        category: note.category || 'note',
        ticket: note.ticket || '',
        status: note.status || 'draft'
      });
    } else {
      setFormData({
        title: '',
        content: '',
        category: 'note',
        ticket: '',
        status: 'draft'
      });
    }
    setErrors({});
  }, [note, isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!validate()) return;

    onSave({
      title: formData.title.trim() || null,
      content: formData.content.trim(),
      category: formData.category,
      ticket: formData.ticket.trim() || null,
      status: formData.status
    });
  };

  if (!isOpen) return null;

  const isEditing = !!note;
  const mergedCategories = { ...DEFAULT_CATEGORIES, ...categories };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-xl shadow-2xl"
        style={{
          backgroundColor: theme.colors.background.secondary,
          border: `2px solid ${theme.colors.border}`
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: theme.colors.border }}
        >
          <h3
            className="text-xl font-bold"
            style={{ color: theme.colors.text.primary }}
          >
            {isEditing ? '✏️ Edit Note' : '📝 Add Note'}
          </h3>
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClose();
              }
            }}
            className="text-2xl font-bold px-2 rounded transition hover:opacity-70 cursor-pointer select-none"
            style={{ color: theme.colors.text.tertiary }}
          >
            ×
          </div>
        </div>

        {/* Form Content - Using div instead of form to avoid nested forms */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label
              className="block text-sm font-semibold mb-1"
              style={{ color: theme.colors.text.secondary }}
            >
              Title <span style={{ color: theme.colors.text.tertiary }}>(optional)</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Brief title for this note"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text.primary
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
          </div>

          {/* Content */}
          <div>
            <label
              className="block text-sm font-semibold mb-1"
              style={{ color: theme.colors.text.secondary }}
            >
              Content *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="Write your note here..."
              rows={5}
              className="w-full px-3 py-2 rounded-lg text-sm resize-y"
              style={{
                backgroundColor: theme.colors.background.tertiary,
                border: `1px solid ${errors.content ? theme.colors.accents.red : theme.colors.border}`,
                color: theme.colors.text.primary
              }}
              onKeyDown={(e) => {
                // Allow Enter in textarea, but stop propagation
                e.stopPropagation();
              }}
            />
            {errors.content && (
              <p className="text-xs mt-1" style={{ color: theme.colors.accents.red }}>
                {errors.content}
              </p>
            )}
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: theme.colors.text.secondary }}
              >
                Category
              </label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(mergedCategories).map(([key, cat]) => (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleChange('category', key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleChange('category', key);
                      }
                    }}
                    className="px-2 py-1 rounded text-xs font-semibold transition cursor-pointer select-none"
                    style={{
                      backgroundColor: formData.category === key
                        ? `${cat.color}30`
                        : theme.colors.background.tertiary,
                      color: formData.category === key ? cat.color : theme.colors.text.tertiary,
                      border: `1px solid ${formData.category === key ? cat.color : 'transparent'}`
                    }}
                  >
                    {cat.icon} {cat.label}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: theme.colors.text.secondary }}
              >
                Status
              </label>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleChange('status', opt.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleChange('status', opt.value);
                      }
                    }}
                    className="px-2 py-1 rounded text-xs font-semibold transition cursor-pointer select-none"
                    style={{
                      backgroundColor: formData.status === opt.value
                        ? theme.colors.accents.blue
                        : theme.colors.background.tertiary,
                      color: formData.status === opt.value ? 'white' : theme.colors.text.tertiary
                    }}
                  >
                    {opt.icon} {opt.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ticket */}
          <div>
            <label
              className="block text-sm font-semibold mb-1"
              style={{ color: theme.colors.text.secondary }}
            >
              Ticket Reference <span style={{ color: theme.colors.text.tertiary }}>(optional)</span>
            </label>
            <input
              type="text"
              value={formData.ticket}
              onChange={(e) => handleChange('ticket', e.target.value)}
              placeholder="e.g., JIRA-1234, GH-567"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{
                backgroundColor: theme.colors.background.tertiary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.accents.blue
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClose();
                }
              }}
              className="flex-1 px-4 py-2 rounded-lg font-semibold transition text-center cursor-pointer select-none"
              style={{
                backgroundColor: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                border: `1px solid ${theme.colors.border}`,
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? 'none' : 'auto'
              }}
            >
              Cancel
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!loading) {
                  handleSubmit(e);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!loading) {
                    handleSubmit(e);
                  }
                }
              }}
              className="flex-1 px-4 py-2 rounded-lg font-bold transition text-center cursor-pointer select-none hover:brightness-110"
              style={{
                backgroundColor: loading
                  ? theme.colors.background.tertiary
                  : theme.colors.accents.green,
                color: 'white',
                opacity: loading ? 0.6 : 1,
                pointerEvents: loading ? 'none' : 'auto'
              }}
            >
              {loading ? '💾 Saving...' : isEditing ? '💾 Update' : '✅ Add Note'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}