# TestData vs Context - THE REAL FLOW
**Based on:** shared-notifications.json, BookingStateMachine.js, TestContext.js  
**Date:** October 23, 2025

---

## 🎯 THE ACTUAL STRUCTURE

### What We Learned from shared-notifications.json

```json
{
  "_original": {
    // 1. Metadata (setup info)
    "status": "Created",
    "triggerButton": "CREATE",
    "requiredFields": ["clubName", "bookingTime", ...],
    "setup": {
      "testFile": "CreatedBooking-Web-UNIT.spec.js",
      "actionName": "createBookings",
      "platform": "web"
    },
    
    // 2. Test Data (actual values)
    "clubName": "A Notif Test Club",
    "managerEmail": "dimitrij@test.cxm.hr",
    "managerPassword": "Password12!",
    "dancerName": "Lili",
    "dancers": [...],
    "bookingTime": { "start": "...", "end": "..." },
    
    // 3. Assignment (what XState sets)
    "assignment": {
      "status": "Created",
      "statusLabel": "Created",
      "statusCode": "Pending"
    }
  },
  
  "_changeLog": [
    {
      "index": 0,
      "type": "INIT",
      "label": "Initial State",
      "timestamp": "2025-10-20T16:44:16.094Z",
      "delta": {}
    }
    // More deltas added by actions...
  ]
}
```

---

## 🔄 THE REAL FLOW

### 1. TestData = _original (Everything!)

**TestData is NOT separate** - it's the entire `_original` object containing:
- Metadata (setup, buttons, required fields)
- Actual test values (emails, names, times)
- Initial assignments (status, labels)

```javascript
// TestContext loads _original
const ctx = TestContext.load(CreatedBookingImplications, testDataPath);

// ctx.data = _original (all of it!)
console.log(ctx.data.clubName);          // "A Notif Test Club"
console.log(ctx.data.managerEmail);      // "dimitrij@test.cxm.hr"
console.log(ctx.data.dancers[0].name);   // "NotifDancer1"
```

---

### 2. Actions Create Deltas

**When action executes**, it adds to `_changeLog`:

```javascript
// Action: Accept booking
ctx.executeAndSave(AcceptedBookingImplications, {
  delta: {
    'bookings[0].status': 'Accepted',
    'bookings[0].acceptedAt': new Date().toISOString(),
    'bookings[0].acceptedBy': testData.managerEmail  // Reference testData
  }
});

// This adds to _changeLog:
{
  "index": 1,
  "type": "UPDATE",
  "label": "Accept Booking",
  "unitTest": "AcceptBooking-Web-UNIT.spec.js",
  "timestamp": "2025-10-20T17:00:00.000Z",
  "delta": {
    "bookings[0].status": "Accepted",
    "bookings[0].acceptedAt": "2025-10-20T17:00:00.000Z",
    "bookings[0].acceptedBy": "dimitrij@test.cxm.hr"
  }
}
```

---

### 3. TestContext Computes Current State

**TestContext.load() computes current state** by applying all deltas:

```javascript
// From TestContext.js:
let computedState = { ..._original };

// Apply all deltas in order
for (const change of _changeLog) {
  computedState = applyDelta(computedState, change.delta);
}

// ctx.data = computed state (original + all deltas)
```

**Result:** `ctx.data` is always the current state (original + all accumulated changes)

---

### 4. XState Context = Values for Checks

**XState context** contains values used in mirrorsOn checks:

```javascript
// In Implication file:
static xstateConfig = {
  context: {
    username: null,      // Will be set by entry action
    sessionToken: null,  // Will be set by entry action
    status: null         // Will be set by entry action
  },
  
  entry: assign({
    // Copy from testData
    username: ({ context, event }) => testData.username,
    
    // Set by action
    sessionToken: ({ event }) => event.sessionToken,
    status: 'Accepted',
    acceptedAt: ({ event }) => event.acceptedAt
  })
};

static mirrorsOn = {
  UI: {
    web: {
      dashboard: [{
        checks: {
          text: {
            welcomeMsg: "Welcome, {{username}}!"  // ← Uses context.username
          }
        }
      }]
    }
  }
};
```

---

## 🎓 KEY INSIGHTS

### Insight 1: TestData Contains Everything
```
TestData = _original = {
  metadata (setup, buttons, required fields)
  + 
  test values (emails, names, dates)
  +
  initial assignments (status, labels)
}
```

### Insight 2: XState Context References TestData
```javascript
// In xstateConfig:
context: {
  username: testData.username,  // Reference to testData
  status: null                  // Will be set by entry
}

// OR in entry action:
entry: assign({
  username: ({ context }) => testData.username,  // Copy from testData
  status: 'Accepted'                             // Set directly
})
```

### Insight 3: requiredFields vs Context
```javascript
// requiredFields = what the IMPLICATION needs to validate
requiredFields: ['clubName', 'bookingTime', 'dancerName']

// context = what the STATE MACHINE tracks through transitions
context: {
  status: null,
  acceptedAt: null,
  acceptedBy: null
}

// OVERLAP is common!
// 'clubName' might be in BOTH requiredFields AND context
```

### Insight 4: Context Used in Expectations
**From user:** "Context are the values that are gonna be checked in expectations"

