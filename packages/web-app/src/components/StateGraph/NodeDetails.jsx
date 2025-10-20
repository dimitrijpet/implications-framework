export default function NodeDetails({ node }) {
  if (!node) {
    return (
      <div style={{ padding: '20px', color: '#64748B' }}>
        <p>Select a state to view details</p>
      </div>
    );
  }
  
  const metadata = node.metadata || {};
  
  return (
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1E293B' }}>
        {node.label}
      </h2>
      
      <div style={{ marginBottom: '20px' }}>
        <span style={{ 
          display: 'inline-block',
          padding: '4px 12px',
          backgroundColor: node.pattern === 'booking' ? '#DBEAFE' : '#D1FAE5',
          color: node.pattern === 'booking' ? '#1E40AF' : '#065F46',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          {node.pattern || 'custom'}
        </span>
      </div>
      
      <Section title="Class Info">
        <InfoRow label="Class Name" value={metadata.className || 'N/A'} />
        <InfoRow label="Stateful" value={metadata.isStateful ? 'Yes' : 'No'} />
        <InfoRow label="Has XState Config" value={metadata.hasXStateConfig ? 'Yes' : 'No'} />
        <InfoRow label="Has mirrorsOn" value={metadata.hasMirrorsOn ? 'Yes' : 'No'} />
      </Section>
      
      {metadata.staticProperties && metadata.staticProperties.length > 0 && (
        <Section title="Static Properties">
          <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
            {metadata.staticProperties.map((prop, i) => (
              <li key={i} style={{ color: '#475569', fontSize: '14px', marginBottom: '4px' }}>
                {prop}
              </li>
            ))}
          </ul>
        </Section>
      )}
      
      {metadata.staticMethods && metadata.staticMethods.length > 0 && (
        <Section title="Static Methods">
          <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
            {metadata.staticMethods.map((method, i) => (
              <li key={i} style={{ color: '#475569', fontSize: '14px', marginBottom: '4px' }}>
                {method}()
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ 
        fontSize: '16px', 
        fontWeight: '600', 
        marginBottom: '12px',
        color: '#334155',
        borderBottom: '2px solid #E2E8F0',
        paddingBottom: '8px',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid #F1F5F9',
    }}>
      <span style={{ color: '#64748B', fontSize: '14px' }}>{label}:</span>
      <span style={{ color: '#1E293B', fontSize: '14px', fontWeight: '500' }}>{value}</span>
    </div>
  );
}