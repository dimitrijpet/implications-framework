# StoreAs Prerequisite Validation System

## Overview

The StoreAs Prerequisite Validation System is an enhancement to TestPlanner that automatically runs UI validation for prerequisite states when their outgoing transitions require `storeAs` values. This solves a critical problem where transition conditions depend on values that are only produced during UI validation, not during action execution.

## The Problem

### Scenario

Consider a test flow: `agency_searched → agency_not_found`

The transition `NOT_FOUND_AGENCY` from `agency_searched` to `agency_not_found` has a condition:
```javascript
NOT_FOUND_AGENCY: {
  target: "agency_not_found",
  conditions: {
    blocks: [{
      data: {
        checks: [{
          field: "gotResults",
          operator: "equals",
          value: false
        }]
      }
    }]
  }
}
```

The `gotResults` value is produced by UI validation in `AgencySearchedImplications`:
```javascript
{
  type: "ui-assertion",
  label: "Check if there are results",
  data: {
    assertions: [{
      fn: "countNumberOfAgencies",
      type: "method",
      storeAs: "gotResults",  // ← This produces the value!
      expect: "toBeGreaterThan",
      value: 0
    }]
  }
}
```

### The Gap

When TestPlanner executes prerequisite steps, it runs them in **INDUCER mode** (action only, no validation). This means:

1. `agencySearchedViaAgencyModalOpened` action runs ✅
2. UI validation does NOT run ❌
3. `gotResults` is never populated ❌
4. Transition condition `gotResults: false` fails because `gotResults` is `undefined` ❌

### Previous Behavior (Broken)
```
⚡ Auto-executing prerequisite: agencySearchedViaAgencyModalOpened
✅ Action completed (no validation)
✅ Completed: agency_searched

📂 Loading from: shared-current.json
⏭️ Transition conditions not met - skipping action
   ❌ gotResults equals false (actual: undefined)  ← FAILURE!
```

## The Solution

### Automatic StoreAs Detection and Validation

After each prerequisite step completes, TestPlanner now:

1. **Detects** which fields are needed by outgoing transitions
2. **Identifies** which of those fields are produced by UI validation (`storeAs`)
3. **Runs** UI validation to populate those values
4. **Persists** the values to the delta file so they survive data reloads

### New Behavior (Fixed)
```
✅ Completed: agency_searched

📦 Transitions from agency_searched need storeAs values: gotResults
🔍 Running UI validation to populate them...

🔍 Validating agency_searched.AgenciesScreen for storeAs values...
💾 Stored: gotResults = false
💾 Persisted storeAs values to delta: gotResults
✅ storeAs values populated: gotResults=false

📂 Loading from: shared-current.json
📊 Applied 6 changes from history
✅ Transition conditions passed  ← SUCCESS!
```

## Architecture

### Components
```
┌─────────────────────────────────────────────────────────────────┐
│                        TestPlanner.checkOrThrow()               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Prerequisite Execution Loop                  │  │
│  │                                                          │  │
│  │  1. Execute prerequisite action                          │  │
│  │  2. ─── NEW: StoreAs Detection ───────────────────────  │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ _getStoreAsNeededForTransitionsFrom()              │ │  │
│  │  │   → Scan outgoing transitions for condition checks │ │  │
│  │  │   → Return list of fields needed (e.g., gotResults)│ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ _getStoreAsFromValidation()                        │ │  │
│  │  │   → Scan mirrorsOn.UI blocks for storeAs           │ │  │
│  │  │   → Return list of fields produced by validation   │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ Compare: needed ∩ produced ∩ missing from testData │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │     │                                                    │  │
│  │     ▼ (if missing values exist)                         │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ _runValidationForStoreAs()                         │ │  │
│  │  │   → Load POM for each screen                       │ │  │
│  │  │   → Run ExpectImplication.validateImplications()   │ │  │
│  │  │   → Persist storeAs values to delta file           │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │  3. Continue to next prerequisite step                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Action    │    │   StoreAs   │    │    Delta    │    │ Transition  │
│  Execution  │───▶│  Validation │───▶│    File     │───▶│  Condition  │
│             │    │             │    │             │    │    Check    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                   │                  │                  │
      │                   │                  │                  │
      ▼                   ▼                  ▼                  ▼
  status=            gotResults=       _changeLog: [       gotResults
  agency_            false             { delta:           === false
  searched                               gotResults:       ✅ PASS
                                         false }]
```

## API Reference

### Static Methods

#### `_getStoreAsNeededForTransitionsFrom(sourceStatus, stateRegistry, planner)`

Scans all outgoing transitions from a state and returns field names that are checked in conditions.

