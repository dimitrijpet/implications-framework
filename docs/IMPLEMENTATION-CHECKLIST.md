# Implementation Checklist - Adding New Features

**Purpose:** Step-by-step guide for implementing new features in the Implications Framework  
**Last Updated:** October 21, 2025

---

## 🎯 General Feature Implementation

### Phase 1: Planning (Before Coding)
```
Planning Checklist:
─────────────────────────────────────────────
[ ] Define feature scope clearly
[ ] Identify affected components
[ ] List API endpoints needed
[ ] Design data structures
[ ] Plan user workflows
[ ] Consider error cases
[ ] Estimate time (frontend + backend + testing)
[ ] Check for existing similar features
[ ] Review project knowledge for patterns
```

---

## 🎨 Adding New Modal Features

### Example: Adding "Edit State" Modal

#### Frontend Tasks
```
Frontend Checklist:
─────────────────────────────────────────────
[ ] Create component directory
    packages/web-app/src/components/FeatureModal/

[ ] Create main component file
    FeatureModal.jsx

[ ] Create CSS file
    FeatureModal.css
    ✓ Set z-index: 99999
    ✓ Use position: fixed
    ✓ Add backdrop (rgba(0,0,0,0.85))

[ ] Define component props
    interface Props {
      isOpen: boolean;
      onClose: () => void;
      onSubmit: (data) => void;
      theme: Theme;
    }

[ ] Implement state management
    const [formData, setFormData] = useState({});
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

[ ] Add form validation
    const validateForm = () => { ... };

[ ] Handle form submission
    const handleSubmit = async () => { ... };

[ ] Add loading states
    {loading && <Spinner />}

[ ] Add error handling
    {errors.field && <ErrorMessage />}

[ ] Style with theme
    style={{ color: theme.colors.text.primary }}

[ ] Test modal open/close
[ ] Test form validation
[ ] Test submission flow
[ ] Test error states
```

#### Backend Tasks
```
Backend Checklist:
─────────────────────────────────────────────
[ ] Create/update route file
    packages/api-server/src/routes/feature.js

[ ] Define endpoint
    router.post('/api/feature/action', async (req, res) => {});

[ ] Add input validation
    const { field1, field2 } = req.body;
    if (!field1) return res.status(400).json({ error: '...' });

[ ] Implement business logic
    const result = await processFeature(data);

[ ] Add error handling
    try { ... } catch (error) {
      console.error('❌ Error:', error);
      res.status(500).json({ error: error.message });
    }

[ ] Create backup before writes
    await fs.copy(filePath, `${filePath}.backup`);

[ ] Write/update files
    await fs.writeFile(filePath, content);

[ ] Return success response
    res.json({ success: true, data: result });

[ ] Test with curl/Postman
[ ] Test error cases
[ ] Test edge cases
[ ] Add logging
```

#### Integration Tasks
```
Integration Checklist:
─────────────────────────────────────────────
[ ] Import modal in parent component
    import FeatureModal from '../components/FeatureModal';

[ ] Add state for modal visibility
    const [showModal, setShowModal] = useState(false);

[ ] Add button/trigger
    <button onClick={() => setShowModal(true)}>Feature</button>

[ ] Pass required props
    <FeatureModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      onSubmit={handleSubmit}
      theme={theme}
    />

[ ] Implement submit handler
    const handleSubmit = async (data) => {
      const response = await fetch('/api/feature/action', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      // ... handle response
    };

[ ] Add success notification
    showNotification('✅ Success!');

[ ] Add error notification
    showNotification('❌ Error: ' + error.message);

[ ] Test end-to-end workflow
[ ] Test error scenarios
[ ] Verify data persistence
```

---

## 🔧 Adding New API Endpoints

