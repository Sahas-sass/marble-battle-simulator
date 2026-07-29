import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena9() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const raceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // --- STATE ---
  const [activeTeams, setActiveTeams] = useState(2);
  const [marbleCount, setMarbleCount] = useState(3);
  const [teamColors, setTeamColors] = useState(['#00ff87', '#ff0055', '#ffeb3b', '#00d2ff', '#b700ff']);
  const [teamNames, setTeamNames] = useState(['Aston Martin', 'Ferrari', 'McLaren', 'Mercedes', 'Red Bull']);
  const [gameStatus, setGameStatus] = useState('idle');
  const [scores, setScores] = useState([0, 0, 0, 0, 0]); 
  const [timeLeft, setTimeLeft] = useState(90); 
  const [winnerName, setWinnerName] = useState('');
  const [winnerColor, setWinnerColor] = useState('');

  // --- REFS ---
  const scoresRef = useRef([0, 0, 0, 0, 0]);
  const timeRef = useRef(90);
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(2);
  const marbleCountRef = useRef(3);
  const teamColorsRef = useRef(teamColors);
  const teamNamesRef = useRef(teamNames);
  const preGameTimeRef = useRef(5);
  const fireworksRef = useRef([]);
  const spinnersRef = useRef([]);
  const raceWinnerRef = useRef(null); 

  const mapWidth = 2560;
  const height = 720;
  const colWidth = 320; 

  const changeStatus = (newStatus) => {
    statusRef.current = newStatus;
    setGameStatus(newStatus);
  };

  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { marbleCountRef.current = marbleCount; }, [marbleCount]);
  useEffect(() => { teamColorsRef.current = teamColors; }, [teamColors]);
  useEffect(() => { teamNamesRef.current = teamNames; }, [teamNames]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.innerHTML = '';

    const { Engine, Render, Runner, Bodies, Composite, Events, Body, Vector, Constraint } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 1.35; 
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: mapWidth,
        height: height,
        wireframes: false,
        background: '#0a0d14',
        pixelRatio: 1
      }
    });
    renderRef.current = render;

    const buildTournamentTrack = () => {
      Composite.clear(engine.world, false);
      fireworksRef.current = [];
      spinnersRef.current = [];
      raceWinnerRef.current = null;
      setWinnerName('');

      const wallOpts = { isStatic: true, friction: 0, render: { fillStyle: '#1b1f33' } };
      
      // Generate vertical sector dividers
      for (let i = 0; i <= 8; i++) {
        Composite.add(engine.world, Bodies.rectangle(i * colWidth, height / 2, 12, height, wallOpts));
      }

      // 🛡️ THE FIX: Top wall spans across, but bottom wall ONLY exists in Sector 8 to hold the marbles!
      Composite.add(engine.world, [
        Bodies.rectangle(mapWidth / 2, 5, mapWidth, 10, wallOpts), // Top ceiling
        Bodies.rectangle(mapWidth - (colWidth / 2), height - 5, colWidth, 10, wallOpts) // Floor ONLY in Stage 8
      ]);

      // 🟢 SECTOR 1: Plinko Grid
      const pegs = [];
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
          const shift = row % 2 === 0 ? 0 : 35;
          pegs.push(Bodies.circle(55 + col * 70 + shift, 190 + row * 85, 8, { 
            isStatic: true, restitution: 0.6, friction: 0, render: { fillStyle: '#2a2f4c' } 
          }));
        }
      }
      Composite.add(engine.world, pegs);

      // 🌪️ SECTOR 2: Turbine Spinners
      const ox2 = colWidth; 
      for(let i = 0; i < 3; i++) {
        const yPos = 240 + (i * 170);
        const center = Bodies.circle(ox2 + 160, yPos, 10, { isStatic: true, render: { visible: false } });
        const bladeOpt = { friction: 0, chamfer: { radius: 8 }, render: { fillStyle: '#3d446b' } };
        const hBlade = Bodies.rectangle(ox2 + 160, yPos, 200, 20, bladeOpt);
        const vBlade = Bodies.rectangle(ox2 + 160, yPos, 20, 200, bladeOpt);
        const turbine = Body.create({ parts: [hBlade, vBlade], frictionAir: 0 });
        const constraint = Constraint.create({ bodyA: center, bodyB: turbine, stiffness: 1, length: 0, render: { visible: false } });
        Composite.add(engine.world, [center, turbine, constraint]);
        spinnersRef.current.push({ body: turbine, speed: i % 2 === 0 ? 0.08 : -0.08, originalY: yPos, originalX: ox2 + 160 });
      }

      // 🏎️ SECTOR 3: High-Speed Chicane
      const ox3 = colWidth * 2;
      const rampOpt = { isStatic: true, friction: 0, chamfer: { radius: 10 }, render: { fillStyle: '#1b1f33' } };
      const bumperOpt = { isStatic: true, restitution: 1.6, render: { fillStyle: '#ff0055' } };
      Composite.add(engine.world, [
        Bodies.rectangle(ox3 + 90, 200, 180, 20, { ...rampOpt, angle: 0.45 }),
        Bodies.rectangle(ox3 + 230, 360, 180, 20, { ...rampOpt, angle: -0.45 }),
        Bodies.rectangle(ox3 + 90, 520, 180, 20, { ...rampOpt, angle: 0.45 }),
        Bodies.circle(ox3 + 250, 270, 22, bumperOpt),
        Bodies.circle(ox3 + 70, 440, 22, { ...bumperOpt, render: { fillStyle: '#00d2ff' } }),
        Bodies.circle(ox3 + 250, 600, 22, bumperOpt),
      ]);

      // 🏁 SECTOR 4: High-Flow Escape Funnels
      const ox4 = colWidth * 3;
      const steepRamp = { isStatic: true, friction: 0, chamfer: { radius: 10 }, render: { fillStyle: '#1b1f33' } };
      Composite.add(engine.world, [
        Bodies.rectangle(ox4 + 50, 300, 180, 20, { ...steepRamp, angle: 0.8 }),
        Bodies.rectangle(ox4 + 270, 300, 180, 20, { ...steepRamp, angle: -0.8 }),
        Bodies.rectangle(ox4 + 50, 540, 180, 20, { ...steepRamp, angle: 0.8 }),
        Bodies.rectangle(ox4 + 270, 540, 180, 20, { ...steepRamp, angle: -0.8 }),
      ]);

      // ⚡ SECTOR 5: Diamond Cascades
      const ox5 = colWidth * 4;
      for (let r = 0; r < 4; r++) {
        const yCoord = 200 + r * 130;
        const count = r % 2 === 0 ? 3 : 2;
        for (let c = 0; c < count; c++) {
          const xCoord = count === 3 ? (ox5 + 60 + c * 100) : (ox5 + 110 + c * 100);
          Composite.add(engine.world, Bodies.polygon(xCoord, yCoord, 4, 16, {
            isStatic: true, restitution: 0.8, angle: Math.PI / 4, render: { fillStyle: '#ffeb3b' }
          }));
        }
      }

      // 🌀 SECTOR 6: Pinwheel Gateway
      const ox6 = colWidth * 5;
      for (let j = 0; j < 2; j++) {
        const yPos = 300 + j * 260;
        const xPos = ox6 + 160;
        const anchor = Bodies.circle(xPos, yPos, 8, { isStatic: true, render: { visible: false } });
        const bar = Bodies.rectangle(xPos, yPos, 220, 18, { friction: 0, chamfer: { radius: 6 }, render: { fillStyle: '#00ff87' } });
        const constraint = Constraint.create({ bodyA: anchor, bodyB: bar, stiffness: 1, length: 0, render: { visible: false } });
        Composite.add(engine.world, [anchor, bar, constraint]);
        spinnersRef.current.push({ body: bar, speed: j === 0 ? -0.07 : 0.07, originalY: yPos, originalX: xPos });
      }

      // 🎢 SECTOR 7: Zig-Zag Sliders
      const ox7 = colWidth * 6;
      Composite.add(engine.world, [
        Bodies.rectangle(ox7 + 160, 180, 240, 20, { ...rampOpt, angle: 0.35 }),
        Bodies.rectangle(ox7 + 100, 340, 220, 20, { ...rampOpt, angle: -0.35 }),
        Bodies.rectangle(ox7 + 220, 500, 220, 20, { ...rampOpt, angle: 0.35 }),
        Bodies.circle(ox7 + 60, 240, 15, { isStatic: true, restitution: 1.2, render: { fillStyle: '#ff0055' } }),
        Bodies.circle(ox7 + 260, 400, 15, { isStatic: true, restitution: 1.2, render: { fillStyle: '#00d2ff' } })
      ]);

      // 🏆 SECTOR 8: Final Straightaway Drop
      const ox8 = colWidth * 7;
      Composite.add(engine.world, [
        Bodies.rectangle(ox8 + 40, 350, 160, 25, { ...steepRamp, angle: 0.9 }),
        Bodies.rectangle(ox8 + 280, 350, 160, 25, { ...steepRamp, angle: -0.9 })
      ]);

      const finishLine = Bodies.rectangle(ox8 + 160, 690, 300, 16, {
        isStatic: true, isSensor: true, label: 'finish_line', render: { fillStyle: '#00ff87' }
      });
      Composite.add(engine.world, finishLine);
    };

    buildTournamentTrack();

    Events.on(engine, 'beforeUpdate', () => {
      if (statusRef.current !== 'running') return;

      spinnersRef.current.forEach(spinner => {
        Body.setAngularVelocity(spinner.body, spinner.speed);
        Body.setPosition(spinner.body, { x: spinner.originalX, y: spinner.originalY });
      });

      const allBodies = Composite.allBodies(engine.world);
      const marbles = allBodies.filter(b => b.label.startsWith('team_') && !b.hasFinished);
      
      marbles.forEach(marble => {
        const speed = Vector.magnitude(marble.velocity);
        
        if (speed > 24) {
          const clamp = 24 / speed;
          Body.setVelocity(marble, { x: marble.velocity.x * clamp, y: marble.velocity.y * clamp });
        }

        if (speed < 0.25 && marble.position.y > 140) {
          Body.applyForce(marble, marble.position, {
            x: (Math.random() - 0.5) * 0.004,
            y: -0.003
          });
        }

        // 🏁 HIGH-SPEED 8-STAGE HORIZONTAL TELEPORTATION ENGINE
        if (marble.position.y > 680) {
          const currentSector = Math.floor(marble.position.x / colWidth);
          const nextSector = currentSector + 1;
          
          if (nextSector < 8) {
            // Reset all structural forces to prevent engine velocity carryover glitches
            Body.setVelocity(marble, { x: 0, y: 0 });
            Body.setAngularVelocity(marble, 0);
            marble.force = { x: 0, y: 0 };
            marble.torque = 0;

            // Teleport cleanly into the center lane of the next stage frame
            const targetX = (nextSector * colWidth) + 160;
            Body.setPosition(marble, { x: targetX, y: 105 });
            
            // Give them a clean, natural downward push
            Body.setVelocity(marble, { x: (Math.random() - 0.5) * 2, y: 4 });
          }
        }
      });
    });

    Events.on(engine, 'collisionStart', (event) => {
      if (statusRef.current !== 'running') return;
      
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const sensor = bodyA.label === 'finish_line' ? bodyA : (bodyB.label === 'finish_line' ? bodyB : null);
        const marble = bodyA.label.startsWith('team_') ? bodyA : (bodyB.label.startsWith('team_') ? bodyB : null);
        
        if (sensor && marble && !marble.hasFinished) {
          marble.hasFinished = true;
          const teamIndex = parseInt(marble.label.split('_')[1], 10);
          
          if (raceWinnerRef.current === null) {
            raceWinnerRef.current = teamIndex;
            setWinnerName(teamNamesRef.current[teamIndex]);
            setWinnerColor(teamColorsRef.current[teamIndex]);
            endMatch(teamIndex);
          }

          const newScores = [...scoresRef.current];
          newScores[teamIndex] += 1;
          scoresRef.current = newScores;
          setScores(newScores);

          Body.setVelocity(marble, { x: (Math.random() - 0.5) * 12, y: -22 });
        }
      });
    });

    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const colors = teamColorsRef.current;
      const names = teamNamesRef.current;
      const active = activeTeamsRef.current;
      const mCount = marbleCountRef.current;

      ctx.save();
      
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.font = '900 75px Inter';
      ctx.textAlign = 'center';
      for (let i = 0; i < 8; i++) {
        ctx.fillText(`S${i+1}`, (i * colWidth) + 160, 240);
      }

      if (currentStatus === 'idle') {
        ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
        ctx.fillRect(0, 0, mapWidth, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 55px Inter';
        ctx.fillText('GRAND PRIX TOURNAMENT: 8 SECTORS', mapWidth / 2, height / 2 - 20);
        ctx.fillStyle = '#00d2ff';
        ctx.font = 'bold 24px Inter';
        ctx.fillText('8 Dynamic Stages. Complete Physics Flow Fix.', mapWidth / 2, height / 2 + 30);
      }

      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(10, 13, 20, 0.95)';
        ctx.fillRect(0, 0, mapWidth, height);
        ctx.textAlign = 'center';
        
        if (t > 3) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 46px Inter';
          ctx.fillText('STARTING GRID', mapWidth / 2, 160);
          for (let i = 0; i < active; i++) {
            const yPos = 250 + (i * 70);
            ctx.beginPath();
            ctx.arc(mapWidth / 2 - 150, yPos - 10, 20, 0, Math.PI * 2);
            ctx.fillStyle = colors[i];
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = 'bold 28px Inter';
            ctx.fillText(names[i] || `Team ${i + 1}`, mapWidth / 2 - 100, yPos);
          }
        } else if (t > 0) {
          ctx.fillStyle = '#ff0055';
          ctx.font = 'bold 220px Inter';
          ctx.fillText(t, mapWidth / 2, height / 2 + 60);
        }
      }

      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(10, 13, 20, 0.92)';
        ctx.fillRect(0, 0, mapWidth, height);
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 75px Inter';
        ctx.fillStyle = raceWinnerRef.current !== null ? colors[raceWinnerRef.current] : '#fff';
        ctx.fillText(`🏆 ${names[raceWinnerRef.current]?.toUpperCase() || 'UNKNOWN'} WINS P1!`, mapWidth / 2, height / 2 - 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Inter';
        ctx.fillText('First across the line verified by hardware sensor grid.', mapWidth / 2, height / 2 + 50);

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

      ctx.restore();
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

  const handleNameChange = (index, value) => { const newNames = [...teamNames]; newNames[index] = value; setTeamNames(newNames); };
  const updateTeamColor = (index, color) => { const newColors = [...teamColors]; newColors[index] = color; setTeamColors(newColors); };

  const startRecordingSequence = () => {
    setScores([0, 0, 0, 0, 0]);
    scoresRef.current = [0, 0, 0, 0, 0];
    setTimeLeft(90); 
    fireworksRef.current = [];
    preGameTimeRef.current = 5; 
    raceWinnerRef.current = null;
    setWinnerName('');
    changeStatus('countdown');

    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    allBodies.filter(b => b.label.startsWith('team_')).forEach(b => Composite.remove(engineRef.current.world, b));

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
      a.download = `GrandPrix-8Sectors-${Date.now()}.webm`;
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
        spawnTournamentMarbles();
        
        raceTimerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              if(raceWinnerRef.current === null) endMatch(0);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }, 1000);
  };

  const spawnTournamentMarbles = () => {
    if (!engineRef.current) return;
    const { Composite, Bodies, Body } = Matter;
    const newBodies = [];
    
    const activeT = activeTeamsRef.current;
    const mCount = marbleCountRef.current;

    for (let t = 0; t < activeT; t++) {
      for (let m = 0; m < mCount; m++) {
        const spawnX = 160 + (Math.random() * 20 - 10); 
        const spawnY = 125 - (m * 25) - (t * 10); 

        const marble = Bodies.circle(spawnX, spawnY, 12, {
          restitution: 0.65, 
          friction: 0, 
          frictionAir: 0, 
          label: `team_${t}`,
          hasFinished: false,
          render: { fillStyle: teamColorsRef.current[t] }
        });
        
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 2, y: 2 });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);
  };

  const endMatch = (winnerIdx) => {
    clearInterval(raceTimerRef.current);
    changeStatus('finished');

    const winColor = teamColorsRef.current[winnerIdx] || '#ffffff';
    const particles = [];
    for(let i = 0; i < 400; i++) {
      particles.push({
        x: mapWidth / 2, y: height / 2,
        vx: (Math.random() - 0.5) * 60, 
        vy: (Math.random() - 0.5) * 60 - 5,
        size: Math.random() * 8 + 3,
        color: Math.random() > 0.4 ? winColor : '#ffffff'
      });
    }
    fireworksRef.current = particles;

    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      changeStatus('idle');
    }, 5000);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HUD Dashboard */}
      <div style={{ background: 'rgba(18, 20, 34, 0.75)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '20px', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: '800', color: '#fff', letterSpacing: '1px' }}>🏎️ MASSIVE 8-SECTOR GRAND PRIX</h2>
            {winnerName && <p style={{ color: winnerColor, margin: '5px 0 0 0', fontWeight: 'bold' }}>First Place Podium Lock: {winnerName}</p>}
          </div>
          
          <div style={{ display: 'flex', gap: '30px', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
              <label style={{ color: '#8892b0', fontSize: '12px', fontWeight: 'bold' }}>CONSTRUCTORS: {activeTeams}</label>
              <input type="range" min="2" max="5" value={activeTeams} disabled={gameStatus !== 'idle'} onChange={(e) => setActiveTeams(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
              <label style={{ color: '#8892b0', fontSize: '12px', fontWeight: 'bold' }}>MARBLES PER TEAM: {marbleCount}</label>
              <input type="range" min="1" max="10" value={marbleCount} disabled={gameStatus !== 'idle'} onChange={(e) => setMarbleCount(Number(e.target.value))} />
            </div>
          </div>

          <button 
            onClick={startRecordingSequence}
            disabled={gameStatus !== 'idle'}
            style={{ padding: '14px 30px', background: gameStatus === 'idle' ? 'linear-gradient(135deg, #00ff87 0%, #00d2ff 100%)' : '#1f2235', color: '#000', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '15px', cursor: gameStatus === 'idle' ? 'pointer' : 'not-allowed', boxShadow: gameStatus === 'idle' ? '0 10px 20px rgba(0,255,135,0.2)' : 'none' }}
          >
            {gameStatus === 'idle' ? '🏁 START 8-STAGE RACE' : 'Racing Live...'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
           {Array.from({ length: activeTeams }).map((_, idx) => (
              <div key={idx} style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <input type="color" value={teamColors[idx]} disabled={gameStatus !== 'idle'} onChange={(e) => updateTeamColor(idx, e.target.value)} style={{ width: '30px', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }} />
                <input type="text" value={teamNames[idx] || ''} placeholder={`Team ${idx + 1}`} disabled={gameStatus !== 'idle'} onChange={(e) => handleNameChange(idx, e.target.value)} style={{ flex: 1, padding: '5px', background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', fontWeight: '600', outline: 'none' }} />
              </div>
            ))}
        </div>
      </div>

      {/* Horizontal Scroll Arena Map Viewport Frame Container */}
      <div style={{ display: 'block', width: '100%', overflowX: 'auto', backgroundColor: '#0a0d14', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', padding: '10px 0' }}>
        <div 
          className="canvas-frame-container wide-tournament-scroll" 
          ref={sceneRef} 
          style={{ width: `${mapWidth}px`, height: `${height}px` }} 
        />
      </div>
      <p style={{ color: '#8892b0', fontSize: '13px', textAlign: 'center', margin: 0 }}>💡 Use your mouse/trackpad or Shift+Scroll to pan sideways across all 8 custom horizontal stages!</p>
    </div>
  );
}