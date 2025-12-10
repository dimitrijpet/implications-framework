// packages/web-app/src/components/AddTransitionModal/AddTransitionModal.jsx
// ✨ ENHANCED VERSION v2.0
// Features: Edit Mode, Platform-Filtered Navigation, POM Discovery, Smart Args

import { useState, useEffect, useMemo } from "react";
import { defaultTheme } from "../../config/visualizerTheme";
import { getCachedPOMs, getCachedNavigation, filterPOMsByPlatform, clearCache } from '../../cache/pomCache';
import { getRequiresSuggestions, getKnownKeys } from '../../utils/requiresColors.js';
import ConditionBlockList from './ConditionBlockList';
import StepConditions from './StepConditions';
import { migrateRequiresToConditions, conditionsToRequires } from './conditionBlockUtils';
import { collectVariablesFromUIValidations } from '../UIScreenEditor/collectVariablesFromUIValidations';
import useProjectConfig from '../../hooks/useProjectConfig';
import DataFlowSummary from './DataFlowSummary';
import usePOMData from '../../hooks/usePOMData';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


const API_URL = "http://localhost:3000";
const STEP_TYPES = [
  { value: 'pom-method', label: '⚡ POM Method', description: 'Call a method from imported screen object' },
  { value: 'click', label: '👆 Click', description: 'Click an element' },
  { value: 'fill', label: '✏️ Fill', description: 'Fill an input field' },
  { value: 'getText', label: '📝 Get Text', description: 'Get text content and optionally store it' },
  { value: 'waitFor', label: '⏳ Wait For', description: 'Wait for element to be visible/hidden' },
  { value: 'custom', label: '💻 Custom Code', description: 'Write custom Playwright code' },
];


/**
 * SortableStep - Wrapper that makes a step draggable
 */
function SortableStep({ step, stepIndex, children, editMode = true, theme }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: step.id || `step-${stepIndex}`,
    disabled: !editMode 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="p-3 rounded mb-3"
        style={{
          backgroundColor: theme.colors.background.secondary,
          border: `1px solid ${isDragging ? theme.colors.accents.blue : theme.colors.border}`,
          overflow: 'visible',
        }}
      >
        {/* Step Header with Drag Handle */}
        <div className="flex items-center gap-2 mb-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/10 transition"
            title="Drag to reorder"
          >
            <span style={{ color: theme.colors.text.tertiary, fontSize: '16px' }}>⋮⋮</span>
          </div>
          
          {/* Step Number */}
          <span
            className="text-sm font-semibold"
            style={{ color: theme.colors.text.secondary }}
          >
            Step #{stepIndex + 1}
          </span>
          
          {/* Step Type Badge */}
          <span
            className="px-2 py-0.5 rounded text-xs font-semibold"
            style={{
              backgroundColor: `${theme.colors.accents.blue}20`,
              color: theme.colors.accents.blue,
            }}
          >
            {STEP_TYPES.find(t => t.value === step.type)?.label || step.type}
          </span>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Remove Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step.onRemove?.();
            }}
            className="px-2 py-1 rounded text-xs transition hover:brightness-110"
            style={{
              backgroundColor: theme.colors.accents.red + "20",
              color: theme.colors.accents.red,
            }}
          >
            Remove
          </button>
        </div>
        
        {/* Step Content */}
        {children}
      </div>
    </div>
  );
}

/**
 * Drag overlay preview for steps
 */
function StepDragOverlay({ step, theme }) {
  const stepType = STEP_TYPES.find(t => t.value === step?.type);
  
  return (
    <div
      className="p-3 rounded shadow-2xl"
      style={{
        backgroundColor: theme.colors.background.secondary,
        border: `2px solid ${theme.colors.accents.blue}`,
        opacity: 0.9,
        width: '400px',
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: theme.colors.text.tertiary }}>⋮⋮</span>
        <span style={{ color: theme.colors.accents.blue, fontWeight: 600 }}>
          {stepType?.label || 'Step'}
        </span>
        <span style={{ color: theme.colors.text.secondary }}>
          {step?.description || 'No description'}
        </span>
      </div>
    </div>
  );
}

