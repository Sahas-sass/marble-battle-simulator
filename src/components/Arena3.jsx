import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena3() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  const countdownTimerRef = useRef(null);
  const maxMatchTimerRef = useRef(null);

  // --- STATE ---
  const [activeTeams, setActiveTeams] = useState(5);
  const [marbleCount, setMarbleCount] = useState(2); 
  const [teamColors, setTeamColors] = useState(['#00ff87', '#ff0055', '#ffeb3b', '#00d2ff', '#b700ff']);
  const [gameStatus, setGameStatus] = useState('idle');
  const [aliveCounts, setAliveCounts] = useState([2, 2, 2, 2, 2]);
  const [timeLeft, setTimeLeft] = useState(40); 

  // --- REFS ---
  const aliveRef = useRef([2, 2, 2, 2, 2]);
  const timeRef = useRef(40);
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(5);
  const teamColorsRef = useRef(teamColors);
  const preGameTimeRef = useRef(5);
  const fireworksRef = useRef([]);
  const ringsRef = useRef([]); 

  const width = 540;
  const height = 960;
  const center = { x: width / 2, y: height / 2 };

  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { teamColorsRef.current = teamColors; }, [teamColors]);
  useEffect(() => { statusRef.current = gameStatus; }, [gameStatus]);
  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (!sceneRef.current) return;

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
        background: '#12131c' 
      }
    });
    renderRef.current = render;

    const buildArena = () => {
      if (!engineRef.current) return;
      
      ringsRef.current.forEach(ring => {
        if (ring && ring.composite) {
          Composite.remove(engineRef.current.world, ring.composite);
        }
      });
      ringsRef.current = [];

      // ⚙️ SPEED TWEAK: Slowed down the ring rotation slightly
      const ringConfigs = [
        { id: 0, radius: 140, speed: 0.008, color: '#ffffff', dots: 45 }, 
        { id: 1, radius: 220, speed: -0.006, color: '#00d2ff', dots: 70 } 
      ];

      ringConfigs.forEach((config) => {
        const ringComposite = Composite.create();

        for (let i = 0; i < config.dots; i++) {
          const angle = i * ((Math.PI * 2) / config.dots);
          const x = center.x + config.radius * Math.cos(angle);
          const y = center.y + config.radius * Math.sin(angle);

          const dot = Bodies.circle(x, y, 7, {
            isStatic: true,
            friction: 0,
            restitution: 1.1, 
            label: 'fragile_dot', 
            ringId: config.id, 
            render: { fillStyle: config.color }
          });
          Composite.add(ringComposite, dot);
        }
        Composite.add(engineRef.current.world, ringComposite);
        ringsRef.current.push({ id: config.id, composite: ringComposite, speed: config.speed });
      });
    };

    buildArena();

    Events.on(engine, 'beforeUpdate', () => {
      if (statusRef.current !== 'running') return;

      ringsRef.current.forEach(ring => {
        if (ring && ring.composite) {
          Composite.rotate(ring.composite, ring.speed, center);
        }
      });

      const allBodies = Composite.allBodies(engine.world);
      
      allBodies.forEach(b => {
        if (b && b.label && b.label.startsWith('team_')) {
          const speed = Vector.magnitude(b.velocity);
          
          // ⚙️ SPEED TWEAK: Strict speed limit clamp (min 4, max 10)
          if (speed < 4) {
            const multiplier = 4 / (speed || 1);
            Body.setVelocity(b, { x: b.velocity.x * multiplier, y: b.velocity.y * multiplier });
          } else if (speed > 10) {
            const multiplier = 10 / speed;
            Body.setVelocity(b, { x: b.velocity.x * multiplier, y: b.velocity.y * multiplier });
          }

          const dist = Vector.magnitude({ x: b.position.x - center.x, y: b.position.y - center.y });
          if (dist > 260 && !b.isDead) {
            b.isDead = true;
            Composite.remove(engine.world, b);
            
            const teamIndex = parseInt(b.label.split('_')[1], 10);
            const newAlive = [...aliveRef.current];
            if (newAlive[teamIndex] > 0) newAlive[teamIndex] -= 1;
            aliveRef.current = newAlive;
            setAliveCounts(newAlive);

            const teamsStillAlive = newAlive.filter(count => count > 0).length;
            if (teamsStillAlive <= 1) endMatch();
          }
        }
      });
    });

    Events.on(engine, 'collisionStart', (event) => {
      if (statusRef.current !== 'running') return;

      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const dot = bodyA.label === 'fragile_dot' ? bodyA : (bodyB.label === 'fragile_dot' ? bodyB : null);

        if (dot && engineRef.current) {
          const targetRing = ringsRef.current.find(r => r.id === dot.ringId);
          if (targetRing && targetRing.composite) {
            Composite.remove(targetRing.composite, dot);
          }
        }
      });
    });

    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const colors = teamColorsRef.current;
      const active = activeTeamsRef.current;

      if (currentStatus === 'idle') {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px Inter';
        ctx.fillText("READY FOR SURVIVAL", width / 2, 50);
      }

      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        
        if (t > 3) {
          ctx.font = 'bold 45px Inter';
          ctx.fillText('PICK YOUR TEAM!', width / 2, height / 2 - 160);
          ctx.font = 'bold 24px Inter';
          ctx.fillStyle = '#00d2ff';
          ctx.fillText('Last Team Standing Wins.', width / 2, height / 2 - 120);

          ctx.font = 'bold 30px Inter';
          for (let i = 0; i < active; i++) {
            const yPos = height / 2 - 40 + (i * 55);
            ctx.beginPath();
            ctx.arc(width / 2 - 80, yPos - 10, 16, 0, Math.PI * 2);
            ctx.fillStyle = colors[i] || '#fff';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(`Team ${i + 1}`, width / 2 - 40, yPos);
          }
        } else if (t > 0) {
          ctx.font = 'bold 150px Inter';
          ctx.fillText(t, width / 2, height / 2 + 50);
        }
      }

      if (currentStatus === 'running' || currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, 85);
        ctx.fillStyle = '#00d2ff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 32px Inter';
        ctx.fillText(`⚔️ SURVIVAL: ${timeRef.current}s`, width / 2, 55);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, height - 90, width, 90);
        ctx.font = 'bold 20px Inter';
        const spacing = width / (active + 1);

        for (let i = 0; i < active; i++) {
          const xPos = spacing * (i + 1);
          const yPos = height - 40;
          const isAlive = aliveRef.current[i] > 0;

          ctx.beginPath();
          ctx.arc(xPos - 18, yPos - 8, 12, 0, Math.PI * 2);
          ctx.fillStyle = isAlive ? (colors[i] || '#333') : '#333333';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = isAlive ? '#ffffff' : '#555555';
          ctx.stroke();

          ctx.fillStyle = isAlive ? '#ffffff' : '#ff2e63';
          ctx.textAlign = 'left';
          ctx.fillText(isAlive ? `${aliveRef.current[i]}` : 'X', xPos + 4, yPos);
        }
      }

      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, width, height);
        
        const maxMarbles = Math.max(...aliveRef.current.slice(0, active));
        const totalSurvivors = aliveRef.current.filter(c => c === maxMarbles && c > 0).length;
        let winnerIndex = aliveRef.current.indexOf(maxMarbles);

        ctx.textAlign = 'center';
        ctx.font = 'bold 50px Inter';
        
        if (maxMarbles > 0 && totalSurvivors === 1) {
          ctx.fillStyle = colors[winnerIndex] || '#fff';
          ctx.fillText(`🏆 TEAM ${winnerIndex + 1}`, width / 2, height / 2 - 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 35px Inter';
          ctx.fillText(`SURVIVES!`, width / 2, height / 2 + 30);
        } else {
          ctx.fillStyle = '#ff2e63';
          ctx.fillText(`💀 DRAW!`, width / 2, height / 2 - 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 30px Inter';
          ctx.fillText(`No single survivor left.`, width / 2, height / 2 + 30);
        }

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

    window.rebuildSurvivalArena = buildArena;
    
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    return () => {
      Render.stop(render);
      if (render.canvas) render.canvas.remove(); 
      if (runnerRef.current) Runner.stop(runnerRef.current);
      if (engineRef.current) {
        Composite.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
      }
      clearInterval(countdownTimerRef.current);
      clearInterval(maxMatchTimerRef.current);
      delete window.rebuildSurvivalArena;
    };
  }, []); 

  const updateTeamColor = (index, color) => {
    const newColors = [...teamColors];
    newColors[index] = color;
    setTeamColors(newColors);
  };

  const startRecordingSequence = () => {
    if (window.rebuildSurvivalArena) window.rebuildSurvivalArena();

    const initialAlive = Array(activeTeams).fill(marbleCount);
    setAliveCounts(initialAlive);
    aliveRef.current = initialAlive;
    
    setTimeLeft(40); 
    fireworksRef.current = [];
    preGameTimeRef.current = 5; 
    setGameStatus('countdown');

    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    allBodies.filter(b => b.label && b.label.startsWith('team_')).forEach(b => Composite.remove(engineRef.current.world, b));

    const canvas = sceneRef.current.querySelector('canvas');
    if (!canvas) return;

    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recordedChunksRef.current = [];
    
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Survival-Escape-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;

    countdownTimerRef.current = setInterval(() => {
      preGameTimeRef.current -= 1;
      
      if (preGameTimeRef.current <= 0) {
        clearInterval(countdownTimerRef.current);
        setGameStatus('running');
        spawnSurvivalMarbles();
        
        maxMatchTimerRef.current = setInterval(() => {
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
        const marble = Bodies.circle(center.x + (Math.random() * 20 - 10), center.y + (Math.random() * 20 - 10), 9, {
          restitution: 1.05,
          friction: 0,
          frictionAir: 0,
          label: `team_${t}`,
          render: { fillStyle: teamColorsRef.current[t] }
        });
        
        // ⚙️ SPEED TWEAK: Lowered initial blast velocity from 25 to 12
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);
  };

  const endMatch = () => {
    clearInterval(maxMatchTimerRef.current);
    setGameStatus('finished');

    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    allBodies.filter(b => b.label && b.label.startsWith('team_')).forEach(b => Composite.remove(engineRef.current.world, b));

    const maxMarbles = Math.max(...aliveRef.current.slice(0, activeTeamsRef.current));
    const totalSurvivors = aliveRef.current.filter(c => c === maxMarbles && c > 0).length;
    let winnerIndex = aliveRef.current.indexOf(maxMarbles);
    const winColor = (maxMarbles > 0 && totalSurvivors === 1) ? teamColorsRef.current[winnerIndex] : '#ffffff';

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
      setGameStatus('idle');
    }, 4000);
  };

  let btnText = 'Start Survival 🔴🎬';
  if (gameStatus === 'countdown') btnText = 'Locking In... ⏳';
  if (gameStatus === 'running') btnText = 'Survival Active... ⚔️';
  if (gameStatus === 'finished') btnText = 'Saving Video... 🎆';

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>⭕ Survival Mode</h2>
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
        <button className={`btn ${gameStatus === 'idle' ? 'btn-record' : 'btn-secondary'}`} onClick={startRecordingSequence} disabled={gameStatus !== 'idle'} style={{ marginTop: '20px' }}>
          {btnText}
        </button>
      </div>
      <div className="stage-wrapper"><div className="canvas-container" ref={sceneRef} /></div>
    </div>
  );
}