**Parameters:**
- `sourceStatus` (string): The status to check transitions from (e.g., `"agency_searched"`)
- `stateRegistry` (object): Map of status → implication class name
- `planner` (TestPlanner): Planner instance for file operations

**Returns:** `string[]` - Array of field names needed by transitions

**Example:**
```javascript
const needed = TestPlanner._getStoreAsNeededForTransitionsFrom(
  'agency_searched',
  planner.stateRegistry,
  planner
);
// Returns: ['gotResults']
```

**Implementation Details:**
- Checks `conditions.blocks[].data.checks[].field` (new format)
- Checks `requires` object keys (legacy format)
- Filters out `previousStatus` and dot-notation paths (e.g., `booking.status`)

---

#### `_getStoreAsFromValidation(stateStatus, platform, stateRegistry, planner)`

Scans a state's `mirrorsOn.UI` blocks to find which fields are produced via `storeAs`.

**Parameters:**
- `stateStatus` (string): The status to check (e.g., `"agency_searched"`)
- `platform` (string): Platform to check (e.g., `"web"`, `"dancer"`)
- `stateRegistry` (object): Map of status → implication class name
- `planner` (TestPlanner): Planner instance for file operations

**Returns:** `string[]` - Array of field names produced by validation

**Example:**
```javascript
const produced = TestPlanner._getStoreAsFromValidation(
  'agency_searched',
  'web',
  planner.stateRegistry,
  planner
);
// Returns: ['gotResults']
```

**Implementation Details:**
- Checks `blocks[].data.assertions[].storeAs`
- Checks `blocks[].data.storeAs` (block-level)
- Checks `function-call` blocks with `storeAs`

---

#### `_runValidationForStoreAs(stateStatus, platform, testData, page, driver, stateRegistry, planner)`

Runs UI validation for a state to populate `storeAs` values, then persists them to the delta file.

**Parameters:**
- `stateStatus` (string): The status to validate
- `platform` (string): Platform to use for validation
- `testData` (object): Current test data (will be mutated with storeAs values)
- `page` (Page|null): Playwright page object
- `driver` (WebDriver|null): WebDriverIO driver object
- `stateRegistry` (object): Map of status → implication class name
- `planner` (TestPlanner): Planner instance for file operations

**Returns:** `Promise<object>` - Empty object (values are stored in testData)

**Example:**
```javascript
await TestPlanner._runValidationForStoreAs(
  'agency_searched',
  'web',
  testData,
  page,
  null,
  planner.stateRegistry,
  planner
);
// testData.gotResults is now populated
```

**Implementation Details:**
1. Loads the implication class
2. Iterates through `mirrorsOn.UI[platform]` screens
3. Instantiates POM for each screen
4. Calls `ExpectImplication.validateImplications()`
5. Persists storeAs values to delta file with changelog entry

---

#### `_isStoreAsProducedByState(fieldName, stateStatus, stateRegistry, planner)`

Checks if a specific field is produced by a state's UI validation via `storeAs`.

**Parameters:**
- `fieldName` (string): The field to check (e.g., `"gotResults"`)
- `stateStatus` (string): The status to check
- `stateRegistry` (object): Map of status → implication class name
- `planner` (TestPlanner): Planner instance for file operations

**Returns:** `boolean` - True if the field is produced by storeAs

**Example:**
```javascript
const isProduced = TestPlanner._isStoreAsProducedByState(
  'gotResults',
  'agency_searched',
  planner.stateRegistry,
  planner
);
// Returns: true
```

**Usage in Condition Checking:**

This method is used in `_checkTransitionConditionsToTarget()` to skip blocking on fields that will be populated at runtime:
```javascript
const isRuntimeValue = TestPlanner._isStoreAsProducedByState(
  check.field,
  sourceStatus,
  this.stateRegistry,
  this
);

if (isRuntimeValue) {
  console.log(`⏭️ ${check.field} will be produced by ${sourceStatus} at runtime via storeAs`);
  // Don't add to blockedBy - it's a runtime value
}
```

## Integration Points

### In checkOrThrow() - After Step Completion

The storeAs detection runs immediately after each prerequisite step completes:
```javascript
console.log(`   ✅ Completed: ${step.status}\n`);

// ═══════════════════════════════════════════════════════════
// NEW: Check if THIS step's outgoing transitions need storeAs values
// ═══════════════════════════════════════════════════════════
if (page || driver) {
  const neededForTransitions = this._getStoreAsNeededForTransitionsFrom(
    step.status,
    planner.stateRegistry,
    planner
  );
  
  if (neededForTransitions.length > 0) {
    const producedByValidation = this._getStoreAsFromValidation(
      step.status,
      currentPlatform,
      planner.stateRegistry,
      planner
    );
    
    // Find: needed AND produced AND missing
    const missing = neededForTransitions.filter(key => 
      producedByValidation.includes(key) && 
      testData[key] === undefined
    );
    
    if (missing.length > 0) {
      console.log(`   📦 Transitions from ${step.status} need storeAs values: ${missing.join(', ')}`);
      console.log(`   🔍 Running UI validation to populate them...\n`);
      
      await this._runValidationForStoreAs(
        step.status,
        currentPlatform,
        testData,
        page,
        driver,
        planner.stateRegistry,
        planner
      );
    }
  }
}
```

