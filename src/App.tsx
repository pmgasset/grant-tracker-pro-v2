import { useState } from 'react';

function App() {
  const [message] = useState('Grant Tracker Pro is loading...');

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#1f2937', marginBottom: '1rem' }}>
          🎯 Grant Tracker Pro
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          {message}
        </p>
        <div style={{
          padding: '1rem',
          backgroundColor: '#dbeafe',
          borderRadius: '4px',
          color: '#1e40af'
        }}>
          ✅ React app is working!<br/>
          ✅ Deployed to Cloudflare Pages<br/>
          ✅ Ready for full features
        </div>
      </div>
    </div>
  );
}

export default App;