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
  const [scores, setScores] = useState([0, 0, 0, 0, 0]); 
  const [timeLeft, setTimeLeft] = useState(45); 

  // --- REFS ---
  const scoresRef = useRef([0, 0, 0, 0, 0]);
  const timeRef = useRef(45);
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(5);
  const teamColorsRef = useRef(teamColors);
  const teamNamesRef = useRef(teamNames);
  const preGameTimeRef = useRef(5);
  const fireworksRef = useRef([]);
  const spinnersRef = useRef([]); 
  
  const cameraTargetYRef = useRef(0);
  const leaderIndexRef = useRef(null); 

  const width = 540;
  const height = 960; 
  const totalTrackHeight = 4200; 
  const finishLineY = totalTrackHeight - 150;

  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { teamColorsRef.current = teamColors; }, [teamColors]);
  useEffect(() => { teamNamesRef.current = teamNames; }, [teamNames]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const { Engine, Render, Runner, Bodies, Composite, Events, Body, Vector, Bounds } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 0.45; 
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { 
        width, 
        height, 
        wireframes: false, 
        background: '#0a0a0f',
        hasBounds: true 
      }
    });
    renderRef.current = render;

    // 🛡️ Ensure canvas element forces explicit dimensions so it never goes blank
    if (render.canvas) {
      render.canvas.width = width;
      render.canvas.height = height;
      render.canvas.style.width = `${width}px`;
      render.canvas.style.height = `${height}px`;
    }

    render.bounds.min.x = 0;
    render.bounds.max.x = width;
    render.bounds.min.y = 0;
    render.bounds.max.y = height;
    Bounds.update(render.bounds, render.options.hasBounds);

    const buildMegaTrack = () => {
      if (!engineRef.current) return;
      Composite.clear(engineRef.current.world, false);
      spinnersRef.current = [];
      cameraTargetYRef.current = 0;
      leaderIndexRef.current = null;

      render.bounds.min.y = 0;
      render.bounds.max.y = height;
      Bounds.update(render.bounds, render.options.hasBounds);

      Composite.add(engineRef.current.world, [
        Bodies.rectangle(-20, totalTrackHeight/2, 40, totalTrackHeight, { isStatic: true, friction: 0 }),
        Bodies.rectangle(width+20, totalTrackHeight/2, 40, totalTrackHeight, { isStatic: true, friction: 0 }),
      ]);

      // Zone 1: ZigZags & Spinners
      for (let i = 0; i < 6; i++) {
        const isLeft = i % 2 === 0;
        const yPos = 400 + (i * 250);
        
        const slope = Bodies.rectangle(isLeft ? 140 : width - 140, yPos, 420, 16, {
          isStatic: true, angle: isLeft ? 0.3 : -0.3, friction: 0.01, render: { fillStyle: '#ffffff' }
        });
        
        const spinX = isLeft ? width - 80 : 80;
        const spinY = yPos + 80;
        const spinCenter = Bodies.circle(spinX, spinY, 4, { isStatic: true, render: { visible: false } });
        const spinBlade = Bodies.rectangle(spinX, spinY, 130, 14, {
          friction: 0, restitution: 0.6, render: { fillStyle: '#b700ff' } 
        });
        const spinConstraint = Matter.Constraint.create({
          bodyA: spinCenter, bodyB: spinBlade, stiffness: 1, length: 0, render: { visible: false }
        });

        Composite.add(engineRef.current.world, [slope, spinCenter, spinBlade, spinConstraint]);
        spinnersRef.current.push({ body: spinBlade, speed: isLeft ? 0.05 : -0.05 });
      }

      // Zone 2: Plinko Pegs
      const pegs = [];
      for (let row = 0; row < 12; row++) {
        const isEven = row % 2 === 0;
        const cols = isEven ? 6 : 7;
        const spacing = width / 7;
        const startX = isEven ? spacing : spacing / 2;
        const yPos = 1900 + (row * 80);

        for (let col = 0; col < cols; col++) {
          pegs.push(Bodies.circle(startX + (col * spacing), yPos, 10, {
            isStatic: true, restitution: 0.8, render: { fillStyle: '#00d2ff' }
          }));
        }
      }
      Composite.add(engineRef.current.world, pegs);

      // Zone 3: Funnels
      Composite.add(engineRef.current.world, [
        Bodies.rectangle(120, 3100, 300, 20, { isStatic: true, angle: 0.5, render: { fillStyle: '#ffeb3b' } }),
        Bodies.rectangle(width - 120, 3100, 300, 20, { isStatic: true, angle: -0.5, render: { fillStyle: '#ffeb3b' } }),
        Bodies.rectangle(width/2, 3400, 150, 20, { isStatic: true, render: { fillStyle: '#ff0055' } }),
      ]);

      const finishLine = Bodies.rectangle(width/2, finishLineY, width, 12, {
        isStatic: true, isSensor: true, render: { fillStyle: '#00ff87' }
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
      let activeMarbles = 0;

      allBodies.forEach(b => {
        if (b && b.label && b.label.startsWith('team_')) {
          activeMarbles++;
          
          const speed = Vector.magnitude(b.velocity);
          if (speed > 7) {
            const clamp = 7 / speed;
            Body.setVelocity(b, { x: b.velocity.x * clamp, y: b.velocity.y * clamp });
          }

          if (b.position.y > finishLineY && !b.hasFinished) {
            b.hasFinished = true;
            const teamIndex = parseInt(b.label.split('_')[1], 10);
            const newScores = [...scoresRef.current];
            const totalCrossed = allBodies.filter(m => m.hasFinished).length;
            
            newScores[teamIndex] += totalCrossed === 1 ? 50 : totalCrossed === 2 ? 30 : 10;
            scoresRef.current = newScores;
            setScores(newScores);
          }
        }
      });

      if (activeMarbles > 0 && allBodies.filter(b => b.label.startsWith('team_') && !b.hasFinished).length === 0) {
        endRace();
      }
    });

    // 🎥 CAMERA TRACKING
    Events.on(render, 'beforeRender', () => {
      const allBodies = Composite.allBodies(engine.world);
      const marbles = allBodies.filter(b => b.label.startsWith('team_') && !b.hasFinished);

      if (statusRef.current === 'countdown' || statusRef.current === 'idle') {
        cameraTargetYRef.current = 0; 
      } else if (statusRef.current === 'finished') {
        cameraTargetYRef.current = totalTrackHeight - height; 
      } else if (marbles.length > 0) {
        let maxMarbleY = Math.max(...marbles.map(m => m.position.y));
        const leader = marbles.find(m => m.position.y === maxMarbleY);
        if (leader) leaderIndexRef.current = parseInt(leader.label.split('_')[1], 10);

        let targetY = maxMarbleY - (height * 0.45);
        targetY = Math.max(0, Math.min(targetY, totalTrackHeight - height));
        cameraTargetYRef.current += (targetY - cameraTargetYRef.current) * 0.1;
      }

      render.bounds.min.x = 0;
      render.bounds.max.x = width;
      render.bounds.min.y = cameraTargetYRef.current;
      render.bounds.max.y = cameraTargetYRef.current + height;
      
      Bounds.update(render.bounds, render.options.hasBounds);
    });

    // 🎨 UI OVERLAYS
    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const colors = teamColorsRef.current;
      const names = teamNamesRef.current;
      const active = activeTeamsRef.current;
      
      const viewY = render.bounds.min.y; 

      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(7, 8, 14, 0.95)';
        ctx.fillRect(0, viewY, width, height);
        
        ctx.textAlign = 'center';
        
        if (t > 3) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 36px Inter';
          ctx.fillText('PICK YOUR TEAM!', width / 2, viewY + 160);

          for (let i = 0; i < active; i++) {
            const yPos = viewY + 240 + (i * 60);
            
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
          ctx.font = 'bold 160px Inter';
          ctx.fillText(t, width / 2, viewY + height / 2 + 50);
        }
      }

      if (currentStatus === 'running') {
        ctx.fillStyle = 'rgba(7, 8, 14, 0.85)';
        ctx.fillRect(0, viewY, width, 75);
        
        ctx.textAlign = 'center';
        if (leaderIndexRef.current !== null) {
           ctx.fillStyle = '#8892b0';
           ctx.font = '700 14px Inter';
           ctx.fillText(`CURRENT LEADER`, width / 2, viewY + 26);
           
           ctx.fillStyle = colors[leaderIndexRef.current];
           ctx.font = 'bold 24px Inter';
           ctx.fillText(`${names[leaderIndexRef.current].toUpperCase()}`, width / 2, viewY + 56);
        }
      }

      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(7, 8, 14, 0.92)';
        ctx.fillRect(0, viewY, width, height);
        
        const maxScore = Math.max(...scoresRef.current.slice(0, active));
        let winnerIndex = scoresRef.current.indexOf(maxScore);
        
        ctx.textAlign = 'center';
        if (maxScore > 0) {
          ctx.fillStyle = colors[winnerIndex] || '#fff';
          ctx.font = 'bold 44px Inter';
          ctx.fillText(`${names[winnerIndex].toUpperCase()}`, width / 2, viewY + height / 2 - 30);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 32px Inter';
          ctx.fillText(`WINS THE RACE! 🏆`, width / 2, viewY + height / 2 + 25);
        }

        fireworksRef.current.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, viewY + p.y, p.size, 0, Math.PI * 2);
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

    window.rebuildTrackArena = buildMegaTrack;
    
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
      delete window.rebuildTrackArena;
    };
  }, []);

  const handleNameChange = (index, value) => {
    const newNames = [...teamNames];
    newNames[index] = value;
    setTeamNames(newNames);
  };

  const updateTeamColor = (index, color) => {
    const newColors = [...teamColors];
    newColors[index] = color;
    setTeamColors(newColors);
  };

  const startRecordingSequence = () => {
    if (window.rebuildTrackArena) window.rebuildTrackArena();

    setScores([0, 0, 0, 0, 0]);
    scoresRef.current = [0, 0, 0, 0, 0];
    setTimeLeft(45); 
    fireworksRef.current = [];
    preGameTimeRef.current = 5; 
    setGameStatus('countdown');

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
      a.download = `Mega-Race-${Date.now()}.webm`;
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
        spawnRacingMarbles();
        
        maxMatchTimerRef.current = setInterval(() => {
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

  const spawnRacingMarbles = () => {
    const { Composite, Bodies, Body } = Matter;
    const newBodies = [];
    
    for (let t = 0; t < activeTeamsRef.current; t++) {
      for (let m = 0; m < marbleCount; m++) {
        const marble = Bodies.circle(width/2 + (Math.random() * 80 - 40), 100, 12, {
          restitution: 0.5,
          friction: 0.01,
          frictionAir: 0.02,
          label: `team_${t}`,
          render: { fillStyle: teamColorsRef.current[t] }
        });
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 2, y: 1 });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);
  };

  const endRace = () => {
    clearInterval(maxMatchTimerRef.current);
    setGameStatus('finished');

    const maxScore = Math.max(...scoresRef.current.slice(0, activeTeamsRef.current));
    let winnerIndex = scoresRef.current.indexOf(maxScore);
    const winColor = maxScore > 0 ? teamColorsRef.current[winnerIndex] : '#ffffff';

    const particles = [];
    for(let i = 0; i < 300; i++) {
      particles.push({
        x: width / 2 + (Math.random() * 100 - 50), 
        y: height / 2 + (Math.random() * 100 - 50), 
        vx: (Math.random() - 0.5) * 28, 
        vy: (Math.random() - 0.5) * 28 - 5,
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

  let btnText = '⚡ Launch Race Sequence';
  if (gameStatus === 'countdown') btnText = '⏳ Locking Positions...';
  if (gameStatus === 'running') btnText = '🏁 Tracking Live...';
  if (gameStatus === 'finished') btnText = '🎆 Compiling Master File...';

  return (
    <div className="arena-inner-container">
      <div className="luxury-sidebar">
        <div className="brand-header">
          <span className="brand-dot"></span>
          <h2>RACE CONTROLLER</h2>
        </div>
        
        <div className="control-card">
          <div className="slider-header">
            <label>ACTIVE PARTICIPANTS</label>
            <span className="slider-badge">{activeTeams} Teams</span>
          </div>
          <input type="range" min="2" max="5" value={activeTeams} disabled={gameStatus !== 'idle'} onChange={(e) => setActiveTeams(Number(e.target.value))} className="modern-slider" />
        </div>

        <div className="control-card">
          <div className="slider-header">
            <label>MARBLES PER SQUAD</label>
            <span className="slider-badge">{marbleCount} Node</span>
          </div>
          <input type="range" min="1" max="5" value={marbleCount} disabled={gameStatus !== 'idle'} onChange={(e) => setMarbleCount(Number(e.target.value))} className="modern-slider" />
        </div>
        
        <div className="team-customizer-list">
          <label className="section-title">ROSTER IDENTIFICATION</label>
          {Array.from({ length: activeTeams }).map((_, idx) => (
            <div className="luxury-team-row" key={idx}>
              <div className="color-swatch-wrapper">
                <input type="color" value={teamColors[idx]} disabled={gameStatus !== 'idle'} onChange={(e) => updateTeamColor(idx, e.target.value)} />
                <div className="swatch-overlay" style={{ backgroundColor: teamColors[idx] }}></div>
              </div>
              <input type="text" value={teamNames[idx] || ''} placeholder={`Squad ${idx + 1}`} disabled={gameStatus !== 'idle'} onChange={(e) => handleNameChange(idx, e.target.value)} className="luxury-text-input" />
            </div>
          ))}
        </div>

        <button className={`action-btn-primary ${gameStatus !== 'idle' ? 'btn-active-state' : ''}`} onClick={startRecordingSequence} disabled={gameStatus !== 'idle'}>
          {btnText}
        </button>
      </div>

      <div className="simulation-viewport">
        {/* ⚡ Explicitly constrained wrapper to block canvas dimension collapsing */}
        <div className="canvas-frame-container" ref={sceneRef} style={{ width: '540px', height: '960px' }} />
      </div>
    </div>
  );
}