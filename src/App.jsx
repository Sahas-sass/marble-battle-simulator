import { useState } from 'react';
import Arena1 from './components/Arena'; 
import Arena2 from './components/Arena2'; 
import Arena3 from './components/Arena3'; 
import Arena4 from './components/Arena4'; 
import Arena5 from './components/Arena5'; // Import the new arena
import './App.css';

export default function App() {
  const [currentArena, setCurrentArena] = useState('circle');

  return (
    <div className="main-layout">
      <div className="arena-nav">
        <button className={`nav-btn ${currentArena === 'circle' ? 'active' : ''}`} onClick={() => setCurrentArena('circle')}>⭕ Circle</button>
        <button className={`nav-btn ${currentArena === 'plinko' ? 'active' : ''}`} onClick={() => setCurrentArena('plinko')}>🔺 Plinko</button>
        <button className={`nav-btn ${currentArena === 'survival' ? 'active' : ''}`} onClick={() => setCurrentArena('survival')}>🔵 Survival</button>
        <button className={`nav-btn ${currentArena === 'obstacle' ? 'active' : ''}`} onClick={() => setCurrentArena('obstacle')}>🏁 Obstacle</button>
        <button className={`nav-btn ${currentArena === 'hyper' ? 'active' : ''}`} onClick={() => setCurrentArena('hyper')}>🏎️ Hyper GP</button>
      </div>

      <div className="arena-content">
        {currentArena === 'circle' && <Arena1 />}
        {currentArena === 'plinko' && <Arena2 />}
        {currentArena === 'survival' && <Arena3 />}
        {currentArena === 'obstacle' && <Arena4 />}
        {currentArena === 'hyper' && <Arena5 />}
      </div>
    </div>
  );
}