### In _checkTransitionConditionsToTarget() - Skip Runtime Values

When checking if a transition is blocked, fields that will be produced at runtime via storeAs are not considered blockers:
```javascript
for (const check of blockResult.checks) {
  if (!check.met) {
    const isRuntimeValue = TestPlanner._isStoreAsProducedByState(
      check.field,
      sourceStatus,
      this.stateRegistry,
      this
    );
    
    if (isRuntimeValue) {
      console.log(`   ⏭️ ${check.field} will be produced by ${sourceStatus} at runtime via storeAs`);
      // Don't add to blockedBy
    } else {
      blockedBy.push(check);
    }
  }
}
```

## Delta File Persistence

### Why Persistence is Needed

TestPlanner reloads test data from the delta file after each step to ensure it has the latest state. Without persisting storeAs values to the delta file:

1. Validation runs → `gotResults = false` stored in memory
2. Data reloads from file → `gotResults` is lost
3. Transition check → `gotResults` is `undefined` → FAIL

### Persistence Implementation
```javascript
// In _runValidationForStoreAs():
const storeAsKeys = this._getStoreAsFromValidation(stateStatus, platform, stateRegistry, planner);

if (storeAsKeys.length > 0) {
  const storedValues = {};
  for (const key of storeAsKeys) {
    if (testData[key] !== undefined) {
      storedValues[key] = testData[key];
    }
  }
  
  if (Object.keys(storedValues).length > 0) {
    const TestContext = require('./TestContext');
    const deltaPath = TestContext.getDeltaPath(originalPath);
    
    if (fs.existsSync(deltaPath)) {
      const deltaData = JSON.parse(fs.readFileSync(deltaPath, 'utf8'));
      
      // Add storeAs values directly to data
      Object.assign(deltaData, storedValues);
      
      // Also add to changelog for tracking
      if (deltaData._changeLog) {
        deltaData._changeLog.push({
          label: `storeAs from ${stateStatus} validation`,
          timestamp: new Date().toISOString(),
          delta: storedValues
        });
      }
      
      fs.writeFileSync(deltaPath, JSON.stringify(deltaData, null, 2));
      console.log(`   💾 Persisted storeAs values to delta: ${Object.keys(storedValues).join(', ')}`);
    }
  }
}
```

### Delta File Structure

After storeAs persistence:
```json
{
  "_original": { /* ... */ },
  "_changeLog": [
    { "label": "init", "delta": { "status": "cookies" } },
    { "label": "cookiesViaInit", "delta": { /* ... */ } },
    { "label": "landingPageViaCookies", "delta": { "status": "landing_page" } },
    { "label": "agencyModalOpenedViaLandingPage", "delta": { "status": "agency_modal_opened" } },
    { "label": "agencySearchedViaAgencyModalOpened", "delta": { "status": "agency_searched" } },
    {
      "label": "storeAs from agency_searched validation",
      "timestamp": "2024-12-18T15:30:45.123Z",
      "delta": { "gotResults": false }
    }
  ],
  "status": "agency_searched",
  "gotResults": false
}
```

## Supported storeAs Locations

The system detects `storeAs` in these locations within `mirrorsOn.UI` blocks:

### 1. Assertion-Level storeAs
```javascript
{
  type: "ui-assertion",
  data: {
    assertions: [{
      fn: "countNumberOfAgencies",
      type: "method",
      storeAs: "gotResults",  // ← Detected
      expect: "toBeGreaterThan",
      value: 0
    }]
  }
}
```

### 2. Block-Level storeAs
```javascript
{
  type: "ui-assertion",
  data: {
    storeAs: "elementCount",  // ← Detected
    visible: ["someElement"]
  }
}
```

### 3. Function-Call storeAs
```javascript
{
  type: "function-call",
  data: {
    instance: "someScreen",
    method: "getCount",
    storeAs: "itemCount"  // ← Detected
  }
}
```

## Condition Formats Supported

### New Conditions Format (blocks)
```javascript
conditions: {
  mode: "all",
  blocks: [{
    type: "condition-check",
    data: {
      checks: [{
        field: "gotResults",      // ← Detected
        operator: "equals",
        value: false
      }]
    }
  }]
}
```

### Legacy Requires Format
```javascript
requires: {
  gotResults: false  // ← Detected (except previousStatus and dot-paths)
}
```

