const CompositionBuilder = ({ onCompose }) => {
  const [selectedBehaviors, setSelectedBehaviors] = useState([]);
  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedScreens, setSelectedScreens] = useState({});
  
  return (
    <div className="composition-builder">
      <h3>Compose Behaviors</h3>
      
      {/* Step 1: Select behavior classes to compose */}
      <div className="behavior-selection">
        <label>Include Behaviors:</label>
        <MultiSelect
          options={[
            { value: 'NotificationsImplications', label: 'Notifications' },
            { value: 'UndoImplications', label: 'Undo' },
            { value: 'AuditLogImplications', label: 'Audit Log' }
          ]}
          value={selectedBehaviors}
          onChange={setSelectedBehaviors}
        />
      </div>
      
      {/* Step 2: Select base class to extend */}
      <div className="base-selection">
        <label>Extend Base Class:</label>
        <Select
          options={[
            { value: 'BaseBookingImplications', label: 'Base Booking' },
            { value: 'BaseEventImplications', label: 'Base Event' }
          ]}
          value={selectedBase}
          onChange={setSelectedBase}
        />
      </div>
      
      {/* Step 3: Select screens to include/override */}
      {selectedBase && (
        <div className="screen-selection">
          <label>Screens:</label>
          {baseScreens.map(screen => (
            <div key={screen.key}>
              <Checkbox
                checked={selectedScreens[screen.key]?.include}
                onChange={(e) => handleScreenToggle(screen.key, 'include', e.target.checked)}
              />
              <span>{screen.key}</span>
              
              {selectedScreens[screen.key]?.include && (
                <div className="override-options">
                  <Checkbox
                    label="Override visible/hidden"
                    checked={selectedScreens[screen.key]?.override}
                    onChange={(e) => handleScreenToggle(screen.key, 'override', e.target.checked)}
                  />
                  
                  {selectedScreens[screen.key]?.override && (
                    <div>
                      <TagInput
                        label="Visible:"
                        value={selectedScreens[screen.key]?.visible || []}
                        onChange={(tags) => handleScreenUpdate(screen.key, 'visible', tags)}
                      />
                      <TagInput
                        label="Hidden:"
                        value={selectedScreens[screen.key]?.hidden || []}
                        onChange={(tags) => handleScreenUpdate(screen.key, 'hidden', tags)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <button onClick={() => onCompose({
        behaviors: selectedBehaviors,
        base: selectedBase,
        screens: selectedScreens
      })}>
        Generate Implication
      </button>
    </div>
  );
};