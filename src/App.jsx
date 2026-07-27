import { useState } from 'react';
import Arena1 from './components/Arena'; 
import Arena2 from './components/Arena2'; 
import Arena3 from './components/Arena3'; 
import Arena4 from './components/Arena4'; // Import Arena 4
import './App.css';

function App() {
  const [currentArena, setCurrentArena] = useState('circle');

  return (
    <div className="main-layout">
      <div className="arena-nav">
        <button className={`nav-btn ${currentArena === 'circle' ? 'active' : ''}`} onClick={() => setCurrentArena('circle')}>⭕ Circle</button>
        <button className={`nav-btn ${currentArena === 'plinko' ? 'active' : ''}`} onClick={() => setCurrentArena('plinko')}>🔺 Plinko</button>
        <button className={`nav-btn ${currentArena === 'hexagon' ? 'active' : ''}`} onClick={() => setCurrentArena('hexagon')}>🔵 Survival</button>
        <button className={`nav-btn ${currentArena === 'race' ? 'active' : ''}`} onClick={() => setCurrentArena('race')}>🏁 Obstacle</button>
      </div>

      <div className="arena-content">
        {currentArena === 'circle' && <Arena1 />}
        {currentArena === 'plinko' && <Arena2 />}
        {currentArena === 'hexagon' && <Arena3 />}
        {currentArena === 'race' && <Arena4 />}
      </div>
    </div>
  );
}

export default App;