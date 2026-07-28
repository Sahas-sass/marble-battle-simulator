import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena7() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  const raceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const spawnTimerRef = useRef(null);

  // --- STATE ---
  const [activeTeams, setActiveTeams] = useState(5); 
  const [marbleCount, setMarbleCount] = useState(3); 
  const [teamColors, setTeamColors] = useState(['#00ff87', '#ff0055', '#ffeb3b', '#00d2ff', '#b700ff']); 
  const [teamNames, setTeamNames] = useState(['Neon Strikers', 'Crimson Tide', 'Gold Rush', 'Cobalt Phantoms', 'Violet Void']);
  const [gameStatus, setGameStatus] = useState('idle');
  const [scores, setScores] = useState([0, 0, 0, 0, 0]); 
  const [timeLeft, setTimeLeft] = useState(30); // ⚡ Reduced to 30s

  // --- REFS ---
  const scoresRef = useRef([0, 0, 0, 0, 0]);
  const timeRef = useRef(30);
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(5);
  const teamColorsRef = useRef(teamColors);
  const teamNamesRef = useRef(teamNames);
  const preGameTimeRef = useRef(5);
  const fireworksRef = useRef([]); 
  const platformsRef = useRef([]); 
  const spinnersRef = useRef([]);

  const width = 540;
  const height = 960;
  
  const changeStatus = (newStatus) => {
    statusRef.current = newStatus;
    setGameStatus(newStatus);
  };

  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { teamColorsRef.current = teamColors; }, [teamColors]);
  useEffect(() => { teamNamesRef.current = teamNames; }, [teamNames]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    const { Engine, Render, Runner, Bodies, Composite, Events, Body, Vector, Constraint } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 0.9; 
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { 
        width, 
        height, 
        wireframes: false, 
        background: '#07080e', 
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    const buildDozerTrack = () => {
      Composite.clear(engine.world, false);
      platformsRef.current = [];
      spinnersRef.current = [];
      
      // Outer Walls
      Composite.add(engine.world, [
        Bodies.rectangle(10, height/2, 20, height, { isStatic: true, render: { fillStyle: '#ffffff' } }),
        Bodies.rectangle(width-10, height/2, 20, height, { isStatic: true, render: { fillStyle: '#ffffff' } }),
      ]);

      // 🛑 SECTION 1: Moving Dozer Platforms & Return Funnels
      for (let i = 0; i < 3; i++) {
        const yPos = 250 + (i * 220);
        
        // ⚡ Shorter Moving Shelves
        const platform = Bodies.rectangle(width / 2, yPos, 260, 24, {
          isStatic: true, 
          friction: 0.8, 
          render: { fillStyle: '#1f2235' }
        });
        platform.initialX = width / 2;
        // Alternating directions
        platform.oscillationSpeed = 0.002; 
        platform.oscillationOffset = i % 2 === 0 ? 0 : Math.PI; 
        platformsRef.current.push(platform);
        Composite.add(engine.world, platform);

        // Scraper Blocks
        Composite.add(engine.world, [
          Bodies.rectangle(140, yPos - 30, 30, 40, { isStatic: true, render: { fillStyle: '#ff0055' } }),
          Bodies.rectangle(width - 140, yPos - 30, 30, 40, { isStatic: true, render: { fillStyle: '#00d2ff' } })
        ]);

        // ⚡ Inward Return Funnels (Pushes marbles falling off edges back to the center)
        Composite.add(engine.world, [
          Bodies.rectangle(80, yPos + 80, 160, 12, { isStatic: true, angle: 0.5, restitution: 0.5, render: { fillStyle: '#ffeb3b' } }),
          Bodies.rectangle(width - 80, yPos + 80, 160, 12, { isStatic: true, angle: -0.5, restitution: 0.5, render: { fillStyle: '#ffeb3b' } })
        ]);
      }

      // 🌪️ SECTION 2: The Chaos Spinner (Deflects marbles above the Jackpot)
      const spinCenter = Bodies.circle(width / 2, 810, 5, { isStatic: true, render: { visible: false } });
      const spinBlade = Bodies.rectangle(width / 2, 810, 130, 16, {
        friction: 0, restitution: 1.2, render: { fillStyle: '#ff0055' } 
      });
      const spinConstraint = Constraint.create({
        bodyA: spinCenter, bodyB: spinBlade, stiffness: 1, length: 0, render: { visible: false }
      });
      Composite.add(engine.world, [spinCenter, spinBlade, spinConstraint]);
      spinnersRef.current.push({ body: spinBlade, speed: 0.1 });

      // 🎯 SECTION 3: Scoring Sensors at the Bottom (y = 940)
      Composite.add(engine.world, [
        // Dead Drains (Sides)
        Bodies.rectangle(80, 940, 160, 40, { isStatic: true, isSensor: true, label: 'dead_zone', render: { fillStyle: '#1f2235' } }),
        Bodies.rectangle(width - 80, 940, 160, 40, { isStatic: true, isSensor: true, label: 'dead_zone', render: { fillStyle: '#1f2235' } }),
        
        // Jackpot Zone (Center)
        Bodies.rectangle(width / 2, 940, 220, 40, { isStatic: true, isSensor: true, label: 'jackpot_zone', render: { fillStyle: '#00ff87' } }),
        
        // Sharp Divider Spikes to separate Jackpot and Drains clearly
        Bodies.polygon(170, 880, 3, 20, { isStatic: true, angle: Math.PI, render: { fillStyle: '#ffffff' } }),
        Bodies.polygon(width - 170, 880, 3, 20, { isStatic: true, angle: Math.PI, render: { fillStyle: '#ffffff' } })
      ]);
    };

    buildDozerTrack();

    Events.on(engine, 'beforeUpdate', () => {
      if (statusRef.current !== 'running') return;
      const time = engine.timing.timestamp;

      // Oscillate Platforms
      platformsRef.current.forEach(p => {
        const targetX = p.initialX + Math.sin(time * p.oscillationSpeed + p.oscillationOffset) * 65;
        Body.setVelocity(p, { x: targetX - p.position.x, y: 0 });
        Body.setPosition(p, { x: targetX, y: p.position.y });
      });

      // Spin Chaos Windmill
      spinnersRef.current.forEach(spinner => {
        Body.setAngularVelocity(spinner.body, spinner.speed);
      });

      // Clamp max velocity
      const allBodies = Composite.allBodies(engine.world);
      allBodies.forEach(b => {
        if (b.label && b.label.startsWith('team_')) {
          const speed = Vector.magnitude(b.velocity);
          if (speed > 13) {
            const clamp = 13 / speed;
            Body.setVelocity(b, { x: b.velocity.x * clamp, y: b.velocity.y * clamp });
          }
        }
      });
    });

    Events.on(engine, 'collisionStart', (event) => {
      if (statusRef.current !== 'running') return;
      
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const sensor = bodyA.isSensor ? bodyA : (bodyB.isSensor ? bodyB : null);
        const marble = bodyA.label.startsWith('team_') ? bodyA : (bodyB.label.startsWith('team_') ? bodyB : null);
        
        if (sensor && marble) {
          if (sensor.label === 'jackpot_zone' && !marble.scored) {
            marble.scored = true;
            const teamIndex = parseInt(marble.label.split('_')[1], 10);
            
            const newScores = [...scoresRef.current];
            newScores[teamIndex] += 10; 
            scoresRef.current = newScores;
            setScores(newScores);
          }
          Composite.remove(engine.world, marble);
        }
      });
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
        ctx.font = 'bold 36px Inter';
        ctx.fillText('DOZER CASCADE', width / 2, height / 2 - 20);
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 18px Inter';
        ctx.fillText('Survive the Chaos Spinner!', width / 2, height / 2 + 30);
      }

      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(7, 8, 14, 0.95)';
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
            ctx.fillStyle = colors[i];
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
          ctx.fillStyle = '#00ff87';
          ctx.font = 'bold 150px Inter';
          ctx.fillText(t, width / 2, height / 2 + 50);
        }
      }

      if (currentStatus === 'running' || currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(7, 8, 14, 0.9)';
        ctx.fillRect(0, 0, width, 100);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 32px Inter';
        ctx.fillText(`⏱️ ${timeRef.current}s`, width / 2, 45);

        ctx.font = 'bold 16px Inter';
        const spacing = width / (active + 1);
        for (let i = 0; i < active; i++) {
          const xPos = spacing * (i + 1);
          ctx.beginPath();
          ctx.arc(xPos - 20, 75, 8, 0, Math.PI * 2);
          ctx.fillStyle = colors[i];
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(`${scoresRef.current[i]}`, xPos - 5, 80);
        }

        ctx.fillStyle = 'rgba(0, 255, 135, 0.2)';
        ctx.fillRect(170, 920, 200, 40);
        ctx.fillStyle = '#00ff87';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('JACKPOT', width/2, 945);
      }

      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(7, 8, 14, 0.95)';
        ctx.fillRect(0, 0, width, height);
        const maxScore = Math.max(...scoresRef.current.slice(0, active));
        const winnerIndex = scoresRef.current.indexOf(maxScore);
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 46px Inter';
        ctx.fillStyle = colors[winnerIndex];
        ctx.fillText(`🏆 ${names[winnerIndex].toUpperCase()}`, width / 2, height / 2 - 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Inter';
        ctx.fillText(`Cashed Out: ${maxScore} Pts!`, width / 2, height / 2 + 30);

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
      clearInterval(spawnTimerRef.current);
    };
  }, []);

  const updateTeamColor = (index, color) => {
    const newColors = [...teamColors];
    newColors[index] = color;
    setTeamColors(newColors);
  };
  const handleNameChange = (index, value) => { 
    const newNames = [...teamNames]; 
    newNames[index] = value; 
    setTeamNames(newNames); 
  };

  const startRecordingSequence = () => {
    setScores([0, 0, 0, 0, 0]);
    scoresRef.current = [0, 0, 0, 0, 0];
    setTimeLeft(30);
    fireworksRef.current = [];
    preGameTimeRef.current = 5; 
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
      a.download = `Dozer-Cascade-${Date.now()}.webm`;
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
        
        let waves = 0;
        const maxWaves = marbleCount * 6; // Adjusted for shorter 30s timer
        
        spawnWave();
        spawnTimerRef.current = setInterval(() => {
          waves++;
          if (waves >= maxWaves) {
            clearInterval(spawnTimerRef.current);
          } else {
            spawnWave();
          }
        }, 800); // ⚡ Faster drop rate for intense pileups
        
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

  const spawnWave = () => {
    if (!engineRef.current) return;
    const { Composite, Bodies, Body } = Matter;
    const newBodies = [];
    
    for (let t = 0; t < activeTeamsRef.current; t++) {
      for (let m = 0; m < 2; m++) {
        const marble = Bodies.circle(width/2 + (Math.random() * 140 - 70), -20, 11, {
          restitution: 0.15,
          friction: 0.5, 
          frictionAir: 0.01,
          label: `team_${t}`,
          render: { fillStyle: teamColorsRef.current[t] }
        });
        
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 3, y: 5 });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);
  };

  const endMatch = () => {
    clearInterval(raceTimerRef.current);
    clearInterval(spawnTimerRef.current);
    changeStatus('finished');

    const maxScore = Math.max(...scoresRef.current.slice(0, activeTeamsRef.current));
    const winIdx = scoresRef.current.indexOf(maxScore);
    const winColor = teamColorsRef.current[winIdx];

    const particles = [];
    for(let i = 0; i < 350; i++) {
      particles.push({
        x: width / 2, y: height / 2,
        vx: (Math.random() - 0.5) * 40, 
        vy: (Math.random() - 0.5) * 40 - 5,
        size: Math.random() * 7 + 2,
        color: Math.random() > 0.4 ? winColor : '#ffffff'
      });
    }
    fireworksRef.current = particles;

    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      changeStatus('idle');
    }, 4500);
  };

  let btnText = 'Start Video Sequence 🔴🎬';
  if (gameStatus === 'countdown') btnText = 'Locking Grid... ⏳';
  if (gameStatus === 'running') btnText = 'Dozer Pushing... 🪙';
  if (gameStatus === 'finished') btnText = 'Saving Video... 🎆';

  return (
    <div className="arena-inner-container">
      <div className="luxury-sidebar">
        <h2 style={{ fontSize: '1.4rem', letterSpacing: '2px', fontWeight: '800', marginBottom: '20px' }}>
          🪙 DOZER CASCADE
        </h2>

        <div className="luxury-control-card">
          <label>ACTIVE PARTICIPANTS: {activeTeams}</label>
          <input type="range" min="2" max="5" value={activeTeams} disabled={gameStatus !== 'idle'} onChange={(e) => setActiveTeams(Number(e.target.value))} />
        </div>

        <div className="luxury-control-card">
          <label>WAVE DENSITY: {marbleCount}</label>
          <input type="range" min="1" max="5" value={marbleCount} disabled={gameStatus !== 'idle'} onChange={(e) => setMarbleCount(Number(e.target.value))} />
        </div>

        <div className="color-selectors" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ color: '#8892b0', fontSize: '11px', fontWeight: 'bold' }}>ROSTER IDENTIFICATION</label>
          {Array.from({ length: activeTeams }).map((_, idx) => (
            <div className="color-picker-row" key={idx}>
              <input type="color" value={teamColors[idx]} disabled={gameStatus !== 'idle'} onChange={(e) => updateTeamColor(idx, e.target.value)} />
              <input type="text" value={teamNames[idx] || ''} placeholder={`Squad ${idx + 1}`} disabled={gameStatus !== 'idle'} onChange={(e) => handleNameChange(idx, e.target.value)} style={{ flex: 1, padding: '6px', background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', fontWeight: '600', outline: 'none' }} />
            </div>
          ))}
        </div>

        <button 
          className={`btn-action ${gameStatus === 'idle' ? 'btn-record' : 'btn-active-state'}`} 
          onClick={startRecordingSequence}
          disabled={gameStatus !== 'idle'}
        >
          {btnText}
        </button>
      </div>

      <div className="simulation-viewport">
        <div className="canvas-frame-container" ref={sceneRef} style={{ width: '540px', height: '960px', backgroundColor: '#07080e', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }} />
      </div>
    </div>
  );
}