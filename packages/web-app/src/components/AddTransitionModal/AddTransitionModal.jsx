// packages/web-app/src/components/AddTransitionModal/AddTransitionModal.jsx
// ✨ ENHANCED VERSION v2.0
// Features: Edit Mode, Platform-Filtered Navigation, POM Discovery, Smart Args

import { useState, useEffect } from "react";
import { defaultTheme } from "../../config/visualizerTheme";
import { getCachedPOMs, getCachedNavigation, filterPOMsByPlatform, clearCache } from '../../cache/pomCache';
import { getRequiresSuggestions, getKnownKeys } from '../../utils/requiresColors.js';

const API_URL = "http://localhost:3000";

export default function AddTransitionModal({
  isOpen,
  onClose,
  onSubmit,
  sourceState,
  targetState,
  projectPath,
  mode = 'create',           // ✅ NEW: 'create' | 'edit'
  initialData = null,        // ✅ NEW: For edit mode
  availablePlatforms = ["web"],  // ✅ NEW - from config
}) {
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
});

const [requiresSuggestions, setRequiresSuggestions] = useState([]);

// Load suggestions when modal opens
useEffect(() => {
  if (isOpen) {
    setRequiresSuggestions(getRequiresSuggestions());
  }
}, [isOpen]);

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

 // ═══════════════════════════════════════════════════════════════════════════
