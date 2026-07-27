import { useState } from 'react';
import Arena1 from './components/Arena'; // Your existing circle game
import Arena2 from './components/Arena2'; // The new Plinko game
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
          ⭕ Circle Arena
        </button>
        <button 
          className={`nav-btn ${currentArena === 'plinko' ? 'active' : ''}`}
          onClick={() => setCurrentArena('plinko')}
        >
          🔺 Plinko Arena
        </button>
      </div>

      {/* Render selected arena */}
      <div className="arena-content">
        {currentArena === 'circle' ? <Arena1 /> : <Arena2 />}
      </div>
    </div>
  );
}

export default App;