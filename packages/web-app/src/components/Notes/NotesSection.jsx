// packages/web-app/src/components/Notes/NotesSection.jsx

import { useState } from 'react';
import { defaultTheme } from '../../config/visualizerTheme';
import NoteCard from './NoteCard';
import NoteEditorModal from './NoteEditorModal';

/**
 * NotesSection - Collapsible notes panel for states/transitions
 * 
 * IMPORTANT: This component should be placed OUTSIDE of <form> elements
 * to prevent click events from triggering form submission.
 */
export default function NotesSection({
  notes = [],
  categories = {},
  targetType,
  targetKey,
  projectPath,
  onNotesChange,
  theme = defaultTheme,
  collapsed: initialCollapsed = true
}) {
  // DEBUG
  console.log('📝 NotesSection rendered:', { targetType, targetKey, projectPath, notesCount: notes.length });
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const statusCounts = {
    draft: notes.filter(n => n.status === 'draft').length,
    'in-progress': notes.filter(n => n.status === 'in-progress').length,
    solved: notes.filter(n => n.status === 'solved').length
  };

  const activeCount = statusCounts.draft + statusCounts['in-progress'];

  const handleAddNote = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingNote(null);
    setShowEditor(true);
  };

  const handleEditNote = (e, note) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingNote(note);
    setShowEditor(true);
  };

  const handleDeleteNote = async (e, noteId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!window.confirm('Delete this note?')) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3000/api/notes/${noteId}?projectPath=${encodeURIComponent(projectPath)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete note');
      }

      console.log('✅ Note deleted');
      onNotesChange?.();
    } catch (error) {
      console.error('❌ Delete failed:', error);
      alert(`Failed to delete note: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

const handleSaveNote = async (noteData) => {
  console.log('🚀 handleSaveNote called!', { noteData, targetType, targetKey, editingNote });
  setIsLoading(true);
  
  // DEBUG: Log what we're sending
  console.log('📝 Saving note:', {
    targetType,
    targetKey,
    projectPath,
    noteData,
    editingNote: editingNote?.id
  });
  
  try {
      let url, method;

      if (editingNote) {
        url = `http://localhost:3000/api/notes/${editingNote.id}?projectPath=${encodeURIComponent(projectPath)}`;
        method = 'PUT';
      } else {
        url = `http://localhost:3000/api/notes/${targetType}/${encodeURIComponent(targetKey)}?projectPath=${encodeURIComponent(projectPath)}`;
        method = 'POST';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save note');
      }

      console.log(`✅ Note ${editingNote ? 'updated' : 'created'}`);
      setShowEditor(false);
      setEditingNote(null);
      onNotesChange?.();
    } catch (error) {
      console.error('❌ Save failed:', error);
      alert(`Failed to save note: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (e, noteId, newStatus) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3000/api/notes/${noteId}?projectPath=${encodeURIComponent(projectPath)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }

      console.log(`✅ Status updated to ${newStatus}`);
      onNotesChange?.();
    } catch (error) {
      console.error('❌ Status update failed:', error);
      alert(`Failed to update status: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="rounded-lg overflow-hidden"
        style={{
          border: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background.secondary
        }}
      >
        {/* Header - Using div instead of button to avoid form submission */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleHeaderClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsCollapsed(!isCollapsed);
            }
          }}
          className="w-full px-4 py-3 flex items-center justify-between transition hover:brightness-110 cursor-pointer select-none"
          style={{ backgroundColor: theme.colors.background.tertiary }}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">📝</span>
            <span className="font-semibold" style={{ color: theme.colors.text.primary }}>
              Notes
            </span>
            
            {notes.length > 0 && (
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: `${theme.colors.accents.blue}20`,
                    color: theme.colors.accents.blue
                  }}
                >
                  {notes.length}
                </span>
                
                {activeCount > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${theme.colors.accents.orange}20`,
                      color: theme.colors.accents.orange
                    }}
                    title={`${statusCounts.draft} draft, ${statusCounts['in-progress']} in progress`}
                  >
                    {activeCount} active
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCollapsed && (
              <div
                role="button"
                tabIndex={0}
                onClick={handleAddNote}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleAddNote(e);
                  }
                }}
                className="px-3 py-1 rounded text-sm font-semibold transition hover:brightness-110 cursor-pointer"
                style={{
                  backgroundColor: theme.colors.accents.green,
                  color: 'white'
                }}
              >
                + Add
              </div>
            )}
            
            <span
              className="text-lg transition-transform"
              style={{
                color: theme.colors.text.tertiary,
                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
              }}
            >
              ▼
            </span>
          </div>
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="p-4 space-y-3">
            {notes.length === 0 ? (
              <div
                className="text-center py-6"
                style={{ color: theme.colors.text.tertiary }}
              >
                <div className="text-3xl mb-2">📭</div>
                <div className="text-sm">No notes yet</div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleAddNote}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleAddNote(e);
                    }
                  }}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold transition hover:brightness-110 cursor-pointer inline-block"
                  style={{
                    backgroundColor: theme.colors.accents.blue,
                    color: 'white'
                  }}
                >
                  Add First Note
                </div>
              </div>
            ) : (
              notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  category={categories[note.category]}
                  onEdit={(e) => handleEditNote(e, note)}
                  onDelete={(e) => handleDeleteNote(e, note.id)}
                  onStatusChange={(e, status) => handleStatusChange(e, note.id, status)}
                  theme={theme}
                  disabled={isLoading}
                />
              ))
            )}
          </div>
        )}

        {/* Editor Modal */}
        {showEditor && (
          <NoteEditorModal
            isOpen={showEditor}
            onClose={() => {
              setShowEditor(false);
              setEditingNote(null);
            }}
            onSave={handleSaveNote}
            note={editingNote}
            categories={categories}
            theme={theme}
            loading={isLoading}
          />
        )}
      </div>
    </div>
  );
}