// EDIT MODE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
useEffect(() => {
  if (mode === 'edit' && initialData && isOpen) {
    console.log('📝 Edit mode - initializing form with:', initialData);
    
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
    // ✅ Clear cache when opening in create mode
    // clearCache();
    
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
const fetchAvailablePOMs = async () => {
  console.log('🔍 fetchAvailablePOMs called, platform:', formData.platform);
  setLoadingPOMs(true);
  try {
    const response = await fetch(
      `${API_URL}/api/poms?projectPath=${encodeURIComponent(projectPath)}`
    );
    if (response.ok) {
      const data = await response.json();
      console.log('📦 Raw POMs from API:', data.poms?.length);

      // ✅ FIXED: Extract ALL classes from each POM file
      const transformedPOMs = [];
      
      for (const pom of data.poms) {
        if (pom.classes && pom.classes.length > 0) {
          // ✅ Loop through ALL classes in the file
          for (const classData of pom.classes) {
            transformedPOMs.push({
              name: classData.name,
              className: classData.name,
              path: pom.path,
              filePath: pom.path,
              classes: [classData],  // ✅ Include just this class
              functions: classData.functions || []
            });
          }
        }
      }

      console.log('📦 Total classes extracted:', transformedPOMs.length);

      const filteredPOMs = filterPOMsByPlatform(transformedPOMs, formData.platform);
console.log('✅ Filtered POMs:', filteredPOMs.length);
console.log('🎯 First 5 POMs:', filteredPOMs.slice(0, 5).map(p => ({
  name: p.className,
  path: p.path
})));
      console.log('✅ Filtered POMs:', filteredPOMs.length);
      
      setAvailablePOMs(filteredPOMs);
    }
  } catch (error) {
    console.error("Failed to fetch POMs:", error);
    setAvailablePOMs([]);
  } finally {
    setLoadingPOMs(false);
  }
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

const filterPOMsByPlatform = (poms, platform) => {
  console.log(`🔍 Filtering ${poms.length} POMs for platform: ${platform}`);
  
  if (!platform || platform === 'web') {
    // For web: include POMs that are NOT in mobile-specific folders
    const filtered = poms.filter(pom => {
      const path = (pom.filePath || pom.path || '').toLowerCase();
      
      // Exclude mobile-specific paths
      const isMobile = path.includes('/dancer/') || 
                       path.includes('/manager/') ||
                       path.includes('/android/') ||
                       path.includes('/ios/') ||
                       path.includes('/mobile/');
      
      return !isMobile;  // Include everything that's NOT mobile
    });
    
    console.log(`   ✅ Found ${filtered.length} POMs for web (non-mobile)`);
    return filtered;
  }
  
  // For specific mobile platforms
  const filtered = poms.filter(pom => {
    const path = (pom.filePath || pom.path || '').toLowerCase();
    
    if (platform === 'dancer') {
      return path.includes('/dancer/');
    } else if (platform === 'manager') {
      return path.includes('/manager/');
    }
    
    return false;
  });
  
  console.log(`   ✅ Found ${filtered.length} POMs for ${platform}`);
  return filtered;
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
          description: "",
          instance: "",
          method: "",
          args: [],
          availableMethods: [],
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
  const handleStepMethodSelect = (stepIndex, methodSignature) => {
    const match = methodSignature.match(/^([^(]+)\(([^)]*)\)/);

    if (match) {
      const methodName = match[1];
      const paramsStr = match[2];
      const params = paramsStr ? paramsStr.split(",").map((p) => p.trim()) : [];

      setFormData((prev) => ({
        ...prev,
        steps: prev.steps.map((step, i) =>
          i === stepIndex
            ? {
                ...step,
                method: methodName,
                signature: methodSignature,
                args: params.map((p) => {
                  const paramName = p.split("=")[0].trim();
                  return `ctx.data.${paramName}`;
                }),
              }
            : step
        ),
      }));
    }
  };

  // Update step field
  const handleStepChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step
      ),
    }));
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
        if (!step.description.trim()) {
          newErrors[`step_${index}_description`] =
            "Step description is required";
        }
        if (!step.instance.trim()) {
          newErrors[`step_${index}_instance`] = "Instance name is required";
        }
        if (!step.method.trim()) {
          newErrors[`step_${index}_method`] = "Method name is required";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
const handleSubmit = async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  setLoading(true);

  try {
const submitData = {
      event: formData.event.trim(),
      platform: formData.platform,
      requires: Object.keys(formData.requires || {}).length > 0 ? formData.requires : undefined,
      actionDetails: formData.hasActionDetails
        ? {
            description: formData.description.trim(),
            platform: formData.platform,
            navigationMethod: formData.navigationMethod || null,
            navigationFile: formData.navigationFile || null,
            imports: formData.imports.map((imp) => ({
              className: imp.className,
              varName: imp.varName,
              path: imp.path,
              constructor: imp.constructor,
            })),
            steps: formData.steps.map((step) => ({
              description: step.description,
              instance: step.instance,
              method: step.method,
              args: step.args.join(', '),
              argsArray: step.args,
              storeAs: step.storeAs || undefined,
            })),
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
        className="relative w-full max-w-4xl mx-4 my-8 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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


          {/* Requires Section - Conditional Path */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '18px' }}>🔒</span>
              <label
                className="text-sm font-semibold"
                style={{ color: defaultTheme.colors.text.primary }}
              >
                Requires (Conditional Path)
              </label>
            </div>
            
            <p
              className="text-xs"
              style={{ color: defaultTheme.colors.text.tertiary }}
            >
              Set conditions that must be met in testData for this transition to be selected.
              Leave empty for the default path.
            </p>
            
            {/* Existing requires conditions */}
            {Object.keys(formData.requires).length > 0 && (
              <div className="space-y-2">
                {Object.entries(formData.requires).map(([key, value]) => (
                  <div 
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ 
                      backgroundColor: `${defaultTheme.colors.accents.purple}15`,
                      border: `1px solid ${defaultTheme.colors.accents.purple}40`
                    }}
                  >
                    <span 
                      className="font-mono text-sm px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: defaultTheme.colors.background.tertiary,
                        color: defaultTheme.colors.accents.purple 
                      }}
                    >
                      {key}
                    </span>
                    <span style={{ color: defaultTheme.colors.text.tertiary }}>=</span>
                    <span 
                      className="font-mono text-sm px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: defaultTheme.colors.background.tertiary,
                        color: typeof value === 'boolean' 
                          ? (value ? defaultTheme.colors.accents.green : defaultTheme.colors.accents.red)
                          : defaultTheme.colors.accents.blue
                      }}
                    >
                      {typeof value === 'boolean' ? (value ? 'true' : 'false') : JSON.stringify(value)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => {
                          const updated = { ...prev.requires };
                          delete updated[key];
                          return { ...prev, requires: updated };
                        });
                      }}
                      className="ml-auto px-2 py-1 rounded text-sm transition hover:brightness-110"
                      style={{ 
                        backgroundColor: `${defaultTheme.colors.accents.red}20`,
                        color: defaultTheme.colors.accents.red 
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new requires condition */}
            <div 
              className="p-3 rounded-lg space-y-3"
              style={{ 
                backgroundColor: defaultTheme.colors.background.tertiary,
                border: `1px solid ${defaultTheme.colors.border}`
              }}
            >

              {/* Quick suggestions */}
{requiresSuggestions.length > 0 && (
  <div className="mb-2">
    <label
      className="text-xs mb-1 block"
      style={{ color: defaultTheme.colors.text.tertiary }}
    >
      Quick add from previously used:
    </label>
    <div className="flex flex-wrap gap-2">
      {requiresSuggestions
        .filter(s => !formData.requires[s.key]) // Don't show already added
        .slice(0, 6) // Limit to 6
        .map((suggestion, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setFormData(prev => ({
                ...prev,
                requires: {
                  ...prev.requires,
                  [suggestion.key]: suggestion.value
                }
              }));
            }}
            className="px-2 py-1 rounded text-xs font-mono transition hover:brightness-110"
            style={{
              backgroundColor: suggestion.color,
              color: '#fff'
            }}
          >
            {suggestion.label}
          </button>
        ))}
    </div>
  </div>
)}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRequiresKey}
                  onChange={(e) => setNewRequiresKey(e.target.value)}
                  placeholder="Field (e.g., no_agency)"
                  className="flex-1 px-3 py-2 rounded text-sm font-mono"
                  style={{
                    backgroundColor: defaultTheme.colors.background.secondary,
                    color: defaultTheme.colors.text.primary,
                    border: `1px solid ${defaultTheme.colors.border}`,
                  }}
                />
                
                <select
                  value={newRequiresValueType}
                  onChange={(e) => {
                    setNewRequiresValueType(e.target.value);
                    if (e.target.value === 'boolean') {
                      setNewRequiresValue('true');
                    } else {
                      setNewRequiresValue('');
                    }
                  }}
                  className="px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: defaultTheme.colors.background.secondary,
                    color: defaultTheme.colors.text.primary,
                    border: `1px solid ${defaultTheme.colors.border}`,
                  }}
                >
                  <option value="boolean">Boolean</option>
                  <option value="string">String</option>
                  <option value="number">Number</option>
                </select>
                
                {newRequiresValueType === 'boolean' ? (
                  <select
                    value={newRequiresValue || 'true'}
                    onChange={(e) => setNewRequiresValue(e.target.value)}
                    className="px-3 py-2 rounded text-sm"
                    style={{
                      backgroundColor: defaultTheme.colors.background.secondary,
                      color: defaultTheme.colors.text.primary,
                      border: `1px solid ${defaultTheme.colors.border}`,
                    }}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={newRequiresValueType === 'number' ? 'number' : 'text'}
                    value={newRequiresValue}
                    onChange={(e) => setNewRequiresValue(e.target.value)}
                    placeholder={newRequiresValueType === 'number' ? '0' : 'value'}
                    className="w-32 px-3 py-2 rounded text-sm"
                    style={{
                      backgroundColor: defaultTheme.colors.background.secondary,
                      color: defaultTheme.colors.text.primary,
                      border: `1px solid ${defaultTheme.colors.border}`,
                    }}
                  />
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    if (newRequiresKey.trim()) {
                      let parsedValue;
                      if (newRequiresValueType === 'boolean') {
                        parsedValue = newRequiresValue === 'true';
                      } else if (newRequiresValueType === 'number') {
                        parsedValue = Number(newRequiresValue) || 0;
                      } else {
                        parsedValue = newRequiresValue || '';
                      }
                      
                      setFormData(prev => ({
                        ...prev,
                        requires: {
                          ...prev.requires,
                          [newRequiresKey.trim()]: parsedValue
                        }
                      }));
                      
                      setNewRequiresKey('');
                      setNewRequiresValue('true');
                    }
                  }}
                  disabled={!newRequiresKey.trim()}
                  className="px-4 py-2 rounded text-sm font-semibold transition"
                  style={{
                    backgroundColor: newRequiresKey.trim() 
                      ? defaultTheme.colors.accents.purple 
                      : defaultTheme.colors.background.tertiary,
                    color: newRequiresKey.trim() ? 'white' : defaultTheme.colors.text.tertiary,
                    opacity: newRequiresKey.trim() ? 1 : 0.5,
                  }}
                >
                  + Add
                </button>
              </div>
              
              <p
                className="text-xs"
                style={{ color: defaultTheme.colors.text.tertiary }}
              >
                💡 Examples: <code className="px-1 rounded" style={{ backgroundColor: defaultTheme.colors.background.secondary }}>no_agency: true</code>, 
                <code className="px-1 rounded ml-1" style={{ backgroundColor: defaultTheme.colors.background.secondary }}>booking_type: "group"</code>
              </p>
            </div>
            
            {Object.keys(formData.requires).length === 0 ? (
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded"
                style={{ 
                  backgroundColor: `${defaultTheme.colors.accents.green}10`,
                  border: `1px solid ${defaultTheme.colors.accents.green}30`
                }}
              >
                <span>✓</span>
                <span className="text-xs" style={{ color: defaultTheme.colors.accents.green }}>
                  Default path - no conditions required
                </span>
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded"
                style={{ 
                  backgroundColor: `${defaultTheme.colors.accents.purple}10`,
                  border: `1px solid ${defaultTheme.colors.accents.purple}30`
                }}
              >
                <span>🔀</span>
                <span className="text-xs" style={{ color: defaultTheme.colors.accents.purple }}>
                  Conditional path - TestPlanner will select this when {Object.keys(formData.requires).length} condition(s) match
                </span>
              </div>
            )}
          </div>

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
                  <label
                    className="text-sm font-semibold"
                    style={{ color: defaultTheme.colors.text.primary }}
                  >
                    🎬 Action Steps
                  </label>
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

                {/* Steps List */}
                {formData.steps.map((step, index) => (
                  <div
                    key={index}
                    className="p-3 rounded mb-3"
                    style={{
                      backgroundColor: defaultTheme.colors.background.secondary,
                      border: `1px solid ${defaultTheme.colors.border}`,
                    }}
                  >
                    {/* Step Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: defaultTheme.colors.text.secondary }}
                      >
                        Step #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(index)}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor:
                            defaultTheme.colors.accents.red + "20",
                          color: defaultTheme.colors.accents.red,
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    {/* Description */}
                    <div className="mb-2">
                      <label
                        className="text-xs"
                        style={{ color: defaultTheme.colors.text.secondary }}
                      >
                        Description *
                      </label>
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) =>
                          handleStepChange(index, "description", e.target.value)
                        }
                        placeholder="e.g., Fill search form"
                        className="w-full px-3 py-1 rounded text-sm"
                        style={{
                          backgroundColor:
                            defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${errors[`step_${index}_description`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                        }}
                      />
                    </div>

                    {/* Instance */}
                    <div className="mb-2">
                      <label
                        className="text-xs"
                        style={{ color: defaultTheme.colors.text.secondary }}
                      >
                        Instance *
                      </label>
                      <select
                        value={step.instance}
                        onChange={(e) =>
                          handleStepInstanceSelect(index, e.target.value)
                        }
                        className="w-full px-3 py-1 rounded text-sm"
                        style={{
                          backgroundColor:
                            defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${errors[`step_${index}_instance`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                        }}
                      >
                        <option value="">-- Select instance --</option>
                        {formData.imports.map((imp, i) => (
                          <option key={i} value={imp.varName}>
                            {imp.varName} ({imp.className})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Method with Signature */}
                    <div className="mb-2">
                      <label
                        className="text-xs"
                        style={{ color: defaultTheme.colors.text.secondary }}
                      >
                        Method * (with signature)
                      </label>
                      <select
                        value={step.signature || ""}
                        onChange={(e) =>
                          handleStepMethodSelect(index, e.target.value)
                        }
                        disabled={!step.instance}
                        className="w-full px-3 py-1 rounded text-sm font-mono"
                        style={{
                          backgroundColor:
                            defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${errors[`step_${index}_method`] ? defaultTheme.colors.accents.red : defaultTheme.colors.border}`,
                          opacity: !step.instance ? 0.5 : 1,
                        }}
                      >
                        <option value="">-- Select method --</option>
                        {step.availableMethods &&
                          step.availableMethods.map((method, i) => (
                            <option key={i} value={method.signature}>
                              {method.signature}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Args Input with Smart Validation */}
                    <div>
                      <label
                        className="text-xs"
                        style={{ color: defaultTheme.colors.text.secondary }}
                      >
                        Arguments (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={step.args.join(", ")}
                        onChange={(e) =>
                          handleStepArgsChange(index, e.target.value)
                        }
                        placeholder="ctx.data.field1, ctx.data.field2 || defaultValue"
                        className="w-full px-3 py-1 rounded text-sm font-mono"
                        style={{
                          backgroundColor:
                            defaultTheme.colors.background.tertiary,
                          color: defaultTheme.colors.text.primary,
                          border: `1px solid ${defaultTheme.colors.border}`,
                        }}
                      />

                      {/* Helper Text */}
                      <div
                        className="text-xs mt-1"
                        style={{ color: defaultTheme.colors.text.tertiary }}
                      >
                        💡 Use{" "}
                        <code
                          className="px-1 rounded"
                          style={{
                            backgroundColor:
                              defaultTheme.colors.background.secondary,
                          }}
                        >
                          ||
                        </code>{" "}
                        for defaults, not{" "}
                        <code
                          className="px-1 rounded"
                          style={{
                            backgroundColor:
                              defaultTheme.colors.background.secondary,
                          }}
                        >
                          =
                        </code>
                      </div>

                      {/* Live Warning */}
                      {step.args.some((arg) => arg.includes(" = ")) && (
                        <div
                          className="text-xs mt-2 px-2 py-1 rounded flex items-center gap-2"
                          style={{
                            backgroundColor:
                              defaultTheme.colors.accents.yellow + "20",
                            color: defaultTheme.colors.accents.yellow,
                            border: `1px solid ${defaultTheme.colors.accents.yellow}`,
                          }}
                        >
                          <span>⚠️</span>
                          <span>
                            Args will be auto-converted to use ||
                          </span>
                        </div>
                      )}
                    </div>

                  {/* ✅ NEW: StoreAs Input */}
<div className="mt-3">
  <label
    className="text-xs"
    style={{ color: defaultTheme.colors.text.secondary }}
  >
    💾 Store Result As (optional)
  </label>
  <input
    type="text"
    value={step.storeAs || ''}
    onChange={(e) => {
      const newSteps = [...formData.steps];
      newSteps[index] = { ...step, storeAs: e.target.value };
      setFormData({ ...formData, steps: newSteps });
    }}
    placeholder="e.g., flightData, bookingResult"
    className="w-full px-3 py-1 rounded text-sm font-mono"
    style={{
      backgroundColor: defaultTheme.colors.background.tertiary,
      color: defaultTheme.colors.accents.yellow,
      border: `1px solid ${defaultTheme.colors.border}`,
    }}
  />
  
  {step.storeAs && (
    <div
      className="text-xs mt-1 p-2 rounded"
      style={{ 
        backgroundColor: `${defaultTheme.colors.accents.yellow}10`,
        color: defaultTheme.colors.accents.yellow,
        border: `1px solid ${defaultTheme.colors.accents.yellow}30`
      }}
    >
      ✨ Access in validations: <code className="px-1 rounded" style={{ backgroundColor: defaultTheme.colors.background.secondary }}>{`{{${step.storeAs}}}`}</code> or <code className="px-1 rounded" style={{ backgroundColor: defaultTheme.colors.background.secondary }}>{`{{${step.storeAs}.propertyName}}`}</code>
    </div>
  )}
</div>
                  </div>
                ))}

                {formData.steps.length === 0 && (
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