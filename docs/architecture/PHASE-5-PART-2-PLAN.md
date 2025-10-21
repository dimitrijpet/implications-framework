# Phase 5 Part 2 - Add/Remove Screens

**Target:** Session 11  
**Estimated Time:** 3-4 hours  
**Complexity:** Medium  
**Dependencies:** Phase 5 Part 1 (Complete ✅)

---

## 🎯 Goals

Enable users to:
1. Add new screens to platforms
2. Delete existing screens
3. Copy screens between/within platforms
4. Use screen templates for common patterns
5. Validate screen names and structure

---

## 📋 Feature Breakdown

### 1. Add Screen Modal (90 min)

**Component:** `AddScreenModal.jsx`

**UI:**
```
┌─────────────────────────────────────┐
│ Add Screen to Platform: Dancer     │
├─────────────────────────────────────┤
│                                      │
│ Screen Name: [________________]     │
│              (e.g., myNewScreen)    │
│                                      │
│ Description: [________________]     │
│              (Optional)              │
│                                      │
│ Template:  [▼ Simple         ]      │
│            - Simple (name, visible)  │
│            - With Checks             │
│            - Full Structure          │
│                                      │
│          [Cancel]  [Add Screen]     │
└─────────────────────────────────────┘
```

**Validation:**
- Screen name required
- No duplicates in same platform
- camelCase format recommended
- Max 50 characters

**Templates:**
```javascript
const TEMPLATES = {
  simple: {
    visible: [],
    hidden: []
  },
  withChecks: {
    visible: [],
    hidden: [],
    checks: {
      text: {}
    }
  },
  full: {
    visible: [],
    hidden: [],
    checks: {
      visible: [],
      hidden: [],
      text: {}
    }
  }
};
```

**Implementation:**
1. Create modal component
2. Add form with validation
3. Template selector dropdown
4. Wire up to platform "Add Screen" button
5. Add screen to state
6. Mark as changed

---

### 2. Delete Screen (30 min)

**UI:**
```
Confirmation Dialog:
┌─────────────────────────────────────┐
│ Delete Screen?                       │
├─────────────────────────────────────┤
│                                      │
│ Are you sure you want to delete:    │
│ "notificationsScreen"?               │
│                                      │
│ This action cannot be undone.        │
│                                      │
│          [Cancel]  [Delete]         │
└─────────────────────────────────────┘
```

**Implementation:**
1. Add delete confirmation dialog
2. Remove screen from state
3. Update parent platform
4. Mark as changed
5. Show notification

---

### 3. Copy Screen (60 min)

**UI:**
```
Copy Dialog:
┌─────────────────────────────────────┐
│ Copy "notificationsScreen"           │
├─────────────────────────────────────┤
│                                      │
│ Copy to:                             │
│ [ ] Same platform (duplicate)        │
│ [ ] Different platform:              │
│     [▼ Select Platform ]            │
│                                      │
│ New name: [notificationsScreen_copy]│
│                                      │
│          [Cancel]  [Copy]           │
└─────────────────────────────────────┘
```

**Features:**
- Copy within same platform
- Copy to different platform
- Auto-suggest name with "_copy" suffix
- Validate new name
- Preserve all properties

**Implementation:**
1. Create copy dialog
2. Platform selector
3. Name input with validation
4. Deep clone screen object
5. Add to target platform
6. Mark as changed

---

### 4. Screen Templates (45 min)

**Built-in Templates:**

**1. Simple Screen**
```javascript
{
  name: userInput,
  description: userInput,
  visible: []
}
```

**2. With Checks**
```javascript
{
  name: userInput,
  description: userInput,
  visible: [],
  hidden: [],
  checks: {
    text: {}
  }
}
```

**3. Full Structure**
```javascript
{
  name: userInput,
  description: userInput,
  visible: [],
  hidden: [],
  checks: {
    visible: [],
    hidden: [],
    text: {}
  }
}
```

**4. From Existing Screen** (Optional)
- Select existing screen as template
- Copy structure
- Clear specific values

