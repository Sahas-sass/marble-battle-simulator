import { useState } from 'react';
import Arena1 from './components/Arena'; 
import Arena2 from './components/Arena2'; 
import Arena3 from './components/Arena3'; 
import Arena4 from './components/Arena4'; 
import Arena5 from './components/Arena5'; 
import Arena6 from './components/Arena6'; 
import Arena7 from './components/Arena7'; 
import Arena8 from './components/Arena8'; 
import Arena9 from './components/Arena9'; // 🏆 TOURNAMENT 16:9
import './App.css';

export default function App() {
  const [currentArena, setCurrentArena] = useState('circle');

  return (
    <div className="main-layout">
      {/* 🧭 Top Navigation Dashboard */}
      <div className="arena-nav">
        <button className={`nav-btn ${currentArena === 'circle' ? 'active' : ''}`} onClick={() => setCurrentArena('circle')}>⭕ Circle</button>
        <button className={`nav-btn ${currentArena === 'plinko' ? 'active' : ''}`} onClick={() => setCurrentArena('plinko')}>🔺 Plinko</button>
        <button className={`nav-btn ${currentArena === 'survival' ? 'active' : ''}`} onClick={() => setCurrentArena('survival')}>🔵 Survival</button>
        <button className={`nav-btn ${currentArena === 'obstacle' ? 'active' : ''}`} onClick={() => setCurrentArena('obstacle')}>🏁 Obstacle</button>
        <button className={`nav-btn ${currentArena === 'hyper' ? 'active' : ''}`} onClick={() => setCurrentArena('hyper')}>🏎️ Hyper GP</button>
        <button className={`nav-btn ${currentArena === 'division' ? 'active' : ''}`} onClick={() => setCurrentArena('division')}>🧬 Division</button>
        <button className={`nav-btn ${currentArena === 'dozer' ? 'active' : ''}`} onClick={() => setCurrentArena('dozer')}>🪙 Dozer</button>
        <button className={`nav-btn ${currentArena === 'bridge' ? 'active' : ''}`} onClick={() => setCurrentArena('bridge')}>🏗️ Bridge</button>
        <button className={`nav-btn ${currentArena === 'tournament' ? 'active' : ''}`} onClick={() => setCurrentArena('tournament')}>🏆 Tournament (16:9)</button>
      </div>

      <div className="arena-content">
        {currentArena === 'circle' && <Arena1 />}
        {currentArena === 'plinko' && <Arena2 />}
        {currentArena === 'survival' && <Arena3 />}
        {currentArena === 'obstacle' && <Arena4 />}
        {currentArena === 'hyper' && <Arena5 />}
        {currentArena === 'division' && <Arena6 />}
        {currentArena === 'dozer' && <Arena7 />}
        {currentArena === 'bridge' && <Arena8 />}
        {currentArena === 'tournament' && <Arena9 />}
      </div>
    </div>
  );
}