const AvailableVariablesHint = ({ availableVars, onInsert }) => {
  if (!availableVars || availableVars.length === 0) return null;
  
  return (
    <div 
      className="mt-2 p-2 rounded text-xs"
      style={{ 
        backgroundColor: `${defaultTheme.colors.accents.cyan}10`,
        border: `1px solid ${defaultTheme.colors.accents.cyan}30`
      }}
    >
      <div className="flex items-center gap-1 mb-1">
        <span>📦</span>
        <span style={{ color: defaultTheme.colors.accents.cyan, fontWeight: 600 }}>
          Available from previous steps:
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {availableVars.map((varInfo, i) => (
          <div key={i} className="flex flex-col">
            <button
              type="button"
              onClick={() => onInsert && onInsert(`{{${varInfo.name}}}`)}
              className="px-2 py-1 rounded font-mono text-xs transition hover:brightness-110"
              style={{
                backgroundColor: defaultTheme.colors.background.tertiary,
                color: defaultTheme.colors.accents.yellow,
                border: `1px solid ${defaultTheme.colors.accents.yellow}40`
              }}
            >
              {`{{${varInfo.name}}}`}
            </button>
            {varInfo.keys && varInfo.keys.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 ml-2">
                {varInfo.keys
                  .filter(k => !k.includes('Wrapper') && !k.startsWith('...'))
                  .slice(0, 5)
                  .map((key, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => onInsert && onInsert(`{{${varInfo.name}.${key}}}`)}
                      className="px-1 py-0.5 rounded font-mono transition hover:brightness-110"
                      style={{
                        backgroundColor: defaultTheme.colors.background.secondary,
                        color: defaultTheme.colors.text.secondary,
                        fontSize: '10px'
                      }}
                    >
                      .{key}
                    </button>
                  ))}
                {varInfo.keys.filter(k => !k.includes('Wrapper') && !k.startsWith('...')).length > 5 && (
                  <span style={{ color: defaultTheme.colors.text.tertiary, fontSize: '10px' }}>
                    +{varInfo.keys.filter(k => !k.includes('Wrapper')).length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AddTransitionModal({
  isOpen,
  onClose,
  onSubmit,
  sourceState,
  targetState,
  projectPath,
  mode = 'add',
  initialData = null,
  // ❌ REMOVE: availablePlatforms = ["web"],
}) {
  // ✅ ADD: Load platforms from config
  const { platformNames, loading: platformsLoading } = useProjectConfig(projectPath);
  const availablePlatforms = platformNames.length > 0 ? platformNames : ['web'];

const [formData, setFormData] = useState({
  event: "",
  description: "",
  platform: "web",
  hasActionDetails: false,
  navigationMethod: "",
  navigationFile: "",
  imports: [],
  steps: [],
  requires: {},
  conditions: null,
  isObserver: false,  // ← ADD THIS
});
const [requiresSuggestions, setRequiresSuggestions] = useState([]);

const [testDataSchema, setTestDataSchema] = useState([]);

const [activeStepId, setActiveStepId] = useState(null);

// Add sensors configuration
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

// Add drag handlers
const handleStepDragStart = (event) => {
  setActiveStepId(event.active.id);
};

const handleStepDragEnd = (event) => {
  const { active, over } = event;
  setActiveStepId(null);

  if (!over || active.id === over.id) return;

  setFormData((prev) => {
    const oldIndex = prev.steps.findIndex((s, i) => (s.id || `step-${i}`) === active.id);
    const newIndex = prev.steps.findIndex((s, i) => (s.id || `step-${i}`) === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(prev.steps, oldIndex, newIndex);
      return { ...prev, steps: reordered };
    }
    return prev;
  });
};

const handleStepDragCancel = () => {
  setActiveStepId(null);
};

// Get active step for drag overlay
const activeStep = useMemo(() => {
  if (!activeStepId) return null;
  const index = formData.steps.findIndex((s, i) => (s.id || `step-${i}`) === activeStepId);
  return index !== -1 ? formData.steps[index] : null;
}, [activeStepId, formData.steps]);


// Load suggestions and test data schema when modal opens
useEffect(() => {
  if (isOpen) {
    setRequiresSuggestions(getRequiresSuggestions());
    fetchTestDataSchema();
  }
}, [isOpen, projectPath]);

// ✅ NEW: Fetch test data schema from config
const fetchTestDataSchema = async () => {
  if (!projectPath) return;
  try {
    const response = await fetch(
      `${API_URL}/api/config/test-data-schema/${encodeURIComponent(projectPath)}`
    );
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.schema) {
        console.log('📋 Loaded test data schema:', data.schema.length, 'fields');
        setTestDataSchema(data.schema);
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch test data schema:', error);
  }
};

// State for requires input
const [newRequiresKey, setNewRequiresKey] = useState('');
const [newRequiresValue, setNewRequiresValue] = useState('true');
const [newRequiresValueType, setNewRequiresValueType] = useState('boolean');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // POM Discovery State
  const [availablePOMs, setAvailablePOMs] = useState([]);
  const [loadingPOMs, setLoadingPOMs] = useState(false);
  const [pomDetails, setPomDetails] = useState({});

  // Navigation Discovery State
  const [navigationFiles, setNavigationFiles] = useState([]);
  const [selectedNavFile, setSelectedNavFile] = useState("");
  const [loadingNavigation, setLoadingNavigation] = useState(false);
  const [editModeInitialized, setEditModeInitialized] = useState(false)
    // ✅ ADD: POM data for argument suggestions
  // const { 
  //   poms: availablePOMsFromHook,
  //   getPOMFunctions,
  //   getPOMLocatorsSync,
  //   getMethodReturnKeys 
  // } = usePOMData(projectPath);
    const [stepMethodInfos, setStepMethodInfos] = useState({});

// ✨ NEW: Compute available storeAs variables from previous steps
  const availableStoreAsVars = useMemo(() => {
    const vars = [];
    
    // Guard against undefined steps/imports
    if (!formData.steps || !formData.imports) return vars;
    
    formData.steps.forEach((step, index) => {
      if (step.storeAs) {
        const matchingImport = formData.imports.find(imp => imp.varName === step.instance);
        const methodInfo = matchingImport?.functions?.find(f => f.name === step.method);
        
        vars.push({
          name: step.storeAs,
          stepIndex: index,
          method: step.method,
          keys: methodInfo?.returns?.keys || []
        });
      }
    });
    
    return vars;
  }, [formData.steps, formData.imports]);
    // ✅ NEW: Combine stored variables from props + current steps for conditions
// ✅ NEW: Combine ALL available variables for conditions
 // ✅ Combine ALL available variables for conditions
  // Includes: props, form steps, and source state's UI validations
// ✅ Combine ALL available variables for conditions
// Includes: form steps and source state's UI validations
const allStoredVariables = useMemo(() => {
  const vars = [];
  const seen = new Set();
  
  const addVar = (v) => {
    if (!seen.has(v.name)) {
      seen.add(v.name);
      vars.push(v);
    }
  };
  
  // 1. Variables from current form steps (storeAs)
  availableStoreAsVars.forEach(addVar);
  
  // 2. Variables from source state's UI validations (storeAs)
  if (sourceState) {
    const uiVars = collectVariablesFromUIValidations(sourceState);
    uiVars.forEach(v => {
      v.source = 'ui-storeAs';
      v.fromState = sourceState.id || sourceState.meta?.status || 'source';
      addVar(v);
    });
  }
  
  return vars;
}, [availableStoreAsVars, sourceState]);  // ✅ Remove storedVariables from deps

  // ✨ NEW: Get available vars for a specific step (only from PREVIOUS steps)
  const getAvailableVarsForStep = (stepIndex) => {
    return availableStoreAsVars.filter(v => v.stepIndex < stepIndex);
  };

  

 // ═══════════════════════════════════════════════════════════════════════════
// EDIT MODE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
useEffect(() => {
  console.log('🟢 AddTransitionModal useEffect triggered');
  console.log('🟢 mode:', mode);
  console.log('🟢 isOpen:', isOpen);
  console.log('🟢 initialData:', initialData);
  console.log('🟢 initialData?.actionDetails:', initialData?.actionDetails);
  if (mode === 'edit' && initialData && isOpen) {
    console.log('📝 Edit mode - initialData:', JSON.stringify(initialData, null, 2));  // ✅ ADD THIS
    console.log('📝 initialData.conditions:', initialData.conditions);  // ✅ ADD THIS
    
    // Handle platforms as array OR string
    let platform = "web";
    if (initialData.platforms && Array.isArray(initialData.platforms)) {
      platform = initialData.platforms[0] || "web";
    } else if (initialData.platform) {
      platform = initialData.platform;
    } else if (initialData.actionDetails?.platform) {
      platform = initialData.actionDetails.platform;
    }
    
    console.log('   📍 Detected platform:', platform);
    console.log('   📍 Navigation file:', initialData.actionDetails?.navigationFile);
    console.log('   📍 Navigation method:', initialData.actionDetails?.navigationMethod);
    console.log('   📍 Imports:', initialData.actionDetails?.imports?.length || 0);
    console.log('   📍 Steps:', initialData.actionDetails?.steps?.length || 0);
    
setFormData({
  event: initialData.event || "",
  description: initialData.actionDetails?.description || "",
  platform: platform,
  hasActionDetails: !!initialData.actionDetails,
  navigationMethod: initialData.actionDetails?.navigationMethod || "",
  navigationFile: initialData.actionDetails?.navigationFile || "",
  requires: initialData.requires || {},
  conditions: initialData.conditions || null,
  isObserver: initialData.isObserver || initialData.mode === 'observer' || initialData.mode === 'verify' || false,  // ← ADD
  imports: (initialData.actionDetails?.imports || []).map(imp => ({
    ...imp,
    selectedPOM: imp.className,
    functions: [],
  })),
steps: (initialData.actionDetails?.steps || []).map(step => {
  let argsArray = [];
  if (Array.isArray(step.argsArray)) {
    argsArray = step.argsArray;
  } else if (Array.isArray(step.args)) {
    argsArray = step.args;
  } else if (typeof step.args === 'string' && step.args) {
    argsArray = step.args.split(',').map(s => s.trim());
  }
  
  return {
    ...step,
    id: step.id || `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,  // ✅ ADD unique ID
    type: step.type || 'pom-method',  // ✅ ADD THIS - default to pom-method
    args: argsArray,
    availableMethods: [],
    signature: step.method ? `${step.method}(${argsArray.join(', ')})` : "",
  };
}),
    });
    
    if (initialData.actionDetails?.navigationFile) {
      setSelectedNavFile(initialData.actionDetails.navigationFile);
    }
    
    // ✅ Mark initialization complete
    setEditModeInitialized(true);
  }
}, [mode, initialData, isOpen]);

// ═══════════════════════════════════════════════════════════════════════════
// AFTER NAVIGATION FILES LOAD - Select the correct one
// ═══════════════════════════════════════════════════════════════════════════
useEffect(() => {
  if (mode === 'edit' && navigationFiles.length > 0 && initialData?.actionDetails?.navigationFile) {
    const navFile = initialData.actionDetails.navigationFile;
    const exists = navigationFiles.some(nf => nf.className === navFile);
    
    if (exists) {
      console.log('✅ Navigation file found in loaded files:', navFile);
      setSelectedNavFile(navFile);
      setFormData(prev => ({
        ...prev,
        navigationFile: navFile,
        navigationMethod: initialData.actionDetails?.navigationMethod || prev.navigationMethod
      }));
    } else {
      console.warn('⚠️ Navigation file not found:', navFile);
      console.log('   Available:', navigationFiles.map(nf => nf.className));
    }
  }
}, [mode, navigationFiles, initialData]);

// ═══════════════════════════════════════════════════════════════════════════
// AFTER POMs LOAD - Populate functions for imports
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// AFTER POMs LOAD - Populate functions for imports AND match signatures
// ═══════════════════════════════════════════════════════════════════════════
useEffect(() => {
  if (mode === 'edit' && availablePOMs.length > 0 && formData.imports.length > 0) {
    console.log('📦 POMs loaded, populating functions for imports...');
    
    // First, update imports with functions
    const updatedImports = formData.imports.map(imp => {
      const matchingPOM = availablePOMs.find(p => p.className === imp.className);
      if (matchingPOM) {
        const mainClass = matchingPOM.classes?.[0];
        const functions = mainClass?.functions || [];
        console.log(`   ✅ ${imp.className}: ${functions.length} functions`);
        return { ...imp, selectedPOM: imp.className, functions: functions };
      }
      return imp;
    });
    
    // Then, update steps with availableMethods AND find matching signature
    const updatedSteps = formData.steps.map(step => {
      if (step.instance) {
        const matchingImport = updatedImports.find(imp => imp.varName === step.instance);
        if (matchingImport) {
          const functions = matchingImport.functions || [];
          
          // ✅ Try to find matching method signature
          let matchedSignature = step.signature || '';
          if (step.method && functions.length > 0) {
            const matchingFunc = functions.find(f => f.name === step.method);
            if (matchingFunc) {
              matchedSignature = matchingFunc.signature;
              console.log(`   🎯 Matched method ${step.method} → ${matchedSignature}`);
            }
          }
          
          return { 
            ...step, 
            availableMethods: functions,
            signature: matchedSignature
          };
        }
      }
      return step;
    });
    
    setFormData(prev => ({
      ...prev,
      imports: updatedImports,
      steps: updatedSteps
    }));
  }
}, [mode, availablePOMs]); 

// ═══════════════════════════════════════════════════════════════════════════
// FETCH NAVIGATION - With edit mode guard
// ═══════════════════════════════════════════════════════════════════════════
useEffect(() => {
  if (isOpen && projectPath && formData.platform) {
    if (mode === 'edit' && !editModeInitialized) {
      console.log('⏳ Skipping navigation fetch - edit mode initializing...');
      return;
    }
    fetchNavigationFiles();
  }
}, [isOpen, projectPath, formData.platform, editModeInitialized]);

// ═══════════════════════════════════════════════════════════════════════════
// FETCH POMs - With edit mode guard
// ═══════════════════════════════════════════════════════════════════════════
useEffect(() => {
  if (isOpen && projectPath && formData.platform) {
    if (mode === 'edit' && !editModeInitialized) {
      console.log('⏳ Skipping POM fetch - edit mode initializing...');
      return;
    }
    console.log(`♻️ Platform changed to: ${formData.platform}, re-fetching POMs...`);
    fetchAvailablePOMs();
  }
}, [formData.platform, editModeInitialized]);

// ═══════════════════════════════════════════════════════════════════════════
// RESET FLAG WHEN MODAL CLOSES
// ═══════════════════════════════════════════════════════════════════════════
useEffect(() => {
  if (!isOpen) {
    setEditModeInitialized(false);
  }
}, [isOpen]);

// ═══════════════════════════════════════════════════════════════════════════
// RESET FORM IN CREATE MODE
// ═══════════════════════════════════════════════════════════════════════════
useEffect(() => {
    if (isOpen && mode === 'create') {
      setFormData({
        event: "",
        description: "",
        platform: "web",
        hasActionDetails: false,
        navigationMethod: "",
        navigationFile: "",
        imports: [],
        steps: [],
        requires: {},
        conditions: null,  // ← ADD THIS
      });
    setErrors({});
    setSelectedNavFile("");
    setNavigationFiles([]);
    setNewRequiresKey('');
    setNewRequiresValue('true');
    setNewRequiresValueType('boolean');
  }
}, [isOpen, mode]);

  // Fetch POMs from API
const fetchAvailablePOMs = async (platform) => {
  console.log('🔍 fetchAvailablePOMs called, platform:', platform || formData.platform);
  setLoadingPOMs(true);
  try {
    // ✅ Pass platform to API - let backend handle filtering via config
    const targetPlatform = platform || formData.platform;
    let url = `${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`;
    if (targetPlatform) {
      url += `&platform=${encodeURIComponent(targetPlatform)}`;
    }
    
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      console.log('📦 POMs from API:', data.poms?.length, 'for platform:', data.platform);

      // ✅ Extract ALL classes from each POM file
      const transformedPOMs = [];
      
      for (const pom of data.poms) {
        if (pom.classes && pom.classes.length > 0) {
          for (const classData of pom.classes) {
            transformedPOMs.push({
              name: classData.name,
              className: classData.name,
              path: pom.path,
              filePath: pom.path,
              classes: [classData],
              functions: classData.functions || []
            });
          }
        }
      }

      console.log('✅ Total classes extracted:', transformedPOMs.length);
      
      // ✅ No frontend filtering needed - API already filtered!
      setAvailablePOMs(transformedPOMs);
    }
  } catch (error) {
    console.error('Error fetching POMs:', error);
    setAvailablePOMs([]);
  } finally {
    setLoadingPOMs(false);
  }
};

const handleStepConditionsChange = (stepIndex, newConditions) => {
  const newSteps = [...formData.steps];
  newSteps[stepIndex] = {
    ...newSteps[stepIndex],
    conditions: newConditions
  };
  setFormData(prev => ({ ...prev, steps: newSteps }));
};

/**
 * ✅ ENHANCED: Fetch navigation files using dedicated endpoint
 * - Uses /api/poms/navigation endpoint
 * - Platform filtering done on backend
 * - Gets ALL methods (not just ones with params)
 */
const fetchNavigationFiles = async () => {
  setLoadingNavigation(true);
  try {
    const navFiles = await getCachedNavigation(projectPath, formData.platform);
    setNavigationFiles(navFiles);
  } finally {
    setLoadingNavigation(false);
  }
};

// ═══════════════════════════════════════════════════════════════════
// ALTERNATIVE: If you don't want to add new endpoint, use this version
// that filters from existing /api/poms endpoint (less efficient but works)
// ═══════════════════════════════════════════════════════════════════

/**
 * FALLBACK: Fetch navigation files from /api/poms (filters on frontend)
 * Use this if you can't add the new endpoint yet
 */
const fetchNavigationFiles_Fallback = async () => {
  setLoadingNavigation(true);
  try {
    const platform = formData.platform || "web";
    console.log("🧭 Fetching navigation files for platform:", platform);

    const response = await fetch(
      `${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`
    );

    if (response.ok) {
      const data = await response.json();
      
      // ✅ Filter for navigation files
      const navFiles = data.poms.filter(pom => {
        const pomPath = (pom.path || '').toLowerCase();
        const fileName = pomPath.split('/').pop() || '';
        const className = pom.classes?.[0]?.name?.toLowerCase() || '';
        
        // Must contain "navigation" in filename or class name
        return fileName.includes('navigation') || className.includes('navigation');
      });

      // ✅ Filter by platform
      const platformNavFiles = navFiles.filter(pom => {
        const pomPath = (pom.path || '').toLowerCase().replace(/\\/g, '/');
        
        if (platform === 'web') {
          return pomPath.includes('/web/');
        } else if (platform === 'dancer') {
          return pomPath.includes('/dancer/') || pomPath.includes('/android/dancer/');
        } else if (platform === 'manager') {
          return pomPath.includes('/manager/') || pomPath.includes('/android/manager/');
        }
        
        return false;
      });

      // ✅ Transform and get ALL methods
      const transformedNavFiles = platformNavFiles.map(pom => {
        const mainClass = pom.classes?.[0];
        const className = mainClass?.name || pom.name;
        
        // ✅ FIXED: Get ALL methods (functions array now includes all)
        const methods = mainClass?.functions || [];
        
        // ✅ Also add methods that might not be in functions array
        if (mainClass?.methods) {
          for (const method of mainClass.methods) {
            const alreadyAdded = methods.some(m => m.name === method.name);
            if (!alreadyAdded) {
              methods.push({
                name: method.name,
                signature: `${method.name}()`,
                async: method.async || false,
                parameters: []
              });
            }
          }
        }
        
        return {
          className: className,
          displayName: `${className} (${platform})`,
          path: pom.path,
          methods: methods
        };
      });

      console.log(`✅ Found ${transformedNavFiles.length} navigation files for ${platform}`);
      
      // Log for debugging
      transformedNavFiles.forEach(nav => {
        console.log(`   📍 ${nav.displayName}: ${nav.methods.length} methods`);
      });

      setNavigationFiles(transformedNavFiles);
    } else {
      console.error("Failed to fetch navigation files:", response.status);
      setNavigationFiles([]);
    }
  } catch (error) {
    console.error("Error fetching navigation files:", error);
    setNavigationFiles([]);
  } finally {
    setLoadingNavigation(false);
  }
};

  // Fetch POM details
  const fetchPOMDetails = async (pomName) => {
    if (pomDetails[pomName]) {
      return pomDetails[pomName];
    }

    try {
      const response = await fetch(
        `${API_URL}/api/poms/${pomName}?projectPath=${encodeURIComponent(projectPath)}`
      );
      if (response.ok) {
        const data = await response.json();
        console.log(`📋 POM Details for ${pomName}:`, data);

        setPomDetails((prev) => ({
          ...prev,
          [pomName]: data,
        }));

        return data;
      }
    } catch (error) {
      console.error(`Error fetching POM details for ${pomName}:`, error);
    }
    return null;
  };

  // Reset form when modal opens/closes (only in create mode)
  useEffect(() => {
    if (isOpen && mode === 'create') {
      setFormData({
        event: "",
        description: "",
        platform: "web",
        hasActionDetails: false,
        navigationMethod: "",
        navigationFile: "",
        imports: [],
        steps: [],
         requires: {},
        conditions: null,  // ← ADD THIS
      });
      setErrors({});
      setSelectedNavFile("");
      setNavigationFiles([]);
    }
  }, [isOpen, mode]);

  // Add new import
  const handleAddImport = () => {
    setFormData((prev) => ({
      ...prev,
      imports: [
        ...prev.imports,
        {
          className: "",
          varName: "",
          path: "",
          constructor: "",
          selectedPOM: "",
          availableInstances: [],
          selectedInstance: "",
        },
      ],
    }));
  };

  // Handle POM selection
  const handlePOMSelect = async (index, pomName) => {
    console.log(`🔍 Selected POM: ${pomName}`);

    const selectedPOM = availablePOMs.find((p) => p.className === pomName);

    if (selectedPOM) {
      const mainClass = selectedPOM.classes?.[0];
      const constructorTemplate = `new ${pomName}(page, ctx.data.lang || 'en', ctx.data.device || 'desktop')`;
      const pathTemplate = selectedPOM.path || selectedPOM.filePath;
      const varName = pomName.charAt(0).toLowerCase() + pomName.slice(1);

      setFormData((prev) => ({
        ...prev,
        imports: prev.imports.map((imp, i) =>
          i === index
            ? {
                ...imp,
                selectedPOM: pomName,
                className: pomName,
                varName: varName,
                path: pathTemplate,
                constructor: constructorTemplate,
                functions: mainClass?.functions || [],
              }
            : imp
        ),
      }));
    }
  };

  // Update import field
  const handleImportChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      imports: prev.imports.map((imp, i) =>
        i === index ? { ...imp, [field]: value } : imp
      ),
    }));
  };

  // Remove import
  const handleRemoveImport = (index) => {
    setFormData((prev) => ({
      ...prev,
      imports: prev.imports.filter((_, i) => i !== index),
    }));
  };

  // Add new step
const handleAddStep = () => {
  setFormData((prev) => ({
    ...prev,
    steps: [
      ...prev.steps,
      {
        id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,  // ✅ Unique ID
        type: 'pom-method',
        description: "",
        instance: "",
        method: "",
        args: [],
        availableMethods: [],
        screen: "",
        locator: "",
        value: "",
        waitState: "visible",
        code: "",
        storeAs: "",
        conditions: null,
      },
    ],
  }));
};

  // Handle instance selection for step
  const handleStepInstanceSelect = (stepIndex, instanceVarName) => {
    const matchingImport = formData.imports.find(
      (imp) => imp.varName === instanceVarName
    );

    if (matchingImport) {
      const availableMethods = matchingImport.functions || [];

      setFormData((prev) => ({
        ...prev,
        steps: prev.steps.map((step, i) =>
          i === stepIndex
            ? {
                ...step,
                instance: instanceVarName,
                availableMethods: availableMethods,
                method: "",
                args: [],
              }
            : step
        ),
      }));
    }
  };

  // Handle method selection with signature
// Handle method selection with signature AND parameter info
  const handleStepMethodSelect = (stepIndex, methodSignature) => {
    const match = methodSignature.match(/^([^(]+)\(([^)]*)\)/);

    if (match) {
      const methodName = match[1];
      const paramsStr = match[2];
      
      // Find the step's instance to get method info
      const step = formData.steps[stepIndex];
      const matchingImport = formData.imports.find(imp => imp.varName === step.instance);
      
      // Get full method info from the import's functions
      const methodInfo = matchingImport?.functions?.find(f => f.name === methodName);
      
      // Store method info for this step
      setStepMethodInfos(prev => ({
        ...prev,
        [stepIndex]: methodInfo || null
      }));

      // Initialize args based on parameters
      const initialArgs = (methodInfo?.parameters || []).map(p => 
        p.hasDefault ? String(p.defaultValue || '') : ''
      );

      setFormData((prev) => ({
        ...prev,
        steps: prev.steps.map((s, i) =>
          i === stepIndex
            ? {
                ...s,
                method: methodName,
                signature: methodSignature,
                args: initialArgs,
              }
            : s
        ),
      }));
    }
  };


    // ✅ NEW: Handle individual argument change
  const handleStepArgChange = (stepIndex, argIndex, value) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => {
        if (i === stepIndex) {
          const newArgs = [...(step.args || [])];
          newArgs[argIndex] = value;
          return { ...step, args: newArgs };
        }
        return step;
      }),
    }));
  };

  // Update step field
 const handleStepChange = (index, field, value) => {
  setFormData((prev) => {
    const newSteps = prev.steps.map((step, i) =>
      i === index ? { ...step, [field]: value } : step
    );
    
    // ✅ AUTO-ADD IMPORT when selecting screen for inline action
    if (field === 'screen' && value && ['click', 'fill', 'getText', 'waitFor'].includes(newSteps[index].type)) {
      const alreadyImported = prev.imports.some(imp => imp.className === value);
      
      if (!alreadyImported) {
        const pom = availablePOMs.find(p => p.className === value);
        if (pom) {
          const varName = value.charAt(0).toLowerCase() + value.slice(1);
          const newImport = {
            className: value,
            varName: varName,
            path: pom.path || pom.filePath,
            constructor: `new ${value}(page, ctx.data.lang || 'en', ctx.data.device || 'desktop')`,
            selectedPOM: value,
            functions: pom.classes?.[0]?.functions || [],
          };
          
          console.log(`✅ Auto-adding import for inline action: ${value}`);
          
          return {
            ...prev,
            steps: newSteps,
            imports: [...prev.imports, newImport],
          };
        }
      }
    }
    
    return { ...prev, steps: newSteps };
  });
};

  // Update step args with assignment detection
  const handleStepArgsChange = (index, value) => {
    const argsArray = value
      .split(",")
      .map((arg) => {
        arg = arg.trim();

        if (arg.includes(" = ")) {
          const [varPath, defaultValue] = arg.split(" = ").map((s) => s.trim());
          console.warn(
            `⚠️ Auto-fixing: "${arg}" → "${varPath} || ${defaultValue}"`
          );
          return `${varPath} || ${defaultValue}`;
        }

        return arg;
      })
      .filter((arg) => arg);

    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, args: argsArray } : step
      ),
    }));
  };

   const handleInsertVariable = (stepIndex, variable) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => {
        if (i === stepIndex) {
          const currentArgs = step.args.join(', ');
          const newArgs = currentArgs ? `${currentArgs}, ${variable}` : variable;
          return {
            ...step,
            args: newArgs.split(',').map(a => a.trim()).filter(Boolean)
          };
        }
        return step;
      }),
    }));
  };

  // Remove step
  const handleRemoveStep = (index) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.event.trim()) {
      newErrors.event = "Event name is required";
    } else if (!/^[A-Z_]+$/.test(formData.event)) {
      newErrors.event = "Event name must be UPPERCASE_WITH_UNDERSCORES";
    }

    if (formData.hasActionDetails) {
      if (!formData.description.trim()) {
        newErrors.description =
          "Description is required when adding action details";
      }

      formData.imports.forEach((imp, index) => {
        if (!imp.className.trim()) {
          newErrors[`import_${index}_className`] = "Class name is required";
        }
        if (!imp.varName.trim()) {
          newErrors[`import_${index}_varName`] = "Variable name is required";
        }
        if (!imp.path.trim()) {
          newErrors[`import_${index}_path`] = "Path is required";
        }
        if (!imp.constructor.trim()) {
          newErrors[`import_${index}_constructor`] = "Constructor is required";
        }
      });

formData.steps.forEach((step, index) => {
  if (!step.description?.trim()) {
    newErrors[`step_${index}_description`] = "Step description is required";
  }
  
  // Only validate instance/method for pom-method type
  if (!step.type || step.type === 'pom-method') {
    if (!step.instance?.trim()) {
      newErrors[`step_${index}_instance`] = "Instance name is required";
    }
    if (!step.method?.trim()) {
      newErrors[`step_${index}_method`] = "Method name is required";
    }
  }
  
  // Validate inline action types
  if (['click', 'fill', 'getText', 'waitFor'].includes(step.type)) {
    if (!step.screen?.trim()) {
      newErrors[`step_${index}_screen`] = "Screen object is required";
    }
    if (!step.locator?.trim()) {
      newErrors[`step_${index}_locator`] = "Locator is required";
    }
    if (step.type === 'fill' && !step.value?.trim()) {
      newErrors[`step_${index}_value`] = "Value is required for fill";
    }
  }
  
  // Validate custom code
  if (step.type === 'custom') {
    if (!step.code?.trim()) {
      newErrors[`step_${index}_code`] = "Code is required for custom step";
    }
  }
});
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ NEW: Handle conditions change from ConditionBlockList
  const handleConditionsChange = (newConditions) => {
    setFormData(prev => ({
      ...prev,
      conditions: newConditions,
      // Also update legacy requires for backward compat
      requires: conditionsToRequires(newConditions) || {}
    }));
  };

  // Handle submit

  // Handle submit
const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!validateForm()) {
    console.log('❌ Validation failed:', errors);
    return;
  }
  
  setLoading(true);

  try {
    // ✅ Helper: Build imports including any screens used in inline actions
    const buildImports = () => {
      const imports = [...formData.imports];
      const importedClassNames = new Set(imports.map(imp => imp.className));
      
      // Check if any inline action steps use a screen that's not imported
      for (const step of formData.steps) {
        if (['click', 'fill', 'getText', 'waitFor'].includes(step.type) && step.screen) {
          if (!importedClassNames.has(step.screen)) {
            // Find the POM in availablePOMs
            const pom = availablePOMs.find(p => p.className === step.screen);
            if (pom) {
              const varName = step.screen.charAt(0).toLowerCase() + step.screen.slice(1);
              imports.push({
                className: step.screen,
                varName: varName,
                path: pom.path || pom.filePath,
                constructor: `new ${step.screen}(page, ctx.data.lang || 'en', ctx.data.device || 'desktop')`,
              });
              importedClassNames.add(step.screen);
              console.log(`✅ Auto-added import for ${step.screen}`);
            }
          }
        }
      }
      
      return imports.map(imp => ({
        className: imp.className,
        varName: imp.varName,
        path: imp.path,
        constructor: imp.constructor,
      }));
    };

    // ✅ Helper: Build step with proper instance/method for inline actions
    const buildStep = (step) => {
      const baseStep = {
        type: step.type || 'pom-method',
        description: step.description,
        storeAs: step.storeAs || undefined,
        persistStoreAs: step.storeAs ? (step.persistStoreAs !== false) : undefined,
        conditions: (step.conditions?.blocks?.length > 0) ? step.conditions : undefined,
      };
      
      // POM method - keep as-is
      if (step.type === 'pom-method' || !step.type) {
        return {
          ...baseStep,
          instance: step.instance,
          method: step.method,
          args: step.args?.join(', ') || '',
          argsArray: step.args || [],
        };
      }
      
      // Custom code - keep as-is
      if (step.type === 'custom') {
        return {
          ...baseStep,
          code: step.code,
        };
      }
      
      // ✅ INLINE ACTIONS: Convert to instance/method format
      if (['click', 'fill', 'getText', 'waitFor'].includes(step.type)) {
        const screenName = step.screen || '';
        const locatorName = step.locator || '';
        const instanceName = screenName 
          ? screenName.charAt(0).toLowerCase() + screenName.slice(1) 
          : '';
        
       // Build locator chain with index
let locatorChain = locatorName;
if (step.elementIndex === 'first') {
  locatorChain = `${locatorName}.first()`;
} else if (step.elementIndex === 'last') {
  locatorChain = `${locatorName}.last()`;
} else if (step.elementIndex === 'custom' && step.customIndex !== undefined) {
  locatorChain = `${locatorName}.nth(${step.customIndex})`;
} else if (step.elementIndex === 'variable' && step.indexVariable) {
  // Variable index - generates actual JS code like .nth(ctx.data.cardIndex)
  locatorChain = `${locatorName}.nth(${step.indexVariable})`;
}
        
        // Build method name based on action type
        let methodName;
        let argsArray = [];
        
        switch (step.type) {
          case 'click':
            methodName = `${locatorChain}.click`;
            break;
          case 'fill':
            methodName = `${locatorChain}.fill`;
            argsArray = step.value ? [step.value] : [];
            break;
          case 'getText':
            methodName = `${locatorChain}.textContent`;
            break;
          case 'waitFor':
            methodName = `${locatorChain}.waitFor`;
            argsArray = [`{ state: '${step.waitState || 'visible'}' }`];
            break;
        }
        
        return {
          ...baseStep,
          // ✅ KEY: These fields make the test generator work!
          instance: instanceName,
          method: methodName,
          args: argsArray.join(', '),
          argsArray: argsArray,
          // Keep original fields for UI round-trip editing
          screen: screenName,
          locator: locatorName,
          elementIndex: step.elementIndex || undefined,
customIndex: step.elementIndex === 'custom' ? (step.customIndex || 0) : undefined,
indexVariable: step.elementIndex === 'variable' ? step.indexVariable : undefined,
          ...(step.type === 'fill' && { value: step.value }),
          ...(step.type === 'waitFor' && { waitState: step.waitState }),
        };
      }
      
      return baseStep;
    };

    const submitData = {
      event: formData.event.trim(),
      platform: formData.platform,
      isObserver: formData.isObserver || undefined,
      mode: formData.isObserver ? 'observer' : undefined,
      requires: Object.keys(formData.requires || {}).length > 0 ? formData.requires : undefined,
      conditions: (formData.conditions?.blocks?.length > 0) ? formData.conditions : undefined,
      actionDetails: formData.hasActionDetails
        ? {
            description: formData.description.trim(),
            platform: formData.platform,
            navigationMethod: formData.navigationMethod || null,
            navigationFile: formData.navigationFile || null,
            imports: buildImports(),  // ✅ Use helper
            steps: formData.steps.map(buildStep),  // ✅ Use helper
          }
        : null,
    };

    console.log("🚀 Submitting transition:", mode, submitData);

    await onSubmit(submitData);
    onClose();
  } catch (error) {
    setErrors({ submit: error.message });
  } finally {
    setLoading(false);
  }
};

  if (!isOpen) return null;

  // ✅ Conditional titles based on mode
  const title = mode === 'edit' ? '✏️ Edit Transition' : '🔗 Add Transition';
  const submitLabel = mode === 'edit' ? '💾 Update Transition' : '✅ Add Transition';
  const submitIcon = mode === 'edit' ? '💾' : '✅';

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl mx-4 my-8 rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: defaultTheme.colors.background.secondary,
          border: `2px solid ${defaultTheme.colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 border-b"
          style={{
            backgroundColor: defaultTheme.colors.background.secondary,
            borderColor: defaultTheme.colors.border,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-2xl font-bold"
                style={{ color: mode === 'edit' ? defaultTheme.colors.accents.blue : defaultTheme.colors.accents.green }}
              >
                {title} {(loadingPOMs || loadingNavigation) && "(Loading...)"}
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: defaultTheme.colors.text.secondary }}
              >
                <span style={{ color: defaultTheme.colors.accents.green }}>
                  {sourceState?.id || sourceState?.name || "source"}
                </span>
                {" → "}
                <span style={{ color: defaultTheme.colors.accents.blue }}>
                  {mode === 'edit' ? (initialData?.target || "target") : (targetState?.id || "target")}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-3xl font-bold px-3 py-1 rounded-lg transition"
              style={{
                color: defaultTheme.colors.accents.red,
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) =>
                (e.target.style.backgroundColor = `${defaultTheme.colors.accents.red}20`)
              }
              onMouseLeave={(e) =>
                (e.target.style.backgroundColor = "transparent")
              }
            >
              ×
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Event Name */}
          <div>
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: defaultTheme.colors.text.primary }}
            >
              Event Name *
            </label>
            <input
              type="text"
              value={formData.event}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  event: e.target.value.toUpperCase(),
                }))
              }
              placeholder="e.g., SUBMIT_SEARCH, SELECT_AGENCY"
              className="w-full px-4 py-2 rounded-lg font-mono"
              style={{
                backgroundColor: defaultTheme.colors.background.tertiary,
                color: defaultTheme.colors.text.primary,
                border: `1px solid ${errors.event ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
              }}
            />
            {errors.event && (
              <p
                className="text-sm mt-1"
                style={{ color: defaultTheme.colors.accents.red }}
              >
                {errors.event}
              </p>
            )}
          </div>

          {/* Platform Selection */}
          <div>
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: defaultTheme.colors.text.primary }}
            >
              Platform *{" "}
              <span
                className="text-xs font-normal"
                style={{ color: defaultTheme.colors.text.tertiary }}
              >
                (select one - POMs will be filtered)
              </span>
            </label>
            <div className="flex gap-3">
              {(availablePlatforms || ["web"]).map((platform) => (
                <label
                  key={platform}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition"
                  style={{
                    backgroundColor:
                      formData.platform === platform
                        ? `${defaultTheme.colors.accents.blue}20`
                        : defaultTheme.colors.background.tertiary,
                    border: `2px solid ${
                      formData.platform === platform
                        ? defaultTheme.colors.accents.blue
                        : defaultTheme.colors.border
                    }`,
                  }}
                >
                  <input
                    type="radio"
                    name="platform"
                    value={platform}
                    checked={formData.platform === platform}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        platform: e.target.value,
                      }))
                    }
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span style={{ color: defaultTheme.colors.text.primary }}>
                    {platform === "web" ? "🌐" : "📱"} {platform}
                  </span>
                </label>
              ))}
            </div>
            <p
              className="text-xs mt-1"
              style={{ color: defaultTheme.colors.text.tertiary }}
            >
              💡 This transition will only work on the selected platform
            </p>
          </div>

   {/* 👁️ Observer Mode Toggle */}
          <div 
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{
              backgroundColor: formData.isObserver 
                ? `${defaultTheme.colors.accents.cyan}15`
                : defaultTheme.colors.background.tertiary,
              border: `1px solid ${formData.isObserver 
                ? defaultTheme.colors.accents.cyan 
                : defaultTheme.colors.border}`,
            }}
          >
            <input
              type="checkbox"
              id="isObserver"
              checked={formData.isObserver}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  isObserver: e.target.checked,
                }))
              }
              className="w-4 h-4 cursor-pointer"
            />
            <label 
              htmlFor="isObserver" 
              className="cursor-pointer flex-1"
              style={{ color: defaultTheme.colors.text.primary }}
            >
              <span className="font-semibold">👁️ Observer Mode</span>
              <p 
                className="text-xs mt-1"
                style={{ color: defaultTheme.colors.text.secondary }}
              >
                This transition <strong>validates</strong> that a state exists, but doesn't <strong>create</strong> it.
                Use for cross-platform viewing (e.g., dancer viewing a booking created on web).
              </p>
            </label>
          </div>

          {/* Observer mode info box */}
          {formData.isObserver && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                backgroundColor: `${defaultTheme.colors.accents.cyan}10`,
                border: `1px solid ${defaultTheme.colors.accents.cyan}40`,
                color: defaultTheme.colors.text.secondary,
              }}
            >
              <div className="flex items-start gap-2">
                <span>💡</span>
                <div>
                  <strong style={{ color: defaultTheme.colors.accents.cyan }}>Observer tests:</strong>
                  <ul className="mt-1 ml-4 list-disc">
                    <li>Won't trigger loop detection when state already exists</li>
                    <li>Require the target state to be created by an <em>inducer</em> test first</li>
                    <li>Only validate UI, no state changes saved</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          {/* Data Flow Summary */}
<DataFlowSummary
  formData={formData}
  testDataSchema={testDataSchema}
  availableFromPriorStates={allStoredVariables}
  theme={defaultTheme}
/>

 {/* ✅ NEW: Condition Blocks Section (replaces old Requires) */}
          <ConditionBlockList
            conditions={formData.conditions}
            onChange={handleConditionsChange}
            editMode={true}
            theme={defaultTheme}
            testDataSchema={testDataSchema}
            storedVariables={allStoredVariables}
            requiresSuggestions={requiresSuggestions}
            legacyRequires={formData.requires}
          />

          {/* Action Details Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="hasActionDetails"
              checked={formData.hasActionDetails}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  hasActionDetails: e.target.checked,
                }))
              }
              className="w-5 h-5 cursor-pointer"
            />
            <label
              htmlFor="hasActionDetails"
              className="text-sm font-semibold cursor-pointer"
              style={{ color: defaultTheme.colors.text.primary }}
            >
              ✨ Add Action Details (generate executable code)
            </label>
          </div>

          {/* Action Details Section */}
          {formData.hasActionDetails && (
            <div
              className="p-4 rounded-lg space-y-6"
              style={{
                backgroundColor: defaultTheme.colors.background.tertiary,
                border: `1px solid ${defaultTheme.colors.border}`,
              }}
            >
              {/* Description */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: defaultTheme.colors.text.primary }}
                >
                  Action Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="e.g., Select agency from search bar"
                  className="w-full px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: defaultTheme.colors.background.secondary,
                    color: defaultTheme.colors.text.primary,
                    border: `1px solid ${errors.description ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                  }}
                />
                {errors.description && (
                  <p
                    className="text-sm mt-1"
                    style={{ color: defaultTheme.colors.accents.red }}
                  >
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Navigation Section */}
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: defaultTheme.colors.text.primary }}
                >
                  🧭 Navigation (optional)
                </label>
                <p
                  className="text-xs mb-3"
                  style={{ color: defaultTheme.colors.text.tertiary }}
                >
                  Select a navigation helper for {formData.platform} platform
                </p>

                {loadingNavigation ? (
                  <p className="text-sm text-center py-4" style={{ color: defaultTheme.colors.text.secondary }}>
                    ⏳ Loading navigation files...
                  </p>
                ) : navigationFiles.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: defaultTheme.colors.accents.yellow }}>
                    ⚠️ No navigation files found for {formData.platform}. Ensure files contain "navigation" in the filename.
                  </p>
                ) : (
                  <>
                    {/* Navigation File Selection */}
                    <select
                      value={selectedNavFile}
                      onChange={(e) => {
                        setSelectedNavFile(e.target.value);
                        setFormData((prev) => ({ 
                          ...prev, 
                          navigationMethod: "",
                          navigationFile: e.target.value 
                        }));
                      }}
                      className="w-full px-3 py-2 rounded text-sm mb-2"
                      style={{
                        backgroundColor: defaultTheme.colors.background.secondary,
                        color: defaultTheme.colors.text.primary,
                        border: `1px solid ${defaultTheme.colors.border}`,
                      }}
                    >
                      <option value="">-- Select navigation file --</option>
                      {navigationFiles.map((navFile, i) => (
                        <option key={i} value={navFile.className}>
                          {navFile.displayName} ({navFile.methods.length} methods)
                        </option>
                      ))}
                    </select>

                    {/* Navigation Method Selection */}
                    {selectedNavFile && (
                      <select
                        value={formData.navigationMethod || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            navigationMethod: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{
                          backgroundColor: defaultTheme.colors.background.secondary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${defaultTheme.colors.border}`,
                        }}
                      >
                        <option value="">-- Select navigation method --</option>
                        {navigationFiles
                          .find((nf) => nf.className === selectedNavFile)
                          ?.methods.map((method, i) => (
                            <option key={i} value={method.signature}>
                              {method.signature}
                            </option>
                          ))}
                      </select>
                    )}
                  </>
                )}
              </div>

              {/* Screen Objects / Imports */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label
                    className="text-sm font-semibold"
                    style={{ color: defaultTheme.colors.text.primary }}
                  >
                    📦 Screen Objects
                  </label>
                  <button
                    type="button"
                    onClick={handleAddImport}
                    className="px-3 py-1 rounded text-sm font-semibold transition"
                    style={{
                      backgroundColor: defaultTheme.colors.accents.green,
                      color: "white",
                    }}
                  >
                    + Add Import
                  </button>
                </div>

                {formData.imports.map((imp, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg mb-3 space-y-2"
                    style={{
                      backgroundColor: defaultTheme.colors.background.secondary,
                      border: `1px solid ${defaultTheme.colors.border}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: defaultTheme.colors.text.secondary }}
                      >
                        Import #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImport(index)}
                        className="text-sm px-2 py-1 rounded"
                        style={{ color: defaultTheme.colors.accents.red }}
                      >
                        Remove
                      </button>
                    </div>

                    {/* POM Dropdown */}
                    <div>
                      <label
                        className="text-xs"
                        style={{ color: defaultTheme.colors.text.secondary }}
                      >
                        Select POM (Screen Object) *
                      </label>
                      <select
                        value={imp.selectedPOM || ""}
                        onChange={(e) => handlePOMSelect(index, e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{
                          backgroundColor:
                            defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${defaultTheme.colors.border}`,
                        }}
                      >
                        <option value="">-- Select a POM --</option>
                        {availablePOMs.map((pom, idx) => (
                          <option key={idx} value={pom.className}>
                            {pom.className}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Auto-filled fields */}
                    {imp.selectedPOM && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label
                              className="text-xs"
                              style={{
                                color: defaultTheme.colors.text.secondary,
                              }}
                            >
                              Class Name * (auto-filled)
                            </label>
                            <input
                              type="text"
                              value={imp.className}
                              onChange={(e) =>
                                handleImportChange(
                                  index,
                                  "className",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-1 rounded text-sm"
                              style={{
                                backgroundColor:
                                  defaultTheme.colors.background.tertiary,
                                color: defaultTheme.colors.text.primary,
                                border: `1px solid ${errors[`import_${index}_className`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                              }}
                            />
                          </div>

                          <div>
                            <label
                              className="text-xs"
                              style={{
                                color: defaultTheme.colors.text.secondary,
                              }}
                            >
                              Variable Name * (auto-filled)
                            </label>
                            <input
                              type="text"
                              value={imp.varName}
                              onChange={(e) =>
                                handleImportChange(
                                  index,
                                  "varName",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-1 rounded text-sm"
                              style={{
                                backgroundColor:
                                  defaultTheme.colors.background.tertiary,
                                color: defaultTheme.colors.text.primary,
                                border: `1px solid ${errors[`import_${index}_varName`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                              }}
                            />
                          </div>

                          <div>
                            <label
                              className="text-xs"
                              style={{
                                color: defaultTheme.colors.text.secondary,
                              }}
                            >
                              Path * (auto-filled)
                            </label>
                            <input
                              type="text"
                              value={imp.path}
                              onChange={(e) =>
                                handleImportChange(
                                  index,
                                  "path",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-1 rounded text-sm"
                              style={{
                                backgroundColor:
                                  defaultTheme.colors.background.tertiary,
                                color: defaultTheme.colors.text.primary,
                                border: `1px solid ${errors[`import_${index}_path`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                              }}
                            />
                          </div>

                          <div>
                            <label
                              className="text-xs"
                              style={{
                                color: defaultTheme.colors.text.secondary,
                              }}
                            >
                              Constructor * (auto-filled, editable)
                            </label>
                            <input
                              type="text"
                              value={imp.constructor}
                              onChange={(e) =>
                                handleImportChange(
                                  index,
                                  "constructor",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-1 rounded text-sm font-mono"
                              style={{
                                backgroundColor:
                                  defaultTheme.colors.background.tertiary,
                                color: defaultTheme.colors.text.primary,
                                border: `1px solid ${errors[`import_${index}_constructor`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Show available methods count */}
                        {imp.functions && imp.functions.length > 0 && (
                          <p
                            className="text-xs"
                            style={{ color: defaultTheme.colors.accents.green }}
                          >
                            ✓ Found {imp.functions.length} methods in this POM
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {formData.imports.length === 0 && (
                  <p
                    className="text-sm text-center py-4"
                    style={{ color: defaultTheme.colors.text.secondary }}
                  >
                    No screen objects added. Click "+ Add Import" to add one.
                  </p>
                )}
              </div>

{/* Action Steps */}
<div>
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <label
        className="text-sm font-semibold"
        style={{ color: defaultTheme.colors.text.primary }}
      >
        🎬 Action Steps ({formData.steps.length})
      </label>
      {formData.steps.length > 1 && (
        <span 
          className="text-xs px-2 py-1 rounded"
          style={{ 
            background: `${defaultTheme.colors.accents.blue}20`,
            color: defaultTheme.colors.accents.blue 
          }}
        >
          ⋮⋮ Drag to reorder
        </span>
      )}
    </div>
    <button
      type="button"
      onClick={handleAddStep}
      className="px-3 py-1 rounded text-sm font-semibold transition"
      style={{
        backgroundColor: defaultTheme.colors.accents.blue,
        color: "white",
      }}
    >
      + Add Step
    </button>
  </div>

  {/* Steps List with Drag & Drop */}
  {formData.steps.length > 0 ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleStepDragStart}
      onDragEnd={handleStepDragEnd}
      onDragCancel={handleStepDragCancel}
    >
      <SortableContext
        items={formData.steps.map((s, i) => s.id || `step-${i}`)}
        strategy={verticalListSortingStrategy}
      >
        {formData.steps.map((step, index) => (
          <SortableStep
            key={step.id || `step-${index}`}
            step={{ ...step, onRemove: () => handleRemoveStep(index) }}
            stepIndex={index}
            theme={defaultTheme}
          >
            {/* Step Type Selector */}
            <div className="mb-3">
              <label
                className="text-xs block mb-1"
                style={{ color: defaultTheme.colors.text.secondary }}
              >
                Step Type
              </label>
              <div className="flex flex-wrap gap-2">
                {STEP_TYPES.map((typeOption) => (
                  <button
                    key={typeOption.value}
                    type="button"
                    onClick={() => handleStepChange(index, 'type', typeOption.value)}
                    className="px-3 py-1.5 rounded text-xs font-semibold transition"
                    style={{
                      backgroundColor: step.type === typeOption.value
                        ? defaultTheme.colors.accents.blue
                        : defaultTheme.colors.background.tertiary,
                      color: step.type === typeOption.value
                        ? 'white'
                        : defaultTheme.colors.text.secondary,
                      border: `1px solid ${step.type === typeOption.value 
                        ? defaultTheme.colors.accents.blue 
                        : defaultTheme.colors.border}`,
                    }}
                    title={typeOption.description}
                  >
                    {typeOption.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-2">
              <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                Description *
              </label>
              <input
                type="text"
                value={step.description}
                onChange={(e) => handleStepChange(index, "description", e.target.value)}
                placeholder={
                  step.type === 'click' ? "e.g., Click submit button" :
                  step.type === 'fill' ? "e.g., Enter search query" :
                  step.type === 'getText' ? "e.g., Get booking reference" :
                  step.type === 'waitFor' ? "e.g., Wait for results to load" :
                  step.type === 'custom' ? "e.g., Custom validation logic" :
                  "e.g., Fill search form"
                }
                className="w-full px-3 py-1 rounded text-sm"
                style={{
                  backgroundColor: defaultTheme.colors.background.tertiary,
                  color: defaultTheme.colors.text.primary,
                  border: `1px solid ${errors[`step_${index}_description`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                }}
              />
            </div>

            {/* POM METHOD TYPE */}
            {step.type === 'pom-method' && (
              <>
                <div className="mb-2">
                  <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                    Instance *
                  </label>
                  <select
                    value={step.instance}
                    onChange={(e) => handleStepInstanceSelect(index, e.target.value)}
                    className="w-full px-3 py-1 rounded text-sm"
                    style={{
                      backgroundColor: defaultTheme.colors.background.tertiary,
                      color: defaultTheme.colors.text.primary,
                      border: `1px solid ${defaultTheme.colors.border}`,
                    }}
                  >
                    <option value="">-- Select instance --</option>
                    {formData.imports.map((imp, i) => (
                      <option key={i} value={imp.varName}>
                        {imp.varName} ({imp.className})
                      </option>
                    ))}
                  </select>
                  {formData.imports.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: defaultTheme.colors.accents.yellow }}>
                      ⚠️ Add a Screen Object import first
                    </p>
                  )}
                </div>

                <div className="mb-2">
                  <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                    Method *
                  </label>
                  <select
                    value={step.signature || ""}
                    onChange={(e) => handleStepMethodSelect(index, e.target.value)}
                    disabled={!step.instance}
                    className="w-full px-3 py-1 rounded text-sm font-mono"
                    style={{
                      backgroundColor: defaultTheme.colors.background.tertiary,
                      color: defaultTheme.colors.text.primary,
                      border: `1px solid ${defaultTheme.colors.border}`,
                      opacity: !step.instance ? 0.5 : 1,
                    }}
                  >
                    <option value="">-- Select method --</option>
                    {step.availableMethods?.map((method, i) => (
                      <option key={i} value={method.signature}>
                        {method.signature}
                      </option>
                    ))}
                  </select>
                </div>

             {/* ✅ ENHANCED: Rich Arguments Section */}
{stepMethodInfos[index]?.parameters?.length > 0 ? (
  <div 
    className="mb-3 p-3 rounded space-y-3"
    style={{ 
      background: `${defaultTheme.colors.accents.cyan}10`,
      border: `1px solid ${defaultTheme.colors.accents.cyan}40`
    }}
  >
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: defaultTheme.colors.accents.cyan }}>
        📝 Arguments ({stepMethodInfos[index].parameters.length})
      </span>
      <span className="text-xs font-mono" style={{ color: defaultTheme.colors.text.tertiary }}>
        {step.signature}
      </span>
    </div>

    {stepMethodInfos[index].parameters.map((param, argIdx) => (
      <StepArgumentInput
        key={argIdx}
        param={param}
        value={step.args?.[argIdx] || ''}
        onChange={(val) => handleStepArgChange(index, argIdx, val)}
        theme={defaultTheme}
        storedVariables={allStoredVariables}
        testDataSchema={testDataSchema}
      />
    ))}
  </div>
) : (
  /* Fallback: simple text input for methods without discovered params */
  <div className="mb-2">
    <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
      Arguments
    </label>
    <input
      type="text"
      value={step.args?.join(", ") || ""}
      onChange={(e) => handleStepArgsChange(index, e.target.value)}
      placeholder="ctx.data.field1, ctx.data.field2"
      className="w-full px-3 py-1 rounded text-sm font-mono"
      style={{
        backgroundColor: defaultTheme.colors.background.tertiary,
        color: defaultTheme.colors.text.primary,
        border: `1px solid ${defaultTheme.colors.border}`,
      }}
    />
    {getAvailableVarsForStep(index).length > 0 && (
      <AvailableVariablesHint 
        availableVars={getAvailableVarsForStep(index)}
        onInsert={(variable) => handleInsertVariable(index, variable)}
      />
    )}
  </div>
)}
              </>
            )}

            {/* INLINE ACTION TYPES: click, fill, getText, waitFor */}
            {['click', 'fill', 'getText', 'waitFor'].includes(step.type) && (
              <>
             {/* Screen Object */}
<div className="mb-2">
  <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
    Screen Object *
  </label>
  <select
    value={step.screen || ""}
    onChange={(e) => {
      const selectedPOMName = e.target.value;
      handleStepChange(index, 'screen', selectedPOMName);
      handleStepChange(index, 'locator', '');
      
      // ✅ FIXED: Get LOCATORS (getters), not methods
      const selectedPOM = availablePOMs.find(p => p.className === selectedPOMName);
      const locators = [];
      
      if (selectedPOM?.classes) {
        for (const cls of selectedPOM.classes) {
          // Get getters (these are locators like btnSubmit, inputSearch)
          for (const getter of cls.getters || []) {
            locators.push(getter.name);
          }
          // Get properties (non-instance, like this.btn defined in constructor)
          for (const prop of cls.properties || []) {
            if (prop.type === 'property') {
              locators.push(prop.name);
            }
          }
        }
      }
      
      // Fallback: if no getters found, maybe this POM uses methods as locators
      if (locators.length === 0 && selectedPOM?.functions) {
        // Filter to only getter-like methods (start with get, btn, input, etc.)
        const locatorPatterns = /^(get|btn|input|link|label|text|card|modal|popup|dropdown|select|checkbox|radio|tab|menu|nav|header|footer|sidebar|icon|img|image|container|wrapper)/i;
        for (const fn of selectedPOM.functions) {
          if (locatorPatterns.test(fn.name) || fn.name.startsWith('get')) {
            locators.push(fn.name);
          }
        }
      }
      
      handleStepChange(index, 'availableLocators', locators);
    }}
    className="w-full px-3 py-1 rounded text-sm"
    style={{
      backgroundColor: defaultTheme.colors.background.tertiary,
      color: defaultTheme.colors.text.primary,
      border: `1px solid ${defaultTheme.colors.border}`,
    }}
  >
    <option value="">-- Select screen object --</option>
    {availablePOMs.map((pom, i) => (
      <option key={i} value={pom.className}>
        {pom.className}
      </option>
    ))}
  </select>
</div>

                <div className="mb-2">
                  <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                    Locator *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={step.locator || ""}
                      onChange={(e) => handleStepChange(index, 'locator', e.target.value)}
                      disabled={!step.screen}
                      className="flex-1 px-3 py-1 rounded text-sm font-mono"
                      style={{
                        backgroundColor: defaultTheme.colors.background.tertiary,
                        color: defaultTheme.colors.text.primary,
                        border: `1px solid ${defaultTheme.colors.border}`,
                        opacity: !step.screen ? 0.5 : 1,
                      }}
                    >
                      <option value="">-- Select --</option>
                      {(step.availableLocators || []).map((loc, i) => (
                        <option key={i} value={loc}>{loc}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={step.locator || ""}
                      onChange={(e) => handleStepChange(index, 'locator', e.target.value)}
                      placeholder="or type"
                      className="w-32 px-2 py-1 rounded text-sm font-mono"
                      style={{
                        backgroundColor: defaultTheme.colors.background.tertiary,
                        color: defaultTheme.colors.text.primary,
                        border: `1px solid ${defaultTheme.colors.border}`,
                      }}
                    />
                  </div>
                </div>

                {step.type === 'fill' && (
                  <div className="mb-2">
                    <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                      Value *
                    </label>
                    <input
                      type="text"
                      value={step.value || ""}
                      onChange={(e) => handleStepChange(index, 'value', e.target.value)}
                      placeholder="ctx.data.value or 'literal'"
                      className="w-full px-3 py-1 rounded text-sm font-mono"
                      style={{
                        backgroundColor: defaultTheme.colors.background.tertiary,
                        color: defaultTheme.colors.text.primary,
                        border: `1px solid ${defaultTheme.colors.border}`,
                      }}
                    />
                  </div>
                )}

                {step.type === 'waitFor' && (
                  <div className="mb-2">
                    <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                      Wait Until
                    </label>
                    <select
                      value={step.waitState || "visible"}
                      onChange={(e) => handleStepChange(index, 'waitState', e.target.value)}
                      className="w-full px-3 py-1 rounded text-sm"
                      style={{
                        backgroundColor: defaultTheme.colors.background.tertiary,
                        color: defaultTheme.colors.text.primary,
                        border: `1px solid ${defaultTheme.colors.border}`,
                      }}
                    >
                      <option value="visible">Visible</option>
                      <option value="hidden">Hidden</option>
                      <option value="attached">Attached</option>
                      <option value="detached">Detached</option>
                    </select>
                  </div>
                )}

               {/* ✅ Element Index Selector with Variable Support */}
<div className="mb-2">
  <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
    Element Index <span className="text-xs" style={{ color: defaultTheme.colors.text.tertiary }}>(for multiple elements)</span>
  </label>
  <div className="flex gap-2 items-center">
    <select
      value={step.elementIndex || ""}
      onChange={(e) => {
        handleStepChange(index, 'elementIndex', e.target.value);
        // Clear when switching away from custom/variable
        if (e.target.value !== 'custom' && e.target.value !== 'variable') {
          handleStepChange(index, 'customIndex', undefined);
          handleStepChange(index, 'indexVariable', undefined);
        }
      }}
      className="flex-1 px-3 py-1 rounded text-sm"
      style={{
        backgroundColor: defaultTheme.colors.background.tertiary,
        color: defaultTheme.colors.text.primary,
        border: `1px solid ${defaultTheme.colors.border}`,
      }}
    >
      <option value="">Single element (no index)</option>
      <option value="first">First [0] → .first()</option>
      <option value="last">Last → .last()</option>
      <option value="custom">Custom index → .nth(N)</option>
      <option value="variable">Variable → .nth(ctx.data.X)</option>
    </select>
    
    {/* Custom numeric index input */}
    {step.elementIndex === 'custom' && (
      <input
        type="number"
        min="0"
        value={step.customIndex || 0}
        onChange={(e) => handleStepChange(index, 'customIndex', parseInt(e.target.value) || 0)}
        placeholder="0"
        className="w-20 px-2 py-1 rounded text-sm font-mono"
        style={{
          backgroundColor: defaultTheme.colors.background.tertiary,
          color: defaultTheme.colors.text.primary,
          border: `1px solid ${defaultTheme.colors.border}`,
        }}
      />
    )}
    
{/* Variable selector for dynamic index */}
{step.elementIndex === 'variable' && (
  <div className="flex-1 flex gap-2">
    {/* Dropdown for quick selection */}
    <select
      value={step.indexVariable || ""}
      onChange={(e) => handleStepChange(index, 'indexVariable', e.target.value)}
      className="flex-1 px-3 py-1 rounded text-sm"
      style={{
        backgroundColor: defaultTheme.colors.background.tertiary,
        color: step.indexVariable ? defaultTheme.colors.accents.yellow : defaultTheme.colors.text.primary,
        border: `1px solid ${defaultTheme.colors.border}`,
      }}
    >
      <option value="">-- Quick select or type →</option>
      
      {/* Test Data Fields (ctx.data) */}
      {testDataSchema.length > 0 && (
        <optgroup label="📋 Test Data (ctx.data)">
          {testDataSchema.map((field, i) => {
            const fieldName = field.name || field;
            return (
              <option key={`data-${i}`} value={`ctx.data.${fieldName}`}>
                ctx.data.{fieldName}
              </option>
            );
          })}
        </optgroup>
      )}
      
      {/* Stored Variables from Previous Steps */}
      {allStoredVariables.length > 0 && (
        <optgroup label="💾 Stored Variables">
          {allStoredVariables.map((v, i) => (
            <option key={`stored-${i}`} value={`storedVars.${v.name}`}>
              storedVars.{v.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
    
    {/* Free text input for custom expressions */}
    <input
      type="text"
      value={step.indexVariable || ""}
      onChange={(e) => handleStepChange(index, 'indexVariable', e.target.value)}
      placeholder="ctx.data.cardIndex"
      className="flex-1 px-2 py-1 rounded text-sm font-mono"
      style={{
        backgroundColor: defaultTheme.colors.background.tertiary,
        color: defaultTheme.colors.accents.yellow,
        border: `1px solid ${defaultTheme.colors.accents.yellow}`,
      }}
    />
  </div>
)}
  </div>
  
  {step.elementIndex && (
    <p className="text-xs mt-1" style={{ color: defaultTheme.colors.accents.cyan }}>
      💡 Use when locator returns multiple elements (e.g., list items, cards)
    </p>
  )}
  
  {/* Variable index preview */}
  {step.elementIndex === 'variable' && step.indexVariable && (
    <div 
      className="text-xs mt-1 p-1.5 rounded font-mono"
      style={{ 
        backgroundColor: `${defaultTheme.colors.accents.yellow}15`,
        color: defaultTheme.colors.accents.yellow 
      }}
    >
      → .nth({step.indexVariable})
    </div>
  )}
</div>

               {/* Code Preview */}
<div 
  className="p-2 rounded text-xs font-mono"
  style={{ backgroundColor: defaultTheme.colors.background.primary }}
>
  <span style={{ color: defaultTheme.colors.accents.blue }}>await </span>
  <span style={{ color: defaultTheme.colors.accents.purple }}>
    {step.screen ? step.screen.charAt(0).toLowerCase() + step.screen.slice(1) : 'screen'}
  </span>
  <span>.</span>
  <span style={{ color: defaultTheme.colors.accents.green }}>{step.locator || 'locator'}</span>
  {/* Element index */}
  {/* Code Preview */}
{step.elementIndex && (
  <span style={{ color: defaultTheme.colors.accents.yellow }}>
    {step.elementIndex === 'first' ? '.first()' : 
     step.elementIndex === 'last' ? '.last()' : 
     step.elementIndex === 'custom' ? `.nth(${step.customIndex || 0})` :
     step.elementIndex === 'variable' ? `.nth(${step.indexVariable || 'ctx.data.index'})` :
     `.nth(${step.elementIndex})`}
  </span>
)}
  <span>.</span>
  <span style={{ color: defaultTheme.colors.accents.yellow }}>
    {step.type === 'click' && 'click()'}
    {step.type === 'fill' && `fill(${step.value || "'...'"} )`}
    {step.type === 'getText' && 'textContent()'}
    {step.type === 'waitFor' && `waitFor({ state: '${step.waitState}' })`}
  </span>
</div>
              </>
            )}

            {/* CUSTOM CODE TYPE */}
            {step.type === 'custom' && (
              <div className="mb-2">
                <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                  Custom Code *
                </label>
                <textarea
                  value={step.code || ""}
                  onChange={(e) => handleStepChange(index, 'code', e.target.value)}
                  placeholder="// Your custom code here"
                  rows={4}
                  className="w-full px-3 py-2 rounded text-sm font-mono"
                  style={{
                    backgroundColor: defaultTheme.colors.background.tertiary,
                    color: defaultTheme.colors.text.primary,
                    border: `1px solid ${defaultTheme.colors.border}`,
                    resize: 'vertical',
                  }}
                />
              </div>
            )}

            {/* Store As - Enhanced with Persistence Option */}
            {step.type !== 'custom' && (
              <div className="mt-3 space-y-2">
                <label className="text-xs" style={{ color: defaultTheme.colors.text.secondary }}>
                  💾 Store Result As
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={step.storeAs || ''}
                    onChange={(e) => handleStepChange(index, 'storeAs', e.target.value)}
                    placeholder="variableName"
                    className="flex-1 px-3 py-1 rounded text-sm font-mono"
                    style={{
                      backgroundColor: defaultTheme.colors.background.tertiary,
                      color: defaultTheme.colors.accents.yellow,
                      border: `1px solid ${defaultTheme.colors.border}`,
                    }}
                  />
                  {step.storeAs && (
                    <label 
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer whitespace-nowrap"
                      style={{ 
                        backgroundColor: step.persistStoreAs !== false 
                          ? `${defaultTheme.colors.accents.green}20` 
                          : defaultTheme.colors.background.tertiary,
                        border: `1px solid ${step.persistStoreAs !== false 
                          ? defaultTheme.colors.accents.green 
                          : defaultTheme.colors.border}`,
                        color: step.persistStoreAs !== false 
                          ? defaultTheme.colors.accents.green 
                          : defaultTheme.colors.text.tertiary
                      }}
                      title="If enabled, value persists to ctx.data and survives across test runs"
                    >
                      <input
                        type="checkbox"
                        checked={step.persistStoreAs !== false}
                        onChange={(e) => handleStepChange(index, 'persistStoreAs', e.target.checked)}
                        className="w-3 h-3"
                      />
                      Persist
                    </label>
                  )}
                </div>
                {step.storeAs && (
                  <div 
                    className="text-xs p-2 rounded space-y-1"
                    style={{ 
                      backgroundColor: `${defaultTheme.colors.accents.yellow}10`, 
                      color: defaultTheme.colors.accents.yellow 
                    }}
                  >
                    <div>✨ Access via: <code>{`{{${step.storeAs}}}`}</code></div>
                    {step.persistStoreAs !== false ? (
                      <div style={{ color: defaultTheme.colors.accents.green }}>
                        💾 Will persist to ctx.data (available in later tests)
                      </div>
                    ) : (
                      <div style={{ color: defaultTheme.colors.text.tertiary }}>
                        ⚡ Current test only (faster, no file write)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Step Conditions */}
            <StepConditions
              conditions={step.conditions}
              onChange={(newConditions) => handleStepConditionsChange(index, newConditions)}
              stepIndex={index}
              availableVariables={getAvailableVarsForStep(index)}
              storedVariables={allStoredVariables}
              testDataSchema={testDataSchema}
              requiresSuggestions={requiresSuggestions}
              theme={defaultTheme}
            />
          </SortableStep>
        ))}
      </SortableContext>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeStep ? (
          <StepDragOverlay step={activeStep} theme={defaultTheme} />
        ) : null}
      </DragOverlay>
    </DndContext>
  ) : (
    <p
      className="text-sm text-center py-4"
      style={{ color: defaultTheme.colors.text.secondary }}
    >
      No action steps added. Click "+ Add Step" to add one.
    </p>
  )}
</div>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: `${defaultTheme.colors.accents.red}20`,
                border: `1px solid ${defaultTheme.colors.accents.red}`,
              }}
            >
              <p style={{ color: defaultTheme.colors.accents.red }}>
                ❌ {errors.submit}
              </p>
            </div>
          )}

          {/* Actions */}
          <div
            className="flex gap-3 pt-4 border-t"
            style={{ borderColor: defaultTheme.colors.border }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 rounded-lg font-semibold transition flex-1"
              style={{
                backgroundColor: defaultTheme.colors.background.tertiary,
                color: defaultTheme.colors.text.primary,
                border: `1px solid ${defaultTheme.colors.border}`,
                opacity: loading ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-lg font-bold transition flex-1"
              style={{
                backgroundColor: loading
                  ? defaultTheme.colors.background.tertiary
                  : mode === 'edit' 
                    ? defaultTheme.colors.accents.blue
                    : defaultTheme.colors.accents.green,
                color: "white",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? `${submitIcon} Saving...` : submitLabel}
            </button>
          </div>
   
        </form>
      </div>
    </div>
    
  );
}

/**
 * StepArgumentInput - Rich argument input for transition steps
 */
function StepArgumentInput({ param, value, onChange, theme, storedVariables = [], testDataSchema = [] }) {
  const [useVariable, setUseVariable] = useState(
    value?.startsWith('ctx.') || value?.includes('{{') || false
  );

  // Update mode when value changes externally
  useEffect(() => {
    if (value) {
      setUseVariable(value.startsWith('ctx.') || value.includes('{{'));
    }
  }, [value]);

  // Build ctx.data suggestions from testDataSchema
  const ctxDataSuggestions = useMemo(() => {
    if (testDataSchema && testDataSchema.length > 0) {
      return testDataSchema.slice(0, 10).map(field => `ctx.data.${field.name || field}`);
    }
    return [
      'ctx.data.lang',
      'ctx.data.device',
      'ctx.data.searchType',
      'ctx.data.dateDepart',
      'ctx.data.destination'
    ];
  }, [testDataSchema]);

  return (
    <div 
      className="p-2 rounded space-y-2"
      style={{ background: theme.colors.background.secondary }}
    >
      {/* Parameter name & badges */}
      <div className="flex items-center gap-2">
        <span 
          className="font-mono text-sm font-bold"
          style={{ color: theme.colors.accents.cyan }}
        >
          {param.name}
        </span>
        {param.hasDefault ? (
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ 
              background: `${theme.colors.accents.blue}20`,
              color: theme.colors.accents.blue
            }}
          >
            optional
          </span>
        ) : (
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
            style={{ 
              background: `${theme.colors.accents.red}20`,
              color: theme.colors.accents.red
            }}
          >
            required
          </span>
        )}
      </div>

      {/* Default value hint */}
      {param.hasDefault && param.defaultValue !== undefined && (
        <div className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
          Default: <code className="px-1 rounded" style={{ background: theme.colors.background.tertiary }}>
            {JSON.stringify(param.defaultValue)}
          </code>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setUseVariable(false); onChange(''); }}
          className="flex-1 px-2 py-1 rounded text-xs font-semibold transition"
          style={{
            background: !useVariable ? theme.colors.accents.cyan : theme.colors.background.tertiary,
            color: !useVariable ? 'white' : theme.colors.text.tertiary
          }}
        >
          ✏️ Custom Value
        </button>
        <button
          type="button"
          onClick={() => { setUseVariable(true); onChange(''); }}
          className="flex-1 px-2 py-1 rounded text-xs font-semibold transition"
          style={{
            background: useVariable ? theme.colors.accents.yellow : theme.colors.background.tertiary,
            color: useVariable ? 'black' : theme.colors.text.tertiary
          }}
        >
          📦 Variable
        </button>
      </div>

      {/* Input based on mode */}
      {useVariable ? (
        <div className="space-y-2">
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ctx.data.field or {{variableName}}"
            className="w-full px-2 py-1.5 rounded text-sm font-mono"
            style={{
              background: theme.colors.background.primary,
              border: `1px solid ${theme.colors.accents.yellow}`,
              color: theme.colors.accents.yellow
            }}
          />
          
          {/* Variable suggestions */}
          <div className="space-y-1">
            {/* Stored variables from previous steps */}
            {storedVariables.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
                  💾 Stored:
                </span>
                {storedVariables.slice(0, 5).map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onChange(`{{${v.path || v.name}}}`)}
                    className="px-1.5 py-0.5 rounded font-mono text-[10px] transition hover:brightness-110"
                    style={{ 
                      background: `${theme.colors.accents.yellow}30`,
                      color: theme.colors.accents.yellow
                    }}
                  >
                    {`{{${v.path || v.name}}}`}
                  </button>
                ))}
              </div>
            )}
            
            {/* Common ctx.data fields */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px]" style={{ color: theme.colors.text.tertiary }}>
                📋 ctx.data:
              </span>
              {ctxDataSuggestions.map((field, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange(field)}
                  className="px-1.5 py-0.5 rounded font-mono text-[10px] transition hover:brightness-110"
                  style={{ 
                    background: `${theme.colors.accents.blue}20`,
                    color: theme.colors.accents.blue
                  }}
                >
                  {field}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.hasDefault ? `Leave empty for default` : `Enter ${param.name}...`}
          className="w-full px-2 py-1.5 rounded text-sm"
          style={{
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary
          }}
        />
      )}

      {/* Preview */}
      {value && (
        <div 
          className="text-[10px] p-1 rounded font-mono"
          style={{ background: theme.colors.background.tertiary, color: theme.colors.accents.green }}
        >
          → {value.startsWith('ctx.') || value.includes('{{') ? value : `"${value}"`}
        </div>
      )}
    </div>
  );
}