### Checklist
```
API Endpoint Checklist:
─────────────────────────────────────────────
[ ] Define endpoint path and method
    POST /api/feature/action

[ ] Add to routes file
    packages/api-server/src/routes/feature.js

[ ] Import dependencies
    import fs from 'fs-extra';
    import path from 'path';

[ ] Define request validation
    const { requiredField } = req.body;
    if (!requiredField) return res.status(400).json({...});

[ ] Get project path if needed
    const projectPath = req.app.get('lastScannedProject');

[ ] Implement main logic
    const result = await processData(data);

[ ] Handle file operations
    ✓ Use fs-extra (has promises)
    ✓ Create backups
    ✓ Validate paths
    ✓ Handle errors

[ ] Use appropriate status codes
    200 - Success
    400 - Bad request (validation failed)
    404 - Not found
    409 - Conflict (already exists)
    500 - Server error

[ ] Return consistent response format
    res.json({
      success: true,
      data: result,
      message: 'Action completed'
    });

[ ] Add comprehensive logging
    console.log('✅ Success:', data);
    console.error('❌ Error:', error);

[ ] Test with curl
    curl -X POST http://localhost:3000/api/feature/action \
      -H "Content-Type: application/json" \
      -d '{"field": "value"}'

[ ] Document in API.md
[ ] Update QUICK-REFERENCE.md
```

---

## 📊 Adding New Visualizations

### Example: Adding Chart Component
```
Visualization Checklist:
─────────────────────────────────────────────
[ ] Choose library (Chart.js, D3, Recharts, etc.)

[ ] Install dependencies
    pnpm add recharts  # or chosen library

[ ] Create component
    packages/web-app/src/components/ChartComponent/

[ ] Define data structure
    interface ChartData {
      labels: string[];
      values: number[];
    }

[ ] Implement data transformation
    const transformData = (rawData) => { ... };

[ ] Add chart configuration
    const options = {
      responsive: true,
      plugins: { ... }
    };

[ ] Style with theme
    colors: theme.colors.primary

[ ] Add loading state
    {loading && <ChartSkeleton />}

[ ] Add empty state
    {data.length === 0 && <EmptyMessage />}

[ ] Add tooltips
[ ] Add interactivity (hover, click)
[ ] Test with various data sizes
[ ] Test responsive behavior
[ ] Optimize performance (memo, lazy loading)
```

---

## 🧪 Testing Checklist

### Manual Testing
```
Manual Test Checklist:
─────────────────────────────────────────────
[ ] Happy path works
    ✓ User completes task successfully
    ✓ Data saves correctly
    ✓ UI updates appropriately

[ ] Validation works
    ✓ Empty fields show errors
    ✓ Invalid formats rejected
    ✓ Helpful error messages

[ ] Edge cases handled
    ✓ Very long inputs
    ✓ Special characters
    ✓ Concurrent operations
    ✓ Network failures

[ ] Error recovery
    ✓ Can retry after failure
    ✓ No data corruption
    ✓ Clear error messages

[ ] Performance acceptable
    ✓ Loads quickly
    ✓ No lag on interactions
    ✓ Handles large datasets

[ ] Cross-browser testing
    ✓ Chrome
    ✓ Firefox
    ✓ Safari (if applicable)

[ ] Responsive design
    ✓ Desktop (1920x1080)
    ✓ Laptop (1366x768)
    ✓ Tablet (768x1024)
```

### Automated Testing (Future)
```
Automated Test Checklist:
─────────────────────────────────────────────
[ ] Unit tests
    ✓ Test individual functions
    ✓ Mock dependencies
    ✓ Test edge cases

[ ] Integration tests
    ✓ Test component interactions
    ✓ Test API calls
    ✓ Test data flow

[ ] E2E tests
    ✓ Test complete user workflows
    ✓ Test across pages
    ✓ Test error scenarios
```

---

## 📝 Documentation Checklist
```
Documentation Checklist:
─────────────────────────────────────────────
[ ] Update CHANGELOG.md
    ✓ Add version section
    ✓ List new features
    ✓ List bug fixes
    ✓ Note breaking changes

[ ] Update SYSTEM-OVERVIEW.md
    ✓ Add to architecture section
    ✓ Update data flow diagrams
    ✓ Document new components

[ ] Update TROUBLESHOOTING.md
    ✓ Add common issues
    ✓ Add solutions
    ✓ Add debug steps

[ ] Update QUICK-REFERENCE.md
    ✓ Add common tasks
    ✓ Add keyboard shortcuts
    ✓ Add quick fixes

[ ] Create feature documentation
    ✓ Overview
    ✓ Usage examples
    ✓ API reference
    ✓ Screenshots/demos

[ ] Update API.md
    ✓ Document new endpoints
    ✓ Request/response examples
    ✓ Error codes

[ ] Create session summary
    ✓ What was built
    ✓ Technical decisions
    ✓ Challenges solved
    ✓ Next steps

[ ] Update project knowledge
    ✓ Add new documents
    ✓ Update existing docs
    ✓ Add code examples
```