## Edge Cases

### 1. No storeAs Needed

If outgoing transitions don't have conditions, or conditions don't reference storeAs fields:
```
✅ Completed: agency_searched
(no storeAs detection output - nothing needed)
```

### 2. storeAs Already Populated

If the value is already in testData (from previous validation or manual setup):
```javascript
const missing = neededForTransitions.filter(key => 
  producedByValidation.includes(key) && 
  testData[key] === undefined  // ← Only if undefined
);
// missing = [] → validation skipped
```

### 3. No POM Defined

If a screen doesn't have a POM path:
```
⏭️ SomeScreen has no POM defined, skipping
```

### 4. Validation Failure

If validation throws an error:
```
⚠️ Could not validate AgenciesScreen: Element not found
```

The step continues but the storeAs value won't be populated.

### 5. Delta File Doesn't Exist

If there's no delta file yet:
```javascript
if (fs.existsSync(deltaPath)) {
  // ... persist
}
// Otherwise silently skipped - values still in memory
```

## Debugging

### Enable Verbose Output

The system automatically logs:
```
📦 Transitions from {status} need storeAs values: {fields}
🔍 Running UI validation to populate them...
🔍 Validating {status}.{screen} for storeAs values...
✅ Validation complete for {screen}
💾 Persisted storeAs values to delta: {fields}
✅ storeAs values populated: {field}={value}
```

### Check What's Produced

To debug which fields a state produces:
```javascript
const planner = new TestPlanner({ verbose: true });
const produced = TestPlanner._getStoreAsFromValidation(
  'agency_searched',
  'web',
  planner.stateRegistry,
  planner
);
console.log('Produced by validation:', produced);
```

### Check What's Needed

To debug which fields transitions need:
```javascript
const needed = TestPlanner._getStoreAsNeededForTransitionsFrom(
  'agency_searched',
  planner.stateRegistry,
  planner
);
console.log('Needed by transitions:', needed);
```

## Best Practices

### 1. Define storeAs in Source State

Always define `storeAs` in the **source** state's validation, not the target:
```
✅ agency_searched (source) → validates → storeAs: gotResults
   agency_not_found (target) → checks → gotResults: false
```

### 2. Use Descriptive Field Names
```javascript
// Good
storeAs: "gotResults"
storeAs: "searchResultCount"
storeAs: "isUserLoggedIn"

// Bad
storeAs: "result"
storeAs: "value"
storeAs: "x"
```

### 3. Keep storeAs Logic Simple

The storeAs field should be a direct result of the assertion:
```javascript
// Good - direct boolean from comparison
{
  fn: "countNumberOfAgencies",
  storeAs: "gotResults",
  expect: "toBeGreaterThan",
  value: 0
}
// gotResults = true if count > 0, false otherwise

// Avoid - complex transformations
{
  fn: "getComplexData",
  storeAs: "processedResult"
}
// What does processedResult contain?
```

### 4. Document storeAs Dependencies

In your implication files, document which transitions depend on storeAs values:
```javascript
/**
 * AgencySearchedImplications
 * 
 * StoreAs fields produced:
 * - gotResults: boolean - Whether search returned any agencies
 * 
 * Outgoing transitions:
 * - VIEW_RESULTS: requires gotResults: true
 * - NOT_FOUND_AGENCY: requires gotResults: false
 */
```

## Troubleshooting

### "gotResults equals false (actual: undefined)"

**Cause:** storeAs value not populated or not persisted.

**Fix:** 
1. Verify the source state has `storeAs` in its mirrorsOn.UI
2. Check that the field name matches exactly (case-sensitive)
3. Ensure the delta file is being written correctly

### "Could not validate {screen}: Element not found"

**Cause:** POM locator not found on page.

**Fix:**
1. Verify the page is in the correct state
2. Check POM locators are correct
3. Add appropriate waits/timeouts

### "No mirrorsOn.UI defined for {status}"

**Cause:** Implication doesn't have UI validation defined.

**Fix:**
1. Add `mirrorsOn.UI.{platform}` to the implication
2. Or remove the condition that depends on storeAs

### storeAs Value is Wrong

**Cause:** Validation assertion produces unexpected result.

**Debug:**
1. Run the test with `VALIDATE_EACH_STEP=true`
2. Check the assertion logic
3. Verify the expected value in the condition

## Summary

The StoreAs Prerequisite Validation System ensures that:

1. **Prerequisite steps produce all values needed by subsequent transitions**
2. **Values are persisted to survive data reloads**
3. **Transition conditions that depend on runtime values work correctly**

This eliminates a class of failures where tests would fail with "conditions not met" due to missing storeAs values that were only produced during validation, not during action execution.