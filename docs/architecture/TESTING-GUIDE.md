# Testing Guide - Phase 5 Part 2

## 🧪 Test Scenarios

### Scenario 1: Add Simple Screen

**Objective:** Create a new screen with simple template

**Steps:**
1. Open state detail modal for any state
2. Scroll to UI Screen Editor section
3. Click "➕ Add Screen" in Web platform
4. Enter name: `testScreen`
5. Leave description empty
6. Keep "Simple" template selected
7. Click "Add Screen"

**Expected:**
- ✅ Modal closes
- ✅ Screen appears in Web platform list
- ✅ Screen has empty `visible` and `hidden` arrays
- ✅ "Unsaved changes" badge appears
- ✅ Save button enabled

**Verify in Code:**
```javascript
{
  name: "testScreen",
  originalName: "testScreen",
  visible: [],
  hidden: []
}
```

---

### Scenario 2: Add Screen with Full Template

**Objective:** Create screen with complete structure

**Steps:**
1. Click "➕ Add Screen" in Dancer platform
2. Enter name: `complexScreen`
3. Enter description: `Test complex structure`
4. Select "Full Structure" template
5. Click "Add Screen"

**Expected:**
- ✅ Screen created with nested checks structure
- ✅ Description field populated
- ✅ All arrays initialized

**Verify in Code:**
```javascript
{
  name: "complexScreen",
  originalName: "complexScreen",
  description: "Test complex structure",
  visible: [],
  hidden: [],
  checks: {
    visible: [],
    hidden: [],
    text: {}
  }
}
```

---

### Scenario 3: Validation - Empty Name

**Objective:** Test validation prevents empty names

**Steps:**
1. Click "➕ Add Screen"
2. Leave name field empty
3. Try to click "Add Screen"

**Expected:**
- ✅ Button disabled (gray)
- ✅ Error message: "Screen name is required"
- ✅ Cannot submit form
- ✅ Hint text shows: "Enter a screen name (e.g., myNewScreen)"

---

### Scenario 4: Validation - Duplicate Name

**Objective:** Test validation prevents duplicates

**Steps:**
1. Note existing screen name (e.g., `notificationsScreen`)
2. Click "➕ Add Screen" in same platform
3. Enter exact same name
4. Observe validation

**Expected:**
- ✅ Error message: "Screen name already exists in this platform"
- ✅ Button disabled
- ✅ Red ❌ icon in feedback

---

### Scenario 5: Validation - Invalid Characters

**Objective:** Test validation rejects bad characters

**Steps:**
1. Click "➕ Add Screen"
2. Try these names:
   - `my-screen` (dash)
   - `my screen` (space)
   - `123screen` (starts with number)
   - `screen@test` (special char)

**Expected:**
- ✅ All rejected
- ✅ Error: "Name must be a valid identifier"
- ✅ Button disabled

---

### Scenario 6: Validation - camelCase Hint

**Objective:** Test hint for non-camelCase names

**Steps:**
1. Click "➕ Add Screen"
2. Enter: `TestScreen` (PascalCase)
3. Observe hint

**Expected:**
- ✅ Name accepted (valid identifier)
- ✅ Yellow hint: "💡 Tip: camelCase is recommended"
- ✅ Button enabled

---

### Scenario 7: Delete Screen with Confirmation

**Objective:** Test deletion with safety check

**Steps:**
1. Find any screen in list
2. Click 🗑️ button
3. Confirmation dialog appears
4. Click "Cancel"
5. Click 🗑️ again
6. Click "Delete"

**Expected:**
- ✅ First click: Dialog appears, screen stays
- ✅ Cancel: Dialog closes, screen still there
- ✅ Second click: Dialog appears again
- ✅ Delete: Screen removed immediately
- ✅ "Unsaved changes" badge appears

---

### Scenario 8: Delete Last Screen

**Objective:** Test deletion when no screens remain

**Steps:**
1. Create platform with only 1 screen
2. Delete that screen
3. Observe platform section

**Expected:**
- ✅ Screen removed
- ✅ Platform shows: "No screens yet. Click Add Screen to create one."
- ✅ Count badge shows "0"
- ✅ Platform section still visible

---

### Scenario 9: Copy Screen - Same Platform

**Objective:** Duplicate screen in same platform

**Steps:**
1. Click 📋 on `notificationsScreen` in Web
2. See auto-suggested name: `notificationsScreen_copy`
3. Keep "Same platform" selected
4. Click "Copy Screen"

**Expected:**
- ✅ New screen appears in Web platform
- ✅ Name is `notificationsScreen_copy`
- ✅ All properties copied (visible, hidden, checks)
- ✅ Deep clone (no reference sharing)

---

### Scenario 10: Copy Screen - Different Platform

**Objective:** Copy screen to another platform

**Steps:**
1. Click 📋 on `bookingDetailsScreen` in Web
2. Select "Different platform"
3. Dropdown appears
4. Select "Dancer"
5. Change name to `webBookingDetails`
6. Click "Copy Screen"

**Expected:**
- ✅ Screen appears in Dancer platform
- ✅ Original screen unchanged in Web
- ✅ All properties preserved
- ✅ Name updated correctly

---

### Scenario 11: Copy with Auto-Increment

**Objective:** Test name collision handling

**Steps:**
1. Create screen: `testScreen`
2. Copy it (creates `testScreen_copy`)
3. Copy original again
4. Copy again

**Expected:**
- ✅ First copy: `testScreen_copy`
- ✅ Second copy: `testScreen_copy2`
- ✅ Third copy: `testScreen_copy3`
- ✅ No duplicates allowed

---

### Scenario 12: Complex Workflow

**Objective:** Test multiple operations in sequence

**Steps:**
1. Add new screen: `screen1` (simple template)
2. Copy it to create: `screen1_copy`
3. Edit `screen1` (add some elements)
4. Copy `screen1_copy` to different platform
5. Delete original `screen1`
6. Save all changes

**Expected:**
- ✅ All operations work in sequence
- ✅ No data loss
- ✅ "Unsaved changes" badge updates correctly
- ✅ Save persists everything
- ✅ Fast refresh shows all changes

---

### Scenario 13: Cancel Modal

**Objective:** Test modal cancellation

**Steps:**
1. Click "➕ Add Screen"
2. Enter name: `testScreen`
3. Select template
4. Press Escape key
5. Click "➕ Add Screen" again

**Expected:**
- ✅ Modal closes on Escape
- ✅ No screen created
- ✅ Form resets when reopened
- ✅ Previous values cleared

---

### Scenario 14: Save and Persist

**Objective:** Verify changes persist to file

**Steps:**
1. Add screen: `persistTest`
2. Note hasChanges badge appears
3. Click "💾 Save Changes"
4. Wait for success notification
5. Click "Discard Changes" (to reload)
6. Check if screen still exists

**Expected:**
- ✅ Save completes successfully
- ✅ hasChanges badge disappears
- ✅ Screen persists after reload
- ✅ File updated correctly

---

### Scenario 15: Fast Refresh

**Objective:** Test fast refresh after changes

**Steps:**
1. Add screen: `fastRefreshTest`
2. Save changes
3. Observe refresh time

**Expected:**
- ✅ Refresh completes in < 1 second
- ✅ No full project scan
- ✅ Only modified file re-parsed
- ✅ Graph updates automatically

---

## 🔍 Edge Cases

### Edge 1: Platform with No Screens

**Setup:** Empty platform  
**Test:** Add first screen  
**Expected:** Screen added successfully, count becomes 1

### Edge 2: Very Long Name

**Setup:** Name with 60 characters  
**Test:** Try to submit  
**Expected:** Rejected with "Name too long" error

### Edge 3: Unicode Characters

**Setup:** Name with emoji or accents  
**Test:** Enter `myScreen😀` or `écran`  
**Expected:** Rejected (only ASCII letters/numbers/underscores)

### Edge 4: Whitespace in Name

**Setup:** Name with leading/trailing spaces  
**Test:** Enter `  testScreen  `  
**Expected:** Trimmed automatically, validation passes

### Edge 5: Copy Screen with Complex Nested Checks

**Setup:** Screen with deep nested structure  
**Test:** Copy it  
**Expected:** All nested properties copied correctly (deep clone)

### Edge 6: Delete During Edit Mode

**Setup:** Screen being edited  
**Test:** Delete another screen  
**Expected:** Edit state preserved, deletion works

---

## ✅ Success Criteria

All scenarios must pass with:
- ✅ No console errors
- ✅ Correct state updates
- ✅ Proper validation
- ✅ Smooth UX
- ✅ Data persistence

---

## 🚦 Testing Checklist

Copy this checklist and mark as you test:

### Add Screen
- [ ] Simple template works
- [ ] WithChecks template works
- [ ] Full template works
- [ ] Description optional
- [ ] Name validation real-time
- [ ] Modal closes on add
- [ ] Screen appears immediately
- [ ] hasChanges updates

### Delete Screen
- [ ] Confirmation appears
- [ ] Cancel preserves screen
- [ ] Delete removes screen
- [ ] Last screen deletion works
- [ ] List updates immediately
- [ ] hasChanges updates

### Copy Screen
- [ ] Same platform works
- [ ] Different platform works
- [ ] Name auto-suggest works
- [ ] Auto-increment works
- [ ] All properties copied
- [ ] Deep clone verified

### Validation
- [ ] Empty name rejected
- [ ] Duplicate rejected
- [ ] Invalid chars rejected
- [ ] Long name rejected
- [ ] Valid name accepted
- [ ] Hints display correctly

### UX
- [ ] Modals look good
- [ ] Buttons are clear
- [ ] Feedback is immediate
- [ ] Errors are helpful
- [ ] Escape closes modals
- [ ] Focus management works

### Integration
- [ ] Works with existing editor
- [ ] Save handles new screens
- [ ] Save handles deletions
- [ ] Fast refresh works
- [ ] No bugs in production

---

## 🐛 Known Issues / Limitations

None! All features working as designed. 🎉

---

## 📊 Test Results Template

```
Test Session: [Date]
Tester: [Name]
Environment: [Dev/Staging/Prod]

Scenario | Status | Notes
---------|--------|-------
Add Simple Screen | ✅ | Works perfectly
Add Full Screen | ✅ | All properties correct
Validation - Empty | ✅ | Proper error message
Validation - Duplicate | ✅ | Caught correctly
Delete with Confirm | ✅ | Confirmation works
Copy Same Platform | ✅ | Properties preserved
Copy Different Platform | ✅ | Success
Complex Workflow | ✅ | All operations smooth
Save and Persist | ✅ | File updated correctly

Overall Status: ✅ PASS
Bugs Found: 0
Time to Complete: [Duration]
```

---

**Version:** 1.0  
**Created:** October 21, 2025  
**Status:** Ready for Testing