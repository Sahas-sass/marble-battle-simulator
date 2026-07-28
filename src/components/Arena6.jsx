import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena6() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  const raceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // --- STATE ---
  const [activeTeams, setActiveTeams] = useState(5); 
  const [marbleCount, setMarbleCount] = useState(1);
  const [teamColors, setTeamColors] = useState(['#00ff87', '#ff0055', '#ffeb3b', '#00d2ff', '#b700ff']); 
  const [gameStatus, setGameStatus] = useState('idle');
  const [ballCounts, setBallCounts] = useState([0, 0, 0, 0, 0]); 
  const [timeLeft, setTimeLeft] = useState(30);

  // --- REFS ---
  const countsRef = useRef([0, 0, 0, 0, 0]);
  const timeRef = useRef(30);
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(5);
  const teamColorsRef = useRef(teamColors);
  const preGameTimeRef = useRef(5);
  const fireworksRef = useRef([]); 

  const width = 540;
  const height = 960;
  const center = { x: width / 2, y: height / 2 };

  const changeStatus = (newStatus) => {
    statusRef.current = newStatus;
    setGameStatus(newStatus);
  };

  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { teamColorsRef.current = teamColors; }, [teamColors]);
  useEffect(() => { countsRef.current = ballCounts; }, [ballCounts]);
  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    const { Engine, Render, Runner, Bodies, Composite, Events, Body, Vector } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 0; 
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { 
        width, 
        height, 
        wireframes: false, 
        background: '#07080e', // Sleek dark aesthetic
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    // Build Circular Arena Bounds
    const arenaRadius = 245; 
    const segments = 100; 
    const boundaryBodies = [];

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      boundaryBodies.push(
        Bodies.rectangle(
          center.x + Math.cos(angle) * arenaRadius,
          center.y + Math.sin(angle) * arenaRadius,
          22, 8,
          { 
            isStatic: true, 
            angle: angle, 
            friction: 0, 
            restitution: 1.0, 
            label: 'arena_wall',
            render: { fillStyle: '#ffffff' } 
          }
        )
      );
    }
    Composite.add(engine.world, boundaryBodies);

    // MUTATION MECHANIC: Smooth duplication with overlap buffering
    Events.on(engine, 'collisionStart', (event) => {
      if (statusRef.current !== 'running') return;
      const now = Date.now();
      const bodiesToSpawn = [];
      
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const wall = bodyA.label === 'arena_wall' ? bodyA : (bodyB.label === 'arena_wall' ? bodyB : null);
        const marble = bodyA.label.startsWith('team_') ? bodyA : (bodyB.label.startsWith('team_') ? bodyB : null);
        
        if (wall && marble) {
          // Division Cooldown
          if (now - (marble.lastDivisionTime || 0) < 300) return; 
          marble.lastDivisionTime = now;

          const teamIndex = parseInt(marble.label.split('_')[1], 10);
          
          // Entity Limit Cap (Prevent FPS Crash)
          const totalCurrentBalls = countsRef.current.reduce((a, b) => a + b, 0);
          if (totalCurrentBalls >= 200) return;

          // 🛡️ THE FIX: Spawn with buffering to prevent overlap explosion
          // Calculate vector Sub(TargetCenter, CollisionPoint)
          const normalVector = Vector.normalise(Vector.sub(center, marble.position));
          
          // Spawn clone tangential to marble + small buffer space
          const cloneX = marble.position.x + (normalVector.x * 25);
          const cloneY = marble.position.y + (normalVector.y * 25);

          const cloneBall = Bodies.circle(cloneX, cloneY, 10, {
            restitution: 1.01, // Smooth, non-accelerating bounce
            friction: 0,
            frictionAir: 0,
            label: `team_${teamIndex}`,
            render: { fillStyle: teamColorsRef.current[teamIndex] }
          });
          
          // Split trajectories inward
          Body.setVelocity(marble, Vector.mult(normalVector, 5));
          Body.setVelocity(cloneBall, { 
            x: normalVector.x * 6 + (Math.random() - 0.5) * 2, 
            y: normalVector.y * 6 + (Math.random() - 0.5) * 2 
          });
          cloneBall.lastDivisionTime = now;
          bodiesToSpawn.push(cloneBall);

          // Update number tracker
          const currentCounts = [...countsRef.current];
          currentCounts[teamIndex]++;
          countsRef.current = currentCounts;
          setBallCounts(currentCounts);
        }
      });

      if (bodiesToSpawn.length > 0) {
        Composite.add(engine.world, bodiesToSpawn);
      }
    });

    // Speed clamping hook to keep movement smooth
    Events.on(engine, 'beforeUpdate', () => {
      if (statusRef.current !== 'running') return;
      const allBodies = Composite.allBodies(engine.world);
      allBodies.forEach(b => {
        if (b.label && b.label.startsWith('team_')) {
          const speed = Vector.magnitude(b.velocity);
          if (speed < 4) {
            const multiplier = 4 / (speed || 1);
            Body.setVelocity(b, { x: b.velocity.x * multiplier, y: b.velocity.y * multiplier });
          } else if (speed > 10) {
            const multiplier = 10 / speed;
            Body.setVelocity(b, { x: b.velocity.x * multiplier, y: b.velocity.y * multiplier });
          }
        }
      });
    });

    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const colors = teamColorsRef.current;
      const active = activeTeamsRef.current;

      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(7, 8, 14, 0.95)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        
        if (t > 3) {
          ctx.font = 'bold 36px Inter';
          ctx.fillText('MULTIPLICATION GAUNTLET', width / 2, height / 2 - 160);
          ctx.font = 'bold 20px Inter';
          ctx.fillStyle = '#00d2ff';
          ctx.fillText('Hit walls to multiply nodes!', width / 2, height / 2 - 110);

          ctx.font = 'bold 28px Inter';
          for (let i = 0; i < active; i++) {
            const yPos = height / 2 - 30 + (i * 55);
            ctx.beginPath();
            ctx.arc(width / 2 - 100, yPos - 10, 16, 0, Math.PI * 2);
            ctx.fillStyle = colors[i];
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(`Team ${i + 1}`, width / 2 - 60, yPos);
          }
        } else if (t > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 150px Inter';
          ctx.fillText(t, width / 2, height / 2 + 50);
        }
      }

      if (currentStatus === 'running' || currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(7, 8, 14, 0.85)';
        ctx.fillRect(0, 0, width, 85);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px Inter';
        ctx.fillText(`⚔️ SIMULATION: ${timeRef.current}s`, width / 2, 58);

        ctx.fillStyle = 'rgba(7, 8, 14, 0.85)';
        ctx.fillRect(0, height - 90, width, 90);
        ctx.font = 'bold 22px Inter';
        const spacing = width / (active + 1);

        for (let i = 0; i < active; i++) {
          const xPos = spacing * (i + 1);
          const yPos = height - 40;
          ctx.beginPath();
          ctx.arc(xPos - 22, yPos - 8, 12, 0, Math.PI * 2);
          ctx.fillStyle = colors[i];
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(`${countsRef.current[i]}`, xPos - 2, yPos);
        }
      }

      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(7, 8, 14, 0.95)';
        ctx.fillRect(0, 0, width, height);
        const maxScore = Math.max(...countsRef.current.slice(0, active));
        const winnerIndex = countsRef.current.indexOf(maxScore);
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 46px Inter';
        ctx.fillStyle = colors[winnerIndex];
        ctx.fillText(`🏆 TEAM ${winnerIndex + 1} CLONED MAX!`, width / 2, height / 2 - 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Inter';
        ctx.fillText(`Final Count: ${maxScore} Nodes`, width / 2, height / 2 + 30);

        fireworksRef.current.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
          ctx.fillStyle = p.color;
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.15; 
          p.size *= 0.96; 
        });
        fireworksRef.current = fireworksRef.current.filter(p => p.size > 0.5);
      }
    });

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    return () => {
      Render.stop(render);
      if (render.canvas) render.canvas.remove();
      if (runnerRef.current) Runner.stop(runnerRef.current);
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

  const startRecordingSequence = () => {
    const initialCounts = Array(5).fill(0);
    for(let i = 0; i < activeTeams; i++) initialCounts[i] = marbleCount;
    setBallCounts(initialCounts);
    countsRef.current = initialCounts;

    setTimeLeft(30);
    fireworksRef.current = [];
    preGameTimeRef.current = 5; 
    changeStatus('countdown');

    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    allBodies.filter(b => !b.isStatic).forEach(b => Composite.remove(engineRef.current.world, b));

    const canvas = sceneRef.current.querySelector('canvas');
    const stream = canvas.captureStream(60);
    
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recordedChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mutation-Battle-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;

    countdownTimerRef.current = setInterval(() => {
      preGameTimeRef.current -= 1;
      if (preGameTimeRef.current <= 0) {
        clearInterval(countdownTimerRef.current);
        changeStatus('running');
        spawnSurvivalMarbles();
        
        raceTimerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              endMatch();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }, 1000);
  };

  const spawnSurvivalMarbles = () => {
    const { Composite, Bodies, Body } = Matter;
    const newBodies = [];
    
    for (let t = 0; t < activeTeamsRef.current; t++) {
      for (let m = 0; m < marbleCount; m++) {
        const marble = Bodies.circle(center.x + (Math.random() * 40 - 20), center.y + (Math.random() * 40 - 20), 10, {
          restitution: 1.01,
          friction: 0,
          frictionAir: 0,
          label: `team_${t}`,
          render: { fillStyle: teamColorsRef.current[t] }
        });
        
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);
  };

  const endMatch = () => {
    clearInterval(raceTimerRef.current);
    changeStatus('finished');

    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    allBodies.filter(b => !b.isStatic).forEach(b => Composite.remove(engineRef.current.world, b));

    const maxScore = Math.max(...countsRef.current.slice(0, activeTeamsRef.current));
    const winIdx = countsRef.current.indexOf(maxScore);
    const winColor = teamColorsRef.current[winIdx];

    const particles = [];
    for(let i = 0; i < 250; i++) {
      particles.push({
        x: width / 2, y: height / 2,
        vx: (Math.random() - 0.5) * 35, 
        vy: (Math.random() - 0.5) * 35 - 5,
        size: Math.random() * 6 + 2,
        color: Math.random() > 0.4 ? winColor : '#ffffff'
      });
    }
    fireworksRef.current = particles;

    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      changeStatus('idle');
    }, 4000);
  };

  let btnText = '⚡ Run Sequence 🔴🎬';
  if (gameStatus === 'countdown') btnText = 'Locking Grid... ⏳';
  if (gameStatus === 'running') btnText = 'Nodes division... ⏱️';
  if (gameStatus === 'finished') btnText = 'Saving Video... 🎆';

  return (
    <div className="arena-inner-container">
      <div className="luxury-sidebar">
        <h2 style={{ fontSize: '1.4rem', letterSpacing: '2px', fontWeight: '800', marginBottom: '20px' }}>
          DIVISIONS
        </h2>

        <div className="luxury-control-card">
          <label>ACTIVE PARTICIPANTS: {activeTeams}</label>
          <input type="range" min="2" max="5" value={activeTeams} disabled={gameStatus !== 'idle'} onChange={(e) => setActiveTeams(Number(e.target.value))} />
        </div>

        <div className="luxury-control-card">
          <label>STARTING NODES: {marbleCount}</label>
          <input type="range" min="1" max="5" value={marbleCount} disabled={gameStatus !== 'idle'} onChange={(e) => setMarbleCount(Number(e.target.value))} />
        </div>

        <div className="color-selectors" style={{ flexWrap: 'wrap', gap: '12px' }}>
          {Array.from({ length: activeTeams }).map((_, idx) => (
            <div className="color-picker-row" key={idx} style={{ flex: '1 1 45%' }}>
              <input type="color" value={teamColors[idx]} disabled={gameStatus !== 'idle'} onChange={(e) => updateTeamColor(idx, e.target.value)} />
              <label>Squad {idx + 1}</label>
            </div>
          ))}
        </div>

        <button 
          className={`btn-action ${gameStatus === 'idle' ? 'btn-record' : 'btn-secondary'}`} 
          onClick={startRecordingSequence}
          disabled={gameStatus !== 'idle'}
        >
          {btnText}
        </button>
      </div>

      <div className="simulation-viewport">
        {/* Strictly sizes the wrapper so layout flexbox never breaks the canvas */}
        <div className="canvas-frame-container" ref={sceneRef} style={{ width: '540px', height: '960px', backgroundColor: '#07080e', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }} />
      </div>
    </div>
  );
}