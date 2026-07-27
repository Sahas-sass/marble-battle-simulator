import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  // Timers
  const raceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // --- STATE ---
  const [activeTeams, setActiveTeams] = useState(2);
  const [marbleCount, setMarbleCount] = useState(1);
  const [teamColors, setTeamColors] = useState(['#00ff87', '#ff0055', '#00d2ff', '#ffb700', '#b700ff']);
  
  const [gameStatus, setGameStatus] = useState('idle'); // 'idle' | 'countdown' | 'running' | 'finished'
  const [scores, setScores] = useState([0, 0, 0, 0, 0]);
  const [timeLeft, setTimeLeft] = useState(30);

  // --- REFS FOR RENDER LOOP ---
  const scoresRef = useRef([0, 0, 0, 0, 0]);
  const timeRef = useRef(30);
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(2);
  const teamColorsRef = useRef(teamColors);
  const preGameTimeRef = useRef(4); // 4 = Select Team, 3-2-1 = Countdown
  const fireworksRef = useRef([]); // Holds firework particles

  const width = 540;
  const height = 960;

  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { teamColorsRef.current = teamColors; }, [teamColors]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { statusRef.current = gameStatus; }, [gameStatus]);

  useEffect(() => {
    const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 0;
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { width, height, wireframes: false, background: '#12131c' }
    });
    renderRef.current = render;

    // Build Circular Arena
    const arenaRadius = 255;
    const center = { x: width / 2, y: height / 2 };
    const segments = 72;
    const boundaryBodies = [];

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      boundaryBodies.push(
        Bodies.rectangle(
          center.x + Math.cos(angle) * arenaRadius,
          center.y + Math.sin(angle) * arenaRadius,
          26, 6,
          { isStatic: true, angle: angle, friction: 0, frictionStatic: 0, render: { fillStyle: '#ffffff' } }
        )
      );
    }
    Composite.add(engine.world, boundaryBodies);

    // Collision Scoring (with Anti-Stick Debounce)
    Events.on(engine, 'collisionStart', (event) => {
      if (statusRef.current !== 'running') return;
      
      const now = Date.now();
      
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.isStatic || bodyB.isStatic) {
          const marble = bodyA.isStatic ? bodyB : bodyA;
          
          if (marble.label.startsWith('team_')) {
            // Anti-Stick Fix: 150ms debounce so dragging against wall doesn't spam points
            if (now - (marble.lastHitTime || 0) < 150) return;
            marble.lastHitTime = now;

            const teamIndex = parseInt(marble.label.split('_')[1], 10);
            const newScores = [...scoresRef.current];
            newScores[teamIndex]++;
            scoresRef.current = newScores;
            setScores(newScores);

            // Small force repelling marble slightly toward center to prevent wall rolling
            Body.applyForce(marble, marble.position, {
              x: (center.x - marble.position.x) * 0.00003,
              y: (center.y - marble.position.y) * 0.00003
            });
          }
        }
      });
    });

    // --- DRAW CUSTOM UI & FIREWORKS ON VIDEO CANVAS ---
    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const colors = teamColorsRef.current;

      // 1. Draw Countdown
      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        if (t > 3) {
          ctx.font = 'bold 45px Inter';
          ctx.fillText('SELECT A TEAM!', width / 2, height / 2);
        } else if (t > 0) {
          ctx.font = 'bold 120px Inter';
          ctx.fillText(t, width / 2, height / 2 + 30);
        }
      }

      // 2. Draw Timer & Scoreboard
      if (currentStatus === 'running' || currentStatus === 'finished') {
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px Inter';
        ctx.fillText(`⏱️ ${timeRef.current}s`, width / 2, 60);

        ctx.textAlign = 'left';
        ctx.font = 'bold 22px Inter';
        for (let i = 0; i < activeTeamsRef.current; i++) {
          ctx.fillStyle = colors[i];
          ctx.fillText(`Team ${i + 1}: ${scoresRef.current[i]}`, 30, 50 + (i * 35));
        }
      }

      // 3. Draw Winner Screen & Fireworks
      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, width, height);
        
        const maxScore = Math.max(...scoresRef.current.slice(0, activeTeamsRef.current));
        const winnerIndex = scoresRef.current.indexOf(maxScore);

        ctx.textAlign = 'center';
        ctx.font = 'bold 50px Inter';
        ctx.fillStyle = colors[winnerIndex];
        ctx.fillText(`🏆 TEAM ${winnerIndex + 1} WINS!`, width / 2, height / 2 - 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Inter';
        ctx.fillText(`Score: ${maxScore}`, width / 2, height / 2 + 30);

        // Render Fireworks Physics
        fireworksRef.current.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
          ctx.fillStyle = p.color;
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2; // Gravity for fireworks
          p.size *= 0.95; // Fade out
        });
        fireworksRef.current = fireworksRef.current.filter(p => p.size > 0.5);
      }
    });

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    return () => {
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(engine.world);
      Engine.clear(engine);
      clearInterval(raceTimerRef.current);
      clearInterval(countdownTimerRef.current);
    };
  }, []);

  const updateTeamColor = (index, color) => {
    const newColors = [...teamColors];
    newColors[index] = color;
    setTeamColors(newColors);
  };

  // --- GAMEPLAY SEQUENCE ---
  const startRecordingSequence = () => {
    // 1. Reset everything
    setScores([0, 0, 0, 0, 0]);
    scoresRef.current = [0, 0, 0, 0, 0];
    setTimeLeft(30);
    fireworksRef.current = [];
    preGameTimeRef.current = 5; // 5 -> 4(Select) -> 3,2,1
    setGameStatus('countdown');

    // Clear old marbles
    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    allBodies.filter(b => !b.isStatic).forEach(b => Composite.remove(engineRef.current.world, b));

    // 2. Start Video Recorder Early
    const canvas = sceneRef.current.querySelector('canvas');
    const stream = canvas.captureStream(60);
    const mimeTypes = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9'];
    const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/mp4';
    
    const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
    recordedChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Marble-Battle-${Date.now()}.${selectedMimeType.includes('mp4') ? 'mp4' : 'webm'}`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;

    // 3. Countdown Loop
    countdownTimerRef.current = setInterval(() => {
      preGameTimeRef.current -= 1;
      
      if (preGameTimeRef.current <= 0) {
        clearInterval(countdownTimerRef.current);
        setGameStatus('running');
        dropMarbles();
        
        // 4. Start 30s Race Timer
        raceTimerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              endRace();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }, 1000);
  };

  const dropMarbles = () => {
    const { Composite, Bodies, Body } = Matter;
    const center = { x: width / 2, y: height / 2 };
    const newBodies = [];
    
    for (let t = 0; t < activeTeams; t++) {
      for (let m = 0; m < marbleCount; m++) {
        const marble = Bodies.circle(center.x + (Math.random() * 40 - 20), center.y + (Math.random() * 40 - 20), 12, {
          restitution: 1.05, // Extra bouncy
          friction: 0, 
          frictionStatic: 0,
          frictionAir: 0,
          label: `team_${t}`,
          render: { fillStyle: teamColors[t] }
        });
        
        Body.setVelocity(marble, { 
          x: (Math.random() - 0.5) * 16, 
          y: (Math.random() - 0.5) * 16 
        });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);
  };

  const endRace = () => {
    clearInterval(raceTimerRef.current);
    setGameStatus('finished');

    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    allBodies.filter(b => !b.isStatic).forEach(b => Composite.remove(engineRef.current.world, b));

    // Create Fireworks
    const maxScore = Math.max(...scoresRef.current.slice(0, activeTeamsRef.current));
    const winIdx = scoresRef.current.indexOf(maxScore);
    const winColor = teamColorsRef.current[winIdx];

    const particles = [];
    for(let i = 0; i < 200; i++) {
      particles.push({
        x: width / 2, y: height / 2,
        vx: (Math.random() - 0.5) * 30, // Explosive burst
        vy: (Math.random() - 0.5) * 30 - 5,
        size: Math.random() * 6 + 2,
        color: Math.random() > 0.5 ? winColor : '#ffffff'
      });
    }
    fireworksRef.current = particles;

    // Wait 4 seconds for fireworks to finish, then stop recording
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setGameStatus('idle');
    }, 4000);
  };

  // UI Button logic
  let btnText = 'Start Video Sequence 🔴🎬';
  if (gameStatus === 'countdown') btnText = 'Counting Down... ⏳';
  if (gameStatus === 'running') btnText = 'Race in Progress... ⏱️';
  if (gameStatus === 'finished') btnText = 'Generating Winner Screen... 🎆';

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>⚔️ Battle Simulator</h2>

        <div className="control-group">
          <label>Number of Teams: {activeTeams}</label>
          <input type="range" min="2" max="5" value={activeTeams} disabled={gameStatus !== 'idle'} onChange={(e) => setActiveTeams(Number(e.target.value))} />
        </div>

        <div className="control-group">
          <label>Marbles Per Team: {marbleCount}</label>
          <input type="range" min="1" max="10" value={marbleCount} disabled={gameStatus !== 'idle'} onChange={(e) => setMarbleCount(Number(e.target.value))} />
        </div>

        <div className="color-selectors" style={{ flexWrap: 'wrap', gap: '10px' }}>
          {Array.from({ length: activeTeams }).map((_, idx) => (
            <div className="color-picker" key={idx} style={{ flex: '1 1 45%' }}>
              <label>Team {idx + 1}</label>
              <input type="color" value={teamColors[idx]} disabled={gameStatus !== 'idle'} onChange={(e) => updateTeamColor(idx, e.target.value)} />
            </div>
          ))}
        </div>

        <button 
          className={`btn ${gameStatus === 'idle' ? 'btn-record' : 'btn-secondary'}`} 
          onClick={startRecordingSequence}
          disabled={gameStatus !== 'idle'}
          style={{ marginTop: '20px' }}
        >
          {btnText}
        </button>

      </div>
      <div className="stage-wrapper"><div className="canvas-container" ref={sceneRef} /></div>
    </div>
  );
}