---

### 5. Validation System (30 min)

**Screen Name Validation:**
```javascript
const validateScreenName = (name, platform, existingScreens) => {
  const errors = [];
  
  // Required
  if (!name.trim()) {
    errors.push('Screen name is required');
  }
  
  // Length
  if (name.length > 50) {
    errors.push('Name too long (max 50 characters)');
  }
  
  // Format (camelCase recommended but not required)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    errors.push('Name must be valid identifier');
  }
  
  // Duplicates
  const exists = existingScreens.some(s => 
    s.originalName === name && s.platform === platform
  );
  if (exists) {
    errors.push('Screen name already exists in this platform');
  }
  
  return errors;
};
```

**Real-time Validation:**
- Show errors as user types
- Disable submit if invalid
- Green checkmark when valid

---

### 6. Backend Support (45 min)

**Update Endpoint:**
The existing `/api/implications/update-ui` should handle new screens automatically, but verify:

**Test Cases:**
1. Add screen with simple template
2. Add screen with full structure
3. Delete screen from middle of array
4. Copy screen within platform
5. Copy screen to different platform

**AST Generation:**
- New screens generate clean AST
- Proper nesting maintained
- All template properties included

---

## 🧪 Testing Checklist

### Add Screen
- [ ] Modal opens on "Add Screen" click
- [ ] Name validation works
- [ ] Template selector populates
- [ ] Simple template creates basic screen
- [ ] Full template creates complete structure
- [ ] Screen appears in list
- [ ] hasChanges badge appears
- [ ] Save persists to file
- [ ] Fast refresh shows new screen

### Delete Screen
- [ ] Confirmation dialog appears
- [ ] Cancel keeps screen
- [ ] Delete removes screen
- [ ] List updates immediately
- [ ] hasChanges badge appears
- [ ] Save persists deletion
- [ ] Fast refresh removes screen

### Copy Screen
- [ ] Copy dialog opens
- [ ] Platform selector works
- [ ] Name validation works
- [ ] Copy within platform works
- [ ] Copy to different platform works
- [ ] All properties copied
- [ ] hasChanges badge appears
- [ ] Save persists copy

### Validation
- [ ] Empty name rejected
- [ ] Duplicate name rejected
- [ ] Invalid characters rejected
- [ ] Long name rejected
- [ ] Valid name accepted
- [ ] Real-time feedback works

### Edge Cases
- [ ] Add to platform with 0 screens
- [ ] Delete last screen from platform
- [ ] Copy screen with complex checks
- [ ] Add screen, edit it, then save
- [ ] Add multiple screens in one session
- [ ] Cancel with unsaved new screen

---

## 🎨 UI/UX Considerations

### Visual Design
- Modal should match theme (dark, glassmorphism)
- Clear primary actions (Add, Delete, Copy)
- Destructive actions (Delete) in red
- Success actions (Add, Copy) in green
- Cancel always secondary

### User Flow
```
Happy Path - Add Screen:
1. Click "➕ Add Screen"
2. Modal opens
3. Enter name (real-time validation ✓)
4. Select template
5. Click "Add Screen"
6. Modal closes
7. Screen appears in list
8. hasChanges badge shows
9. Click "Save Changes"
10. Success notification
11. Screen persists
```

### Error Handling
- Validation errors shown inline
- Failed save shows error message
- Stays in modal if error
- Clear error messages

---

## 📊 Success Metrics

**Functionality:**
- [ ] All add/delete/copy operations work
- [ ] Validation prevents errors
- [ ] Templates generate correct structure
- [ ] Changes persist to file

**UX:**
- [ ] Modal is intuitive
- [ ] Validation is clear
- [ ] Actions are obvious
- [ ] Feedback is immediate

**Performance:**
- [ ] Modal opens < 50ms
- [ ] Validation < 10ms
- [ ] Add screen < 20ms
- [ ] Save with new screen < 500ms

---

## 🚀 Implementation Order

### Session 11 Sequence

