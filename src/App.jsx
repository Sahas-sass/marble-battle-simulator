import { useState } from 'react';
import Arena1 from './components/Arena'; 
import Arena2 from './components/Arena2'; 
import Arena3 from './components/Arena3'; 
import Arena4 from './components/Arena4'; 
import Arena5 from './components/Arena5'; 
import Arena6 from './components/Arena6'; 
import Arena7 from './components/Arena7'; 
import Arena8 from './components/Arena8'; 
import Arena9 from './components/Arena9'; 
import Arena10 from './components/Arena10'; // ⚡ Mega Hyper Track
import './App.css';

export default function App() {
  const [currentArena, setCurrentArena] = useState('circle');

  return (
    <div className="main-layout">
      {/* 🧭 Upgraded Two-Row Responsive Navigation Dashboard */}
      <div className="arena-nav-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '15px', background: '#0a0d14', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        
        {/* ROW 1: Classic Vertical Races */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className={`nav-btn ${currentArena === 'circle' ? 'active' : ''}`} onClick={() => setCurrentArena('circle')}>⭕ Circle</button>
          <button className={`nav-btn ${currentArena === 'plinko' ? 'active' : ''}`} onClick={() => setCurrentArena('plinko')}>🔺 Plinko</button>
          <button className={`nav-btn ${currentArena === 'survival' ? 'active' : ''}`} onClick={() => setCurrentArena('survival')}>🔵 Survival</button>
          <button className={`nav-btn ${currentArena === 'obstacle' ? 'active' : ''}`} onClick={() => setCurrentArena('obstacle')}>🏁 Obstacle</button>
          <button className={`nav-btn ${currentArena === 'hyper' ? 'active' : ''}`} onClick={() => setCurrentArena('hyper')}>🏎️ Hyper GP</button>
          <button className={`nav-btn ${currentArena === 'division' ? 'active' : ''}`} onClick={() => setCurrentArena('division')}>🧬 Division</button>
        </div>

        {/* ROW 2: Advanced & Custom Mega Arenas */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className={`nav-btn ${currentArena === 'dozer' ? 'active' : ''}`} onClick={() => setCurrentArena('dozer')}>🪙 Dozer Cascade</button>
          <button className={`nav-btn ${currentArena === 'bridge' ? 'active' : ''}`} onClick={() => setCurrentArena('bridge')}> bridge structure test</button>
          <button className={`nav-btn ${currentArena === 'tournament' ? 'active' : ''}`} onClick={() => setCurrentArena('tournament')}>🏆 Tournament (16:9)</button>
          <button className={`nav-btn ${currentArena === 'megahyper' ? 'active' : ''}`} onClick={() => setCurrentArena('megahyper')}>⚡ Mega Hyper (Long Track)</button>
        </div>

      </div>

      {/* 🏎️ Active Viewport Render Area */}
      <div className="arena-content" style={{ paddingTop: '10px' }}>
        {currentArena === 'circle' && <Arena1 />}
        {currentArena === 'plinko' && <Arena2 />}
        {currentArena === 'survival' && <Arena3 />}
        {currentArena === 'obstacle' && <Arena4 />}
        {currentArena === 'hyper' && <Arena5 />}
        {currentArena === 'division' && <Arena6 />}
        {currentArena === 'dozer' && <Arena7 />}
        {currentArena === 'bridge' && <Arena8 />}
        {currentArena === 'tournament' && <Arena9 />}
        {currentArena === 'megahyper' && <Arena10 />}
      </div>
    </div>
  );
}