```javascript
// If mirrorsOn uses {{username}}:
mirrorsOn: {
  checks: {
    text: { welcomeMsg: "Welcome, {{username}}!" }
  }
}

// Then username MUST be in context:
context: {
  username: testData.username  // ← Must be available!
}
```

---

## 🔧 HOW OUR SYSTEM SHOULD HANDLE THIS

### Phase 1: Context Field Editing

**When user edits context in modal:**

```javascript
// Allow three formats:

// Format 1: Direct value
context: {
  status: "Accepted"
}

// Format 2: Reference to testData
context: {
  username: testData.username
}

// Format 3: Null (will be set by entry)
context: {
  sessionToken: null
}
```

**Validation:**
- If field used in mirrorsOn → MUST be in context (warn if not)
- If field is `testData.something` → validate testData has that field
- If field is direct value → allow any type

---

### Phase 2: Add State Improvements

**Auto-suggest context from mirrorsOn:**

```javascript
// User defines mirrorsOn:
mirrorsOn: {
  checks: {
    text: {
      welcomeMsg: "Welcome, {{username}}!",
      balance: "${{accountBalance}}"
    }
  }
}

// System detects:
"We found these variables in your UI checks:"
- username
- accountBalance

// System suggests:
context: {
  username: testData.username,   // Reference testData
  accountBalance: null            // Will be set by action
}

[✓ Add These Fields]
```

**Success Indicator - Two Formats:**

```javascript
// Format 1: Element name (from POM)
successIndicator: {
  element: 'btnAccept',        // POM element
  timeout: 5000
}
// System generates: await app.booking.waitFor('btnAccept')

// Format 2: Direct selector
successIndicator: {
  selector: '[data-testid="dashboard"]',  // Direct locator
  timeout: 5000
}
// System generates: await page.waitForSelector('[data-testid="dashboard"]')

// Future: Detect unhandled selectors and offer to create POM
```

---

### Phase 3: Test Generation

**Generated UNIT test uses TestContext properly:**

```javascript
async function performAcceptBooking(testDataPath, { page }) {
  // 1. Load context (includes all _original data)
  const ctx = TestContext.load(AcceptedBookingImplications, testDataPath);
  const testData = ctx.data;
  
  // 2. Perform action (using testData values)
  await app.bookings.navigate(testData.clubName);
  await app.bookings.accept(testData.dancerName);
  
  // 3. Wait for success indicator
  await page.waitForSelector('[data-testid="booking-accepted"]');
  
  // 4. Save delta (adds to _changeLog)
  ctx.executeAndSave(AcceptedBookingImplications, {
    delta: {
      'bookings[0].status': 'Accepted',
      'bookings[0].acceptedAt': new Date().toISOString(),
      'bookings[0].acceptedBy': testData.managerEmail  // ← Reference testData
    }
  });
  
  return ctx;
}
```

---

## 📋 UPDATED RULES

### Rule 1: TestData Structure
```
testData = {
  _original: { everything },
  _changeLog: [ deltas ]
}

ctx.data = computed state from _original + all deltas
```

### Rule 2: Context Declaration
```javascript
// In Implication:
context: {
  field1: testData.something,  // Reference testData
  field2: null,                // Set by entry action
  field3: "literal"            // Direct value
}
```

### Rule 3: Required Fields
```javascript
// If field used in mirrorsOn check → add to requiredFields
requiredFields: ['username', 'accountBalance']

// Validates that testData has these fields
```

### Rule 4: Success Indicator
```javascript
successIndicator: {
  // Option A: POM element
  element: 'btnAccept',
  
  // Option B: Direct selector
  selector: '[data-testid="dashboard"]',
  
  timeout: 5000
}
```

### Rule 5: Delta Path Syntax
```javascript
delta: {
  'simpleField': value,                    // Top-level
  'nested.field': value,                   // Nested object
  'array[0]': value,                       // Array element
  'array[0].nested': value,                // Nested in array
  'bookings[0].status': 'Accepted'         // Your actual usage
}
```

---

## 🎯 IMPLEMENTATION CHECKLIST

### Context Field Editor
- [ ] Support `testData.fieldName` format
- [ ] Validate testData reference exists
- [ ] Allow null (for entry-assigned fields)
- [ ] Allow direct values
- [ ] Auto-suggest from mirrorsOn {{variables}}
- [ ] Warn if mirrorsOn field not in context

### Success Indicator Field
- [ ] Support element name (POM)
- [ ] Support direct selector
- [ ] Timeout input (default 5000)
- [ ] Generate correct waitFor code
- [ ] Mark unhandled selectors for future POM generation

### UNIT Test Generator
- [ ] Use TestContext.load() correctly
- [ ] Reference testData.field in actions
- [ ] Generate delta with proper paths
- [ ] Include success indicator wait
- [ ] Use ctx.executeAndSave() pattern

---

## 🎉 SUMMARY

**The Beautiful Truth:**

1. **TestData = _original** (everything in one place!)
2. **Actions add deltas** to _changeLog
3. **TestContext computes** current state (original + deltas)
4. **XState context** can reference testData fields
5. **mirrorsOn checks** use context values
6. **requiredFields** validates testData has what's needed

**It all fits together perfectly!** 🚀

---

*Document Version: 2.0*  
*Last Updated: October 23, 2025*  
*Based on: Real production code*