**Hour 1: Add Screen Modal**
1. Create `AddScreenModal.jsx` component (30 min)
2. Add form with name/description inputs (15 min)
3. Add template selector (15 min)

**Hour 2: Templates & Validation**
4. Implement screen templates (20 min)
5. Add validation logic (25 min)
6. Wire up to "Add Screen" button (15 min)

**Hour 3: Delete & Copy**
7. Implement delete with confirmation (20 min)
8. Create copy dialog (25 min)
9. Implement copy logic (15 min)

**Hour 4: Testing & Polish**
10. Test all operations (30 min)
11. Fix bugs (20 min)
12. Polish UI/UX (10 min)

---

## 🔧 Technical Notes

### State Management

**Add Screen:**
```javascript
const handleAddScreen = (platformName, newScreen) => {
  setEditedUI(prev => {
    const platform = prev[platformName];
    return {
      ...prev,
      [platformName]: {
        ...platform,
        screens: [...platform.screens, newScreen],
        count: platform.count + 1
      }
    };
  });
  setHasChanges(true);
};
```

**Delete Screen:**
```javascript
const handleDeleteScreen = (platformName, screenIndex) => {
  setEditedUI(prev => {
    const platform = prev[platformName];
    return {
      ...prev,
      [platformName]: {
        ...platform,
        screens: platform.screens.filter((_, i) => i !== screenIndex),
        count: platform.count - 1
      }
    };
  });
  setHasChanges(true);
};
```

**Copy Screen:**
```javascript
const handleCopyScreen = (sourcePlatform, screenIndex, targetPlatform, newName) => {
  const sourceScreen = editedUI[sourcePlatform].screens[screenIndex];
  const newScreen = {
    ...JSON.parse(JSON.stringify(sourceScreen)), // Deep clone
    name: newName,
    originalName: newName
  };
  
  handleAddScreen(targetPlatform, newScreen);
};
```

---

## 📝 Files to Create/Modify

### New Files
- `AddScreenModal.jsx` (~200 lines)
- `CopyScreenDialog.jsx` (~150 lines)
- `screenTemplates.js` (~50 lines)
- `screenValidation.js` (~100 lines)

### Modified Files
- `UIScreenEditor.jsx` (add modal state & handlers)
- `PlatformSection.jsx` (wire up Add Screen button)
- `ScreenCard.jsx` (add Copy button handler)

**Total New Code:** ~500-600 lines  
**Modified Code:** ~100 lines

---

## 🎯 Definition of Done - Part 2

- [ ] Add Screen modal created
- [ ] Screen name validation works
- [ ] Templates available (simple, withChecks, full)
- [ ] Add screen button functional
- [ ] New screens appear in list
- [ ] Delete screen with confirmation
- [ ] Delete removes screen from list
- [ ] Copy screen dialog created
- [ ] Copy within platform works
- [ ] Copy to different platform works
- [ ] All operations mark as changed
- [ ] Save persists all operations
- [ ] Fast refresh works with new screens
- [ ] No bugs in production
- [ ] All tests passing
- [ ] Documentation updated

---

## 💡 Optional Enhancements (If Time Permits)

### Bulk Operations
- Select multiple screens (checkboxes)
- Bulk delete
- Bulk copy to platform

### Drag & Drop
- Reorder screens within platform
- Drag screen to different platform
- Visual drop zones

### Screen Preview
- Preview generated code before add
- Show template structure before selection

### Advanced Templates
- Import screen from clipboard
- Save custom templates
- Community template library

---

## 🔄 Future: Phase 5 Part 3 (Optional)

**Advanced Features:**
- Prerequisites editor (setup async functions)
- Screen function editor (`screen: (app) => app.x`)
- Visual code diff before save
- Undo/Redo system
- Search & filter screens
- Export/import configurations

**Estimated Time:** 4-6 hours  
**Priority:** Low (polish, not essential)

---

*Plan created: October 21, 2025*  
*For: Session 11*  
*Estimated completion: 3-4 hours*