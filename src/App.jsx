import { useState } from 'react';
import Arena1 from './components/Arena'; 
import Arena2 from './components/Arena2'; 
import Arena3 from './components/Arena3'; // The new Hexagon Escape
import './App.css';

function App() {
  const [currentArena, setCurrentArena] = useState('circle');

  return (
    <div className="main-layout">
      {/* Top Navigation Hub */}
      <div className="arena-nav">
        <button 
          className={`nav-btn ${currentArena === 'circle' ? 'active' : ''}`}
          onClick={() => setCurrentArena('circle')}
        >
          ⭕ Circle
        </button>
        <button 
          className={`nav-btn ${currentArena === 'plinko' ? 'active' : ''}`}
          onClick={() => setCurrentArena('plinko')}
        >
          🔺 Plinko
        </button>
        <button 
          className={`nav-btn ${currentArena === 'hexagon' ? 'active' : ''}`}
          onClick={() => setCurrentArena('hexagon')}
        >
          ⬡ Hexagon
        </button>
      </div>

      {/* Render selected arena */}
      <div className="arena-content">
        {currentArena === 'circle' && <Arena1 />}
        {currentArena === 'plinko' && <Arena2 />}
        {currentArena === 'hexagon' && <Arena3 />}
      </div>
    </div>
  );
}

export default App;