---

## 🚀 Deployment Checklist
```
Pre-Deployment Checklist:
─────────────────────────────────────────────
[ ] All tests passing
[ ] No console errors
[ ] No console warnings (or documented)
[ ] Documentation complete
[ ] Code reviewed (or self-reviewed)
[ ] Breaking changes documented
[ ] Migration guide (if needed)
[ ] Backup procedures verified
[ ] Rollback plan defined

[ ] Build succeeds
    pnpm build

[ ] Production env variables set
[ ] Dependencies updated
    pnpm update

[ ] Performance tested
[ ] Security reviewed
[ ] Accessibility checked
```

---

## 🎯 Feature-Specific Checklists

### Adding State Management Feature
```
[ ] Define state structure
[ ] Choose storage (localStorage, API, etc.)
[ ] Implement state updates
[ ] Add state persistence
[ ] Handle state hydration
[ ] Test state synchronization
[ ] Document state schema
```

### Adding File Generation Feature
```
[ ] Create Handlebars template
[ ] Define template variables
[ ] Add helper functions
[ ] Implement data merging
[ ] Add name conversions
[ ] Validate generated output
[ ] Test with various inputs
[ ] Handle edge cases
```

### Adding AST Parsing Feature
```
[ ] Choose parser (Babel, etc.)
[ ] Define what to extract
[ ] Implement traversal logic
[ ] Handle various code patterns
[ ] Add error handling
[ ] Test with real files
[ ] Optimize performance
[ ] Document patterns recognized
```

---

## ✅ Definition of Done

A feature is "done" when:
```
Definition of Done Checklist:
─────────────────────────────────────────────
[ ] Feature works as designed
[ ] Code is clean and well-organized
[ ] No obvious bugs
[ ] Error handling implemented
[ ] Loading states implemented
[ ] Validation works
[ ] Tests written (or manual test completed)
[ ] Documentation updated
[ ] Reviewed (self or peer)
[ ] Deployed to development
[ ] Tested in production-like environment
[ ] User feedback collected (if applicable)
[ ] Performance acceptable
[ ] Security reviewed
[ ] Accessibility checked
[ ] Ready for production
```

---

## 📞 When Things Go Wrong

### Debugging Checklist
```
Debugging Checklist:
─────────────────────────────────────────────
[ ] Check browser console for errors
[ ] Check server logs for errors
[ ] Check Network tab for failed requests
[ ] Verify environment variables
[ ] Check file permissions
[ ] Verify imports are correct
[ ] Check for typos
[ ] Review recent changes
[ ] Try in incognito mode
[ ] Clear cache and retry
[ ] Restart servers
[ ] Check dependencies are installed
[ ] Review documentation
[ ] Search project knowledge
[ ] Ask for help (with error messages)
```

---

## 🎨 Code Style Guidelines
```
Code Style Checklist:
─────────────────────────────────────────────
[ ] Consistent naming
    ✓ camelCase for variables/functions
    ✓ PascalCase for components/classes
    ✓ UPPER_CASE for constants

[ ] Meaningful names
    ✓ Descriptive, not abbreviated
    ✓ Clear intent
    ✓ Consistent across codebase

[ ] Comments where needed
    ✓ Complex logic explained
    ✓ TODOs documented
    ✓ Edge cases noted

[ ] Proper error messages
    ✓ Clear and actionable
    ✓ Include context
    ✓ Helpful suggestions

[ ] Console logging
    ✓ Use emojis for clarity (✅ ❌ 🔍 💾)
    ✓ Include relevant data
    ✓ Remove debug logs before commit

[ ] File organization
    ✓ Group related code
    ✓ Clear file structure
    ✓ Consistent naming
```

---

*Implementation Checklist v1.3.0*  
*Use this as a guide for adding new features*