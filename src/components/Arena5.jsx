import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena5() {
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
  const [teamNames, setTeamNames] = useState(['Aston Martin', 'Ferrari', 'McLaren', 'Mercedes', 'Red Bull']);
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
  const totalTrackHeight = 6500; 
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
    engine.world.gravity.y = 0.8; 
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { 
        width, 
        height, 
        wireframes: false, 
        background: '#0d0e15',
        hasBounds: true,
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: width, y: height } });

    const buildHyperTrack = () => {
      if (!engineRef.current) return;
      Composite.clear(engineRef.current.world, false);
      spinnersRef.current = [];
      cameraYRef.current = 0;
      leaderIndexRef.current = null;
      firstWinnerRef.current = null; 

      Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: width, y: height } });

      // Outer Boundary Walls
      Composite.add(engineRef.current.world, [
        Bodies.rectangle(10, totalTrackHeight/2, 20, totalTrackHeight, { isStatic: true, friction: 0, render: { fillStyle: '#ffffff' } }),
        Bodies.rectangle(width-10, totalTrackHeight/2, 20, totalTrackHeight, { isStatic: true, friction: 0, render: { fillStyle: '#ffffff' } }),
      ]);

      // 🛑 SECTION 1: The Triple Threat Spinners
      for (let i = 0; i < 6; i++) {
        const isLeft = i % 2 === 0;
        const yPos = 450 + (i * 250);
        
        const slope = Bodies.rectangle(isLeft ? 150 : width - 150, yPos, 400, 16, {
          isStatic: true, angle: isLeft ? 0.3 : -0.3, friction: 0.002, render: { fillStyle: '#ffffff' }
        });
        
        const spinX = width / 2 + (isLeft ? 60 : -60);
        const spinY = yPos + 100;
        const spinCenter = Bodies.circle(spinX, spinY, 5, { isStatic: true, render: { visible: false } });
        const spinBlade = Bodies.rectangle(spinX, spinY, 150, 16, {
          friction: 0, restitution: 0.8, render: { fillStyle: '#ff0055' } 
        });
        const spinConstraint = Matter.Constraint.create({
          bodyA: spinCenter, bodyB: spinBlade, stiffness: 1, length: 0, render: { visible: false }
        });

        Composite.add(engineRef.current.world, [slope, spinCenter, spinBlade, spinConstraint]);
        spinnersRef.current.push({ body: spinBlade, speed: isLeft ? 0.08 : -0.08 });
      }

      // 🔺 SECTION 2: Hexagonal Plinko Shift Grid
      const pegs = [];
      for (let row = 0; row < 14; row++) {
        const isEven = row % 2 === 0;
        const cols = isEven ? 7 : 8;
        const spacing = width / 8;
        const startX = isEven ? spacing : spacing / 2;
        const yPos = 2100 + (row * 80);
        for (let col = 0; col < cols; col++) {
          pegs.push(Bodies.circle(startX + (col * spacing), yPos, 8, {
            isStatic: true, restitution: 0.9, render: { fillStyle: '#00d2ff' }
          }));
        }
      }
      Composite.add(engineRef.current.world, pegs);

      // 🟩 SECTION 3: Sloped Staircase Step Chutes (Fixed to prevent stuck marbles)
      for (let j = 0; j < 5; j++) {
        const chuteY = 3500 + (j * 180);
        const shiftLeft = j % 2 === 0;
        Composite.add(engineRef.current.world, [
          Bodies.rectangle(shiftLeft ? 140 : width - 140, chuteY, 320, 20, { 
            isStatic: true, 
            angle: shiftLeft ? 0.25 : -0.25, // This downward slope prevents getting stuck
            render: { fillStyle: '#ffeb3b' } 
          }),
          Bodies.circle(shiftLeft ? width - 80 : 80, chuteY + 60, 15, { 
            isStatic: true, 
            restitution: 1.3, 
            render: { fillStyle: '#00ff87' } 
          })
        ]);
      }

      // ⚡ SECTION 4: High-Velocity Shuffle Pins
      const shuffleBumpers = [];
      for (let r = 0; r < 6; r++) {
        const yRow = 4700 + (r * 130);
        const pinCount = r % 2 === 0 ? 4 : 5;
        const spacing = width / (pinCount + 1);
        for (let c = 0; c < pinCount; c++) {
          shuffleBumpers.push(Bodies.circle(spacing * (c + 1), yRow, 12, {
            isStatic: true, restitution: 1.45, render: { fillStyle: '#b700ff' } 
          }));
        }
      }
      Composite.add(engineRef.current.world, shuffleBumpers);

      // 🏁 SECTION 5: Final Funnel Pipeline Gates
      Composite.add(engineRef.current.world, [
        Bodies.rectangle(80, 5900, 220, 24, { isStatic: true, angle: 0.4, render: { fillStyle: '#ffffff' } }),
        Bodies.rectangle(width - 80, 5900, 220, 24, { isStatic: true, angle: -0.4, render: { fillStyle: '#ffffff' } }),
        Bodies.polygon(width / 2, 6100, 3, 20, { isStatic: true, restitution: 1.2, render: { fillStyle: '#ff0055' } })
      ]);

      // Thin Sensor Finish Plane
      const finishLine = Bodies.rectangle(width / 2, finishLineY, width - 20, 2, {
        isStatic: true,
        isSensor: true, 
        render: { fillStyle: '#00ff87' }
      });
      Composite.add(engineRef.current.world, finishLine);
    };

    buildHyperTrack();

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
        if (speed > 13) {
          const clamp = 13 / speed;
          Body.setVelocity(b, { x: b.velocity.x * clamp, y: b.velocity.y * clamp });
        }

        if (b.position.y >= finishLineY && !b.hasFinished) {
          b.hasFinished = true;
          const teamIndex = parseInt(b.label.split('_')[1], 10);
          
          if (firstWinnerRef.current === null) {
            firstWinnerRef.current = teamIndex;
          }
        }
      });

      if (activeMarbles > 0 && marbles.filter(m => !m.hasFinished).length === 0) {
        endRace();
      }
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
        cameraYRef.current += (targetY - cameraYRef.current) * 0.14; 
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
        ctx.fillStyle = 'rgba(7, 8, 14, 0.85)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 38px Inter';
        ctx.fillText('HYPER GRAND PRIX', width / 2, height / 2 - 20);
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
          ctx.fillText('PICK YOUR CONSTRUCTOR!', width / 2, 160);
          for (let i = 0; i < active; i++) {
            const yPos = 250 + (i * 65);
            ctx.beginPath();
            ctx.arc(width / 2 - 130, yPos - 8, 16, 0, Math.PI * 2);
            ctx.fillStyle = colors[i] || '#fff';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = 'bold 24px Inter';
            ctx.fillText(names[i] || `Team ${i + 1}`, width / 2 - 90, yPos);
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
           ctx.fillText(`P1 ADVANTAGE`, width / 2, 30);
           ctx.fillStyle = colors[leaderIndexRef.current];
           ctx.font = 'bold 26px Inter';
           ctx.fillText(`${names[leaderIndexRef.current].toUpperCase()}`, width / 2, 65);
        }
      }

      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(18, 19, 28, 0.92)';
        ctx.fillRect(0, 0, width, height);
        
        let winnerIndex = firstWinnerRef.current !== null ? firstWinnerRef.current : 0;
        
        ctx.textAlign = 'center';
        ctx.fillStyle = colors[winnerIndex] || '#fff';
        ctx.font = 'bold 46px Inter';
        ctx.fillText(`${names[winnerIndex].toUpperCase()}`, width / 2, height / 2 - 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Inter';
        ctx.fillText(`TAKES THE CHECKERED FLAG! 🏆`, width / 2, height / 2 + 30);

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

    window.rebuildHyperTrackArena = buildHyperTrack;
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
      delete window.rebuildHyperTrackArena;
    };
  }, []);

  const handleNameChange = (index, value) => { const newNames = [...teamNames]; newNames[index] = value; setTeamNames(newNames); };
  const updateTeamColor = (index, color) => { const newColors = [...teamColors]; newColors[index] = color; setTeamColors(newColors); };

  const startRecordingSequence = () => {
    if (window.rebuildHyperTrackArena) window.rebuildHyperTrackArena();
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
      a.download = `Hyper-Race-${Date.now()}.webm`;
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
        maxMatchTimerRef.current = setInterval(() => { endRace(); }, 60000); 
      }
    }, 1000);
  };

  const spawnRacingMarbles = () => {
    const { Composite, Bodies, Body } = Matter;
    const newBodies = [];
    for (let t = 0; t < activeTeamsRef.current; t++) {
      for (let m = 0; m < marbleCount; m++) {
        const marble = Bodies.circle(width/2 + (Math.random() * 80 - 40), 100, 12, { restitution: 0.55, friction: 0.01, frictionAir: 0.012, label: `team_${t}`, render: { fillStyle: teamColorsRef.current[t] } });
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 4, y: 3 });
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

  let btnText = 'Start Hyper Grand Prix 🔴🏎️';
  if (gameStatus === 'countdown') btnText = 'Grid Locking... ⏳';
  if (gameStatus === 'running') btnText = 'Racing Live... 🏁';
  if (gameStatus === 'finished') btnText = 'Compiling Telemetry... 🎆';

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>🏎️ Hyper Grand Prix</h2>
        <div className="control-group">
          <label>Number of Constructors: {activeTeams}</label>
          <input type="range" min="2" max="5" value={activeTeams} disabled={gameStatus !== 'idle'} onChange={(e) => setActiveTeams(Number(e.target.value))} />
        </div>
        <div className="control-group">
          <label>Marbles Per Team: {marbleCount}</label>
          <input type="range" min="1" max="5" value={marbleCount} disabled={gameStatus !== 'idle'} onChange={(e) => setMarbleCount(Number(e.target.value))} />
        </div>
        
        <div className="color-selectors" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ color: '#8892b0', fontSize: '12px', fontWeight: 'bold' }}>CONSTRUCTOR LINEUP</label>
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
      <div className="stage-wrapper"><div className="canvas-container" ref={sceneRef} style={{ width: '540px', height: '960px', backgroundColor: '#0d0e15', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }} /></div>
    </div>
  );
}