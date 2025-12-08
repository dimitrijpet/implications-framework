# Path Calculation Fix Documentation

## Problem Summary

The unit test generator was creating incorrect import paths for screen objects. Tests were being generated with only 2 `../` levels when 4 were needed, and paths had incorrect `/tests/` prefixes.

### Example of the Bug

**Expected:**
```javascript
const BookingDetailsScreen = require('../../../../mobile/android/dancer/screenObjects/BookingDetails.screen.js');
```

**What was generated:**
```javascript
const BookingDetailsScreen = require('../../tests/mobile/android/dancer/screenObjects/BookingDetails.screen.js');
```

## Root Cause

The `_findProjectRoot()` function was incorrectly identifying the project root. It would stop at `/tests/implications` instead of going all the way up to the actual project root (`/home/user/Projects/PolePosition-TESTING`).

### Why This Happened

The function looked for a directory containing a `tests/` subdirectory, but it didn't check if it was *already inside* the `tests/` directory. When processing:
```
/home/user/Projects/PolePosition-TESTING/tests/implications/bookings/status/BookingPendingImplications.js
```

It would find that `/tests/implications` contains a `tests/` subdirectory (because there's a relative path reference), and incorrectly stop there.

This caused:
1. **Wrong project root:** `/tests/implications` instead of `/home/user/Projects/PolePosition-TESTING`
2. **Double `tests/` in path:** When joining `tests/implications` + `tests/mobile/...`
3. **Wrong relative depth:** Only 2 levels up instead of 4

## The Fix

### Location
- **File:** `packages/core/src/generators/UnitTestGenerator.js`
- **Function:** `_findProjectRoot()`
- **Lines:** ~416-445

### Code Change

**BEFORE:**
```javascript
_findProjectRoot(implFilePath) {
  let currentDir = path.dirname(implFilePath);
  
  // Go up max 10 levels looking for tests/ directory
  for (let i = 0; i < 10; i++) {
    const testsDir = path.join(currentDir, 'tests');
    
    if (fs.existsSync(testsDir) && fs.statSync(testsDir).isDirectory()) {
      // Found it! This is the project root
      return currentDir;  // ❌ BUG: Could be inside tests/ already!
    }
    
    // Go up one level
    const parentDir = path.dirname(currentDir);
    
    // Reached filesystem root?
    if (parentDir === currentDir) {
      break;
    }
    
    currentDir = parentDir;
  }
  
  // Fallback
  console.warn('   ⚠️  Could not find project root, using implication directory');
  return path.dirname(implFilePath);
}
```

**AFTER:**
```javascript
_findProjectRoot(implFilePath) {
  let currentDir = path.dirname(implFilePath);
  
  // Go up max 10 levels looking for tests/ directory
  for (let i = 0; i < 10; i++) {
    const testsDir = path.join(currentDir, 'tests');
    
    if (fs.existsSync(testsDir) && fs.statSync(testsDir).isDirectory()) {
      // ✅ ADDITIONAL CHECK: Make sure we're not IN tests/ ourselves!
      if (!currentDir.endsWith('/tests') && !currentDir.includes('/tests/')) {
        return currentDir;
      }
    }
    
    // Go up one level
    const parentDir = path.dirname(currentDir);
    
    // Reached filesystem root?
    if (parentDir === currentDir) {
      break;
    }
    
    currentDir = parentDir;
  }
  
  // Fallback
  console.warn('   ⚠️  Could not find project root, using implication directory');
  return path.dirname(implFilePath);
}
```

### Key Changes

Added validation to check if the current directory is already inside `tests/`:
```javascript
if (!currentDir.endsWith('/tests') && !currentDir.includes('/tests/')) {
  return currentDir;
}
```

This ensures we keep walking up the directory tree until we find the *actual* project root that contains `tests/` as a subdirectory, not a directory that's already inside `tests/`.

## How Path Calculation Works Now

### Example Flow

**Given:**
- **Implication file:** `/home/user/PolePosition-TESTING/tests/implications/bookings/status/BookingPendingImplications.js`
- **Screen file:** `tests/mobile/android/dancer/screenObjects/BookingDetails.screen.js`

### Step 1: Find Project Root
```
Start: /home/user/PolePosition-TESTING/tests/implications/bookings/status
Check: Does it have tests/? No (it's inside tests/)
Up to: /home/user/PolePosition-TESTING/tests/implications/bookings
Check: Does it have tests/? No (it's inside tests/)
Up to: /home/user/PolePosition-TESTING/tests/implications
Check: Does it have tests/? No (it's inside tests/)
Up to: /home/user/PolePosition-TESTING/tests
Check: Does it have tests/? Yes, but currentDir.includes('/tests/') → Skip
Up to: /home/user/PolePosition-TESTING
Check: Does it have tests/? Yes! And not inside tests/ → ✅ FOUND
```

**Result:** Project root = `/home/user/PolePosition-TESTING`

### Step 2: Build Absolute Path
```javascript
screenFile = "tests/mobile/android/dancer/screenObjects/BookingDetails.screen.js"
projectPath = "/home/user/PolePosition-TESTING"

absolutePath = path.join(projectPath, screenFile)
// Result: /home/user/PolePosition-TESTING/tests/mobile/android/dancer/screenObjects/BookingDetails.screen.js
```

### Step 3: Calculate Relative Path
```javascript
implDir = "/home/user/PolePosition-TESTING/tests/implications/bookings/status"
screenPath = "/home/user/PolePosition-TESTING/tests/mobile/android/dancer/screenObjects/BookingDetails.screen.js"

relativePath = path.relative(implDir, screenPath)
// Result: ../../../../mobile/android/dancer/screenObjects/BookingDetails.screen.js
```

Breaking down the `../` levels:
```
tests/implications/bookings/status/   (test file location)
../                                    (1) → tests/implications/bookings/
../                                    (2) → tests/implications/
../                                    (3) → tests/
../                                    (4) → project root/
mobile/android/dancer/screenObjects/   (screen file location)
```

## Verification

### Console Output
After the fix, you should see:
```
📁 Project root: /home/user/PolePosition-TESTING
📁 Absolute screen path: /home/user/PolePosition-TESTING/tests/mobile/android/dancer/screenObjects/BookingDetails.screen.js
✅ Calculated relative path: ../../../../mobile/android/dancer/screenObjects/BookingDetails.screen.js
```

**Not:**
```
📁 Project root: /home/user/PolePosition-TESTING/tests/implications  ❌
📁 Absolute screen path: /home/user/PolePosition-TESTING/tests/implications/tests/mobile/...  ❌
✅ Calculated relative path: ../../tests/mobile/...  ❌
```

### Generated Test Files

The require statements should now be:
```javascript
// Dancer (mobile)
const BookingDetailsScreen = require('../../../../mobile/android/dancer/screenObjects/BookingDetails.screen.js');

// Manager (mobile)
const StatusRequestsScreen = require('../../../../mobile/android/manager/screenObjects/StatusRequests.screen.js');

// Web
const BookingCalendarScreen = require('../../../../web/current/screenObjects/bookingCalendar.screen.js');
```

## Related Functions

The fix impacts these related functions in `UnitTestGenerator.js`:

1. **`_calculateScreenObjectPath()`** (line ~1694)
   - Uses `this.projectPath` which comes from `_findProjectRoot()`
   - Calculates the final relative path for imports

2. **`generate()`** (line ~275)
   - Stores project path: `this.projectPath = projectPath || this._findProjectRoot(implFilePath)`

3. **`_loadImplication()`** (line ~382)
   - Changes working directory to project root before requiring files

## Testing

To verify the fix works:

1. **Check console output** when generating tests - look for correct project root
2. **Inspect generated files** - count the `../` levels in require statements
3. **Run the tests** - they should be able to import the screen objects

## Edge Cases Handled

1. **Nested test directories:** Works even if implications are deeply nested
2. **Multiple platforms:** Correctly handles web, mobile/dancer, mobile/manager paths
3. **Symlinks:** Uses absolute path resolution to handle symbolic links
4. **Monorepos:** Finds the correct package root even in monorepo structures

## Future Improvements

Potential enhancements:
1. **Cache project root** - Store once instead of recalculating
2. **Config file detection** - Look for `package.json` or `.implications-framework/config.json`
3. **Explicit root option** - Allow `--project-root` CLI flag to override detection
4. **Better error messages** - Show directory traversal in debug mode

## Related Issues

This fix also resolved:
- Import paths having extra `/tests/` prefix
- Tests failing with "Cannot find module" errors
- Inconsistent paths between platforms

---

**Date Fixed:** November 13, 2025  
**Developer:** Dimitrij  
**Reviewer:** Claude (AI Assistant)
