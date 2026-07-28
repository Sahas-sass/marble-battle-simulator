import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena4() {
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
  const [marbleCount, setMarbleCount] = useState(1); 
  const [teamColors, setTeamColors] = useState(['#00ff87', '#ff0055', '#ffeb3b', '#00d2ff', '#b700ff']);
  const [teamNames, setTeamNames] = useState(['Green Goblins', 'Red Rockets', 'Yellow Jackets', 'Blue Blazers', 'Purple Phantoms']);
  const [gameStatus, setGameStatus] = useState('idle');

  // --- REFS ---
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(5);
  const teamColorsRef = useRef(teamColors);
  const teamNamesRef = useRef(teamNames);
  const preGameTimeRef = useRef(5);
  const fireworksRef = useRef([]);
  const spinnersRef = useRef([]); 
  
  const cameraYRef = useRef(0);
  const leaderIndexRef = useRef(null); 
  const firstWinnerRef = useRef(null); 

  const width = 540;
  const height = 960; 
  const totalTrackHeight = 5200; // Extra length for the catch-up zone
  const finishLineY = totalTrackHeight - 140;

  const changeStatus = (newStatus) => {
    statusRef.current = newStatus;
    setGameStatus(newStatus);
  };

  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { teamColorsRef.current = teamColors; }, [teamColors]);
  useEffect(() => { teamNamesRef.current = teamNames; }, [teamNames]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.innerHTML = ''; 

    const { Engine, Render, Runner, Bodies, Composite, Events, Body, Vector } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 0.75; // Fast racing speed
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { 
        width, 
        height, 
        wireframes: false, 
        background: '#12131c',
        hasBounds: true,
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: width, y: height } });

    const buildMegaTrack = () => {
      if (!engineRef.current) return;
      Composite.clear(engineRef.current.world, false);
      spinnersRef.current = [];
      cameraYRef.current = 0;
      leaderIndexRef.current = null;
      firstWinnerRef.current = null; 

      Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: width, y: height } });

      // Outer Side Walls
      Composite.add(engineRef.current.world, [
        Bodies.rectangle(10, totalTrackHeight/2, 20, totalTrackHeight, { isStatic: true, friction: 0, render: { fillStyle: '#ffffff' } }),
        Bodies.rectangle(width-10, totalTrackHeight/2, 20, totalTrackHeight, { isStatic: true, friction: 0, render: { fillStyle: '#ffffff' } }),
      ]);

      // STAGE 1: Long ZigZags & Spinners (400px - 2000px)
      for (let i = 0; i < 7; i++) {
        const isLeft = i % 2 === 0;
        const yPos = 400 + (i * 240);
        
        const slope = Bodies.rectangle(isLeft ? 140 : width - 140, yPos, 420, 16, {
          isStatic: true, angle: isLeft ? 0.28 : -0.32, friction: 0.005, render: { fillStyle: '#ffffff' }
        });
        
        const spinX = isLeft ? width - 80 : 80;
        const spinY = yPos + 80;
        const spinCenter = Bodies.circle(spinX, spinY, 4, { isStatic: true, render: { visible: false } });
        const spinBlade = Bodies.rectangle(spinX, spinY, 135, 14, {
          friction: 0, restitution: 0.7, render: { fillStyle: '#00d2ff' } 
        });
        const spinConstraint = Matter.Constraint.create({
          bodyA: spinCenter, bodyB: spinBlade, stiffness: 1, length: 0, render: { visible: false }
        });

        Composite.add(engineRef.current.world, [slope, spinCenter, spinBlade, spinConstraint]);
        spinnersRef.current.push({ body: spinBlade, speed: isLeft ? 0.07 : -0.07 });
      }

      // STAGE 2: Plinko Grid Drop (2200px - 3100px)
      const pegs = [];
      for (let row = 0; row < 11; row++) {
        const isEven = row % 2 === 0;
        const cols = isEven ? 6 : 7;
        const spacing = width / 7;
        const startX = isEven ? spacing : spacing / 2;
        const yPos = 2150 + (row * 85);
        for (let col = 0; col < cols; col++) {
          pegs.push(Bodies.circle(startX + (col * spacing), yPos, 10, {
            isStatic: true, restitution: 0.85, render: { fillStyle: '#b700ff' }
          }));
        }
      }
      Composite.add(engineRef.current.world, pegs);

      // STAGE 3: Shatter Glass Brick Maze (3300px - 3800px)
      const brickRowsY = [3350, 3550, 3750];
      brickRowsY.forEach((rowY, rIdx) => {
        const bricksCount = rIdx % 2 === 0 ? 5 : 6;
        const brickW = (width - 40) / bricksCount;
        for (let i = 0; i < bricksCount; i++) {
          Composite.add(engineRef.current.world, 
            Bodies.rectangle(20 + (i * brickW) + brickW/2, rowY, brickW - 8, 16, {
              isStatic: true,
              label: 'fragile_brick',
              render: { fillStyle: '#ffeb3b' }
            })
          );
        }
      });

      // 🔥 NEW STAGE 4: LEAD-SHUFFLER CATCH-UP MAZE (4000px - 4500px)
      // High-restitution pins and micro catch steps that delay the leader so the pack aggregates
      const shuffleBumpers = [];
      for (let r = 0; r < 4; r++) {
        const yRow = 4050 + (r * 110);
        const pinCount = r % 2 === 0 ? 4 : 3;
        const offset = r % 2 === 0 ? 80 : 130;
        for (let c = 0; col < pinCount; c++) {
          shuffleBumpers.push(Bodies.circle(offset + (c * 120), yRow, 14, {
            isStatic: true, restitution: 1.35, render: { fillStyle: '#00ff87' } // High bounce neon pins
          }));
        }
      }
      Composite.add(engineRef.current.world, shuffleBumpers);

      // STAGE 5: Wide Funnel Entry Gates (4600px - 4850px)
      Composite.add(engineRef.current.world, [
        Bodies.rectangle(90, 4650, 240, 20, { isStatic: true, angle: 0.45, render: { fillStyle: '#ffffff' } }),
        Bodies.rectangle(width - 90, 4650, 240, 20, { isStatic: true, angle: -0.45, render: { fillStyle: '#ffffff' } }),
        Bodies.polygon(width / 2, 4820, 3, 20, { isStatic: true, restitution: 1.2, render: { fillStyle: '#ff0055' } })
      ]);

      // 🏁 FINISH LINE FIX: Modeled as an ultra-thin sensor plane line across the entire track width
      const finishLine = Bodies.rectangle(width / 2, finishLineY, width - 20, 2, {
        isStatic: true,
        isSensor: true, // Transparent trigger lane
        render: { fillStyle: '#00ff87' }
      });
      Composite.add(engineRef.current.world, finishLine);
    };

    buildMegaTrack();

    Events.on(engine, 'beforeUpdate', () => {
      if (statusRef.current !== 'running') return;

      spinnersRef.current.forEach(spinner => {
        Body.setAngularVelocity(spinner.body, spinner.speed);
      });

      const allBodies = Composite.allBodies(engine.world);
      const marbles = allBodies.filter(b => b.label && b.label.startsWith('team_'));
      let activeMarbles = marbles.length;

      marbles.forEach(b => {
        const speed = Vector.magnitude(b.velocity);
        if (speed > 11) {
          const clamp = 11 / speed;
          Body.setVelocity(b, { x: b.velocity.x * clamp, y: b.velocity.y * clamp });
        }

        // Precise Trigger check for line plane intersection crossover
        if (b.position.y >= finishLineY && !b.hasFinished) {
          b.hasFinished = true;
          const teamIndex = parseInt(b.label.split('_')[1], 10);
          
          // Absolute winner lock condition
          if (firstWinnerRef.current === null) {
            firstWinnerRef.current = teamIndex;
          }
        }
      });

      if (activeMarbles > 0 && marbles.filter(m => !m.hasFinished).length === 0) {
        endRace();
      }
    });

    Events.on(engine, 'collisionStart', (event) => {
      if (statusRef.current !== 'running') return;
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const brick = bodyA.label === 'fragile_brick' ? bodyA : (bodyB.label === 'fragile_brick' ? bodyB : null);
        if (brick) {
          Composite.remove(engine.world, brick); 
        }
      });
    });

    Events.on(render, 'beforeRender', () => {
      const allBodies = Composite.allBodies(engine.world);
      const marbles = allBodies.filter(b => b.label.startsWith('team_') && !b.hasFinished);

      if (statusRef.current === 'idle' || statusRef.current === 'countdown') {
        cameraYRef.current = 0;
      } else if (statusRef.current === 'finished') {
        cameraYRef.current = totalTrackHeight - height;
      } else if (marbles.length > 0) {
        let maxMarbleY = Math.max(...marbles.map(m => m.position.y));
        const leader = marbles.find(m => m.position.y === maxMarbleY);
        if (leader) leaderIndexRef.current = parseInt(leader.label.split('_')[1], 10);

        let targetY = maxMarbleY - (height * 0.45);
        targetY = Math.max(0, Math.min(targetY, totalTrackHeight - height));
        cameraYRef.current += (targetY - cameraYRef.current) * 0.12; 
      }

      Render.lookAt(render, { min: { x: 0, y: cameraYRef.current }, max: { x: width, y: cameraYRef.current + height } });
    });

    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const colors = teamColorsRef.current;
      const names = teamNamesRef.current;
      const active = activeTeamsRef.current;

      ctx.save();
      const pr = render.options.pixelRatio;
      ctx.setTransform(pr, 0, 0, pr, 0, 0); 

      if (currentStatus === 'idle') {
        ctx.fillStyle = 'rgba(18, 19, 28, 0.85)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 42px Inter';
        ctx.fillText('MEGA GAUNTLET', width / 2, height / 2 - 20);
        ctx.fillStyle = '#00d2ff';
        ctx.font = 'bold 20px Inter';
        ctx.fillText('Click Start Race to Begin', width / 2, height / 2 + 30);
      }

      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(18, 19, 28, 0.95)';
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        
        if (t > 3) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 36px Inter';
          ctx.fillText('PICK YOUR SQUAD!', width / 2, 160);
          for (let i = 0; i < active; i++) {
            const yPos = 250 + (i * 65);
            ctx.beginPath();
            ctx.arc(width / 2 - 120, yPos - 8, 16, 0, Math.PI * 2);
            ctx.fillStyle = colors[i] || '#fff';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = 'bold 24px Inter';
            ctx.fillText(names[i] || `Team ${i + 1}`, width / 2 - 80, yPos);
          }
        } else if (t > 0) {
          ctx.fillStyle = '#00d2ff';
          ctx.font = 'bold 180px Inter';
          ctx.fillText(t, width / 2, height / 2 + 60);
        }
      }

      if (currentStatus === 'running') {
        ctx.fillStyle = 'rgba(18, 19, 28, 0.9)';
        ctx.fillRect(0, 0, width, 85);
        ctx.textAlign = 'center';
        if (leaderIndexRef.current !== null) {
           ctx.fillStyle = '#8892b0';
           ctx.font = '700 14px Inter';
           ctx.fillText(`CURRENT LEADER`, width / 2, 30);
           ctx.fillStyle = colors[leaderIndexRef.current];
           ctx.font = 'bold 24px Inter';
           ctx.fillText(`${names[leaderIndexRef.current].toUpperCase()}`, width / 2, 65);
        }
      }

      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(18, 19, 28, 0.92)';
        ctx.fillRect(0, 0, width, height);
        
        let winnerIndex = firstWinnerRef.current !== null ? firstWinnerRef.current : 0;
        
        ctx.textAlign = 'center';
        ctx.fillStyle = colors[winnerIndex] || '#fff';
        ctx.font = 'bold 48px Inter';
        ctx.fillText(`${names[winnerIndex].toUpperCase()}`, width / 2, height / 2 - 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Inter';
        ctx.fillText(`WINS THE RACE! 🏆`, width / 2, height / 2 + 30);

        fireworksRef.current.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.15; 
          p.size *= 0.96; 
        });
        fireworksRef.current = fireworksRef.current.filter(p => p.size > 0.5);
      }

      ctx.restore(); 
    });

    window.rebuildTrackArena = buildMegaTrack;
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    return () => {
      Render.stop(render);
      if (render.canvas) render.canvas.remove(); 
      if (runnerRef.current) Runner.stop(runnerRef.current);
      if (engineRef.current) { Composite.clear(engineRef.current.world, false); Engine.clear(engineRef.current); }
      clearInterval(countdownTimerRef.current);
      clearInterval(maxMatchTimerRef.current);
      delete window.rebuildTrackArena;
    };
  }, []);

  const handleNameChange = (index, value) => { const newNames = [...teamNames]; newNames[index] = value; setTeamNames(newNames); };
  const updateTeamColor = (index, color) => { const newColors = [...teamColors]; newColors[index] = color; setTeamColors(newColors); };

  const startRecordingSequence = () => {
    if (window.rebuildTrackArena) window.rebuildTrackArena();
    clearInterval(countdownTimerRef.current);
    clearInterval(maxMatchTimerRef.current);
    
    firstWinnerRef.current = null;
    fireworksRef.current = [];
    preGameTimeRef.current = 5; 
    changeStatus('countdown');

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
      a.download = `Obstacle-Race-${Date.now()}.webm`;
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
        spawnRacingMarbles();
        maxMatchTimerRef.current = setInterval(() => { endRace(); }, 50000); 
      }
    }, 1000);
  };

  const spawnRacingMarbles = () => {
    const { Composite, Bodies, Body } = Matter;
    const newBodies = [];
    for (let t = 0; t < activeTeamsRef.current; t++) {
      for (let m = 0; m < marbleCount; m++) {
        const marble = Bodies.circle(width/2 + (Math.random() * 80 - 40), 100, 12, { restitution: 0.5, friction: 0.01, frictionAir: 0.015, label: `team_${t}`, render: { fillStyle: teamColorsRef.current[t] } });
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 3, y: 2 });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);
  };

  const endRace = () => {
    clearInterval(maxMatchTimerRef.current);
    changeStatus('finished');
    let winnerIndex = firstWinnerRef.current !== null ? firstWinnerRef.current : 0;
    const winColor = teamColorsRef.current[winnerIndex] || '#ffffff';
    const particles = [];
    for(let i = 0; i < 300; i++) {
      particles.push({ x: width / 2 + (Math.random() * 100 - 50), y: height / 2 + (Math.random() * 100 - 50), vx: (Math.random() - 0.5) * 28, vy: (Math.random() - 0.5) * 28 - 5, size: Math.random() * 6 + 2, color: Math.random() > 0.4 ? winColor : '#ffffff' });
    }
    fireworksRef.current = particles;
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
      changeStatus('idle');
    }, 4000);
  };

  let btnText = 'Start Race 🔴🎬';
  if (gameStatus === 'countdown') btnText = 'Locking In... ⏳';
  if (gameStatus === 'running') btnText = 'Racing Live... 🏁';
  if (gameStatus === 'finished') btnText = 'Saving Video... 🎆';

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>🏁 Obstacle Race</h2>
        <div className="control-group">
          <label>Number of Teams: {activeTeams}</label>
          <input type="range" min="2" max="5" value={activeTeams} disabled={gameStatus !== 'idle'} onChange={(e) => setActiveTeams(Number(e.target.value))} />
        </div>
        <div className="control-group">
          <label>Marbles Per Team: {marbleCount}</label>
          <input type="range" min="1" max="5" value={marbleCount} disabled={gameStatus !== 'idle'} onChange={(e) => setMarbleCount(Number(e.target.value))} />
        </div>
        
        <div className="color-selectors" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ color: '#8892b0', fontSize: '12px', fontWeight: 'bold' }}>TEAM IDENTIFICATION</label>
          {Array.from({ length: activeTeams }).map((_, idx) => (
            <div className="color-picker" key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="color" value={teamColors[idx]} disabled={gameStatus !== 'idle'} onChange={(e) => updateTeamColor(idx, e.target.value)} style={{ padding: '0', width: '30px', height: '30px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
              <input type="text" value={teamNames[idx] || ''} placeholder={`Team ${idx + 1}`} disabled={gameStatus !== 'idle'} onChange={(e) => handleNameChange(idx, e.target.value)} style={{ flex: 1, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', outline: 'none' }} />
            </div>
          ))}
        </div>

        <button className={`btn ${gameStatus === 'idle' ? 'btn-record' : 'btn-secondary'}`} onClick={startRecordingSequence} disabled={gameStatus !== 'idle'} style={{ marginTop: '20px' }}>
          {btnText}
        </button>
      </div>
      <div className="stage-wrapper"><div className="canvas-container" ref={sceneRef} style={{ width: '540px', height: '960px', backgroundColor: '#07080e', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }} /></div>
    </div>
  );
}