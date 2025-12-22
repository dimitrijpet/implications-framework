import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';

const router = express.Router();

const NOTES_FILENAME = 'notes.json';

/**
 * Get notes file path for project
 */
function getNotesPath(projectPath) {
  return path.join(projectPath, NOTES_FILENAME);
}

/**
 * Load notes from file (or return default structure)
 */
async function loadNotes(projectPath) {
  const notesPath = getNotesPath(projectPath);
  
  try {
    const exists = await fs.pathExists(notesPath);
    if (!exists) {
      return getDefaultNotesStructure();
    }
    
    const content = await fs.readFile(notesPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️ Could not load notes: ${error.message}`);
    return getDefaultNotesStructure();
  }
}

/**
 * Save notes to file
 */
async function saveNotes(projectPath, notes) {
  const notesPath = getNotesPath(projectPath);
  
  // Update metadata
  notes._meta = {
    ...notes._meta,
    updatedAt: new Date().toISOString(),
    version: (notes._meta?.version || 0) + 1
  };
  
  await fs.writeFile(notesPath, JSON.stringify(notes, null, 2), 'utf-8');
  console.log(`💾 Notes saved to: ${notesPath}`);
}

/**
 * Default notes structure
 */
function getDefaultNotesStructure() {
  return {
    _meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    },
    categories: {
      bug: { color: '#ef4444', icon: '🐛', label: 'Bug' },
      feature: { color: '#3b82f6', icon: '✨', label: 'Feature' },
      question: { color: '#f59e0b', icon: '❓', label: 'Question' },
      todo: { color: '#8b5cf6', icon: '📝', label: 'To-Do' },
      note: { color: '#6b7280', icon: '📌', label: 'Note' }
    },
    states: {},
    transitions: {}
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/notes - Get all notes for project
// ═══════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    console.log(`📝 Loading notes for: ${projectPath}`);
    
    const notes = await loadNotes(projectPath);
    
    // Calculate counts
    const stateCount = Object.values(notes.states).reduce((sum, arr) => sum + arr.length, 0);
    const transitionCount = Object.values(notes.transitions).reduce((sum, arr) => sum + arr.length, 0);
    
    console.log(`✅ Loaded ${stateCount} state notes, ${transitionCount} transition notes`);
    
    res.json({
      success: true,
      notes,
      counts: {
        states: stateCount,
        transitions: transitionCount,
        total: stateCount + transitionCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error loading notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/notes/state/:stateName - Get notes for specific state
// ═══════════════════════════════════════════════════════════════════════════
router.get('/state/:stateName', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const { stateName } = req.params;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    const notes = await loadNotes(projectPath);
    const stateNotes = notes.states[stateName] || [];
    
    res.json({
      success: true,
      stateName,
      notes: stateNotes,
      count: stateNotes.length
    });
    
  } catch (error) {
    console.error('❌ Error loading state notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/notes/transition/:transitionKey - Get notes for specific transition
// transitionKey format: "sourceState:EVENT:targetState"
// ═══════════════════════════════════════════════════════════════════════════
router.get('/transition/:transitionKey', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const { transitionKey } = req.params;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    const notes = await loadNotes(projectPath);
    const transitionNotes = notes.transitions[transitionKey] || [];
    
    res.json({
      success: true,
      transitionKey,
      notes: transitionNotes,
      count: transitionNotes.length
    });
    
  } catch (error) {
    console.error('❌ Error loading transition notes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/notes/state/:stateName - Add note to state
// ═══════════════════════════════════════════════════════════════════════════
router.post('/state/:stateName', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const { stateName } = req.params;
    const { title, content, category, ticket, status } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    if (!content?.trim()) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }
    
    console.log(`➕ Adding note to state: ${stateName}`);
    
    const notes = await loadNotes(projectPath);
    
    // Initialize state array if needed
    if (!notes.states[stateName]) {
      notes.states[stateName] = [];
    }
    
    const newNote = {
      id: crypto.randomUUID(),
      title: title?.trim() || null,
      content: content.trim(),
      category: category || 'note',
      ticket: ticket?.trim() || null,
      status: status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    notes.states[stateName].push(newNote);
    
    await saveNotes(projectPath, notes);
    
    console.log(`✅ Note added: ${newNote.id}`);
    
    res.json({
      success: true,
      note: newNote,
      stateName
    });
    
  } catch (error) {
    console.error('❌ Error adding state note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/notes/transition/:transitionKey - Add note to transition
// ═══════════════════════════════════════════════════════════════════════════
router.post('/transition/:transitionKey', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const { transitionKey } = req.params;
    const { title, content, category, ticket, status } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    if (!content?.trim()) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }
    
    console.log(`➕ Adding note to transition: ${transitionKey}`);
    
    const notes = await loadNotes(projectPath);
    
    // Initialize transition array if needed
    if (!notes.transitions[transitionKey]) {
      notes.transitions[transitionKey] = [];
    }
    
    const newNote = {
      id: crypto.randomUUID(),
      title: title?.trim() || null,
      content: content.trim(),
      category: category || 'note',
      ticket: ticket?.trim() || null,
      status: status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    notes.transitions[transitionKey].push(newNote);
    
    await saveNotes(projectPath, notes);
    
    console.log(`✅ Note added: ${newNote.id}`);
    
    res.json({
      success: true,
      note: newNote,
      transitionKey
    });
    
  } catch (error) {
    console.error('❌ Error adding transition note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/notes/:noteId - Update a note
// ═══════════════════════════════════════════════════════════════════════════
router.put('/:noteId', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const { noteId } = req.params;
    const { title, content, category, ticket, status } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    console.log(`✏️ Updating note: ${noteId}`);
    
    const notes = await loadNotes(projectPath);
    let found = false;
    let updatedNote = null;
    
    // Search in states
    for (const [stateName, stateNotes] of Object.entries(notes.states)) {
      const noteIndex = stateNotes.findIndex(n => n.id === noteId);
      if (noteIndex !== -1) {
        notes.states[stateName][noteIndex] = {
          ...notes.states[stateName][noteIndex],
          ...(title !== undefined && { title: title?.trim() || null }),
          ...(content !== undefined && { content: content.trim() }),
          ...(category !== undefined && { category }),
          ...(ticket !== undefined && { ticket: ticket?.trim() || null }),
          ...(status !== undefined && { status }),
          updatedAt: new Date().toISOString()
        };
        updatedNote = notes.states[stateName][noteIndex];
        found = true;
        break;
      }
    }
    
    // Search in transitions if not found
    if (!found) {
      for (const [transitionKey, transitionNotes] of Object.entries(notes.transitions)) {
        const noteIndex = transitionNotes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
          notes.transitions[transitionKey][noteIndex] = {
            ...notes.transitions[transitionKey][noteIndex],
            ...(title !== undefined && { title: title?.trim() || null }),
            ...(content !== undefined && { content: content.trim() }),
            ...(category !== undefined && { category }),
            ...(ticket !== undefined && { ticket: ticket?.trim() || null }),
            ...(status !== undefined && { status }),
            updatedAt: new Date().toISOString()
          };
          updatedNote = notes.transitions[transitionKey][noteIndex];
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    await saveNotes(projectPath, notes);
    
    console.log(`✅ Note updated: ${noteId}`);
    
    res.json({
      success: true,
      note: updatedNote
    });
    
  } catch (error) {
    console.error('❌ Error updating note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/notes/:noteId - Delete a note
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/:noteId', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const { noteId } = req.params;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    console.log(`🗑️ Deleting note: ${noteId}`);
    
    const notes = await loadNotes(projectPath);
    let found = false;
    
    // Search and delete from states
    for (const [stateName, stateNotes] of Object.entries(notes.states)) {
      const noteIndex = stateNotes.findIndex(n => n.id === noteId);
      if (noteIndex !== -1) {
        notes.states[stateName].splice(noteIndex, 1);
        // Clean up empty arrays
        if (notes.states[stateName].length === 0) {
          delete notes.states[stateName];
        }
        found = true;
        break;
      }
    }
    
    // Search and delete from transitions if not found
    if (!found) {
      for (const [transitionKey, transitionNotes] of Object.entries(notes.transitions)) {
        const noteIndex = transitionNotes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
          notes.transitions[transitionKey].splice(noteIndex, 1);
          // Clean up empty arrays
          if (notes.transitions[transitionKey].length === 0) {
            delete notes.transitions[transitionKey];
          }
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }
    
    await saveNotes(projectPath, notes);
    
    console.log(`✅ Note deleted: ${noteId}`);
    
    res.json({
      success: true,
      deletedId: noteId
    });
    
  } catch (error) {
    console.error('❌ Error deleting note:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/notes/categories - Update categories config
// ═══════════════════════════════════════════════════════════════════════════
router.put('/categories', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const { categories } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    if (!categories || typeof categories !== 'object') {
      return res.status(400).json({ success: false, error: 'categories object is required' });
    }
    
    console.log(`🏷️ Updating categories config`);
    
    const notes = await loadNotes(projectPath);
    notes.categories = categories;
    
    await saveNotes(projectPath, notes);
    
    console.log(`✅ Categories updated`);
    
    res.json({
      success: true,
      categories
    });
    
  } catch (error) {
    console.error('❌ Error updating categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/notes/summary - Get note counts for graph indicators
// ═══════════════════════════════════════════════════════════════════════════
router.get('/summary', async (req, res) => {
  try {
    const { projectPath } = req.query;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'projectPath is required' });
    }
    
    const notes = await loadNotes(projectPath);
    
    // Build summary with counts per state/transition
    const stateCounts = {};
    const transitionCounts = {};
    
    for (const [stateName, stateNotes] of Object.entries(notes.states)) {
      stateCounts[stateName] = {
        total: stateNotes.length,
        byStatus: {
          draft: stateNotes.filter(n => n.status === 'draft').length,
          'in-progress': stateNotes.filter(n => n.status === 'in-progress').length,
          solved: stateNotes.filter(n => n.status === 'solved').length
        }
      };
    }
    
    for (const [transitionKey, transitionNotes] of Object.entries(notes.transitions)) {
      transitionCounts[transitionKey] = {
        total: transitionNotes.length,
        byStatus: {
          draft: transitionNotes.filter(n => n.status === 'draft').length,
          'in-progress': transitionNotes.filter(n => n.status === 'in-progress').length,
          solved: transitionNotes.filter(n => n.status === 'solved').length
        }
      };
    }
    
    res.json({
      success: true,
      summary: {
        states: stateCounts,
        transitions: transitionCounts,
        categories: notes.categories
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting notes summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;