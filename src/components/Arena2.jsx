import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena2() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  const raceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // --- STATE ---
  const [activeTeams, setActiveTeams] = useState(5);
  const [marbleCount, setMarbleCount] = useState(2); // Default to 2 for chaos
  const [teamColors, setTeamColors] = useState(['#00ff87', '#ff0055', '#ffeb3b', '#00d2ff', '#b700ff']);
  
  const [gameStatus, setGameStatus] = useState('idle');
  const [scores, setScores] = useState([0, 0, 0, 0, 0]);
  const [timeLeft, setTimeLeft] = useState(30);

  const scoresRef = useRef([0, 0, 0, 0, 0]);
  const timeRef = useRef(30);
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(5);
  const teamColorsRef = useRef(teamColors);
  const preGameTimeRef = useRef(5);
  const fireworksRef = useRef([]);

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
    engine.world.gravity.y = 1.3; // Activating Earth Gravity
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { width, height, wireframes: false, background: '#12131c' }
    });
    renderRef.current = render;

    // 1. Build Outer Wall Boundaries
    const walls = [
      Bodies.rectangle(10, height / 2, 20, height, { isStatic: true, render: { fillStyle: '#ffffff' } }), // Left Wall
      Bodies.rectangle(width - 10, height / 2, 20, height, { isStatic: true, render: { fillStyle: '#ffffff' } }), // Right Wall
    ];
    Composite.add(engine.world, walls);

    // 2. Build Staggered Plinko Peg Grid Layout
    const rows = 11;
    const pegRadius = 5;
    const boundaryBodies = [];

    for (let r = 0; r < rows; r++) {
      const isEven = r % 2 === 0;
      const cols = isEven ? 9 : 8;
      const spacingX = width / 9;
      const startX = isEven ? spacingX / 2 : spacingX;
      const startY = 160 + r * 50; // Centered vertically in the drop zone

      for (let c = 0; c < cols; c++) {
        boundaryBodies.push(
          Bodies.circle(startX + c * spacingX, startY, pegRadius, {
            isStatic: true,
            restitution: 0.8,
            render: { fillStyle: '#4e54c8' } // Glowing Blue Pegs
          })
        );
      }
    }

    // 3. Build Multiplier Buckets Dividers at the Bottom
    const bucketY = height - 120;
    const bucketCount = 5;
    const bucketWidth = width / bucketCount;

    for (let i = 1; i < bucketCount; i++) {
      boundaryBodies.push(
        Bodies.rectangle(i * bucketWidth, height - 60, 6, 120, { 
          isStatic: true, 
          render: { fillStyle: '#ffffff' } 
        })
      );
    }
    Composite.add(engine.world, boundaryBodies);

    // Define multiplier rewards values for each bucket index
    const multipliers = [10, 1, 100, 1, 10]; 

    // 4. Bulletproof Scoring System (Frame-by-Frame Zone Detection)
    Events.on(engine, 'afterUpdate', () => {
      if (statusRef.current !== 'running') return;

      const allBodies = Composite.allBodies(engine.world);
      
      allBodies.forEach((marble) => {
        if (marble.label && marble.label.startsWith('team_')) {
          
          // Check if marble crosses the laser tripwire (bucket height)
          if (marble.position.y > bucketY) {
            
            // Calculate which bucket it landed in based on its X position
            const bucketIndex = Math.floor(marble.position.x / bucketWidth);
            // Safety clamp to ensure bucket index doesn't go out of bounds
            const safeIndex = Math.max(0, Math.min(bucketIndex, bucketCount - 1));
            
            const scoreWeight = multipliers[safeIndex];
            const teamIndex = parseInt(marble.label.split('_')[1], 10);

            // 1. Add the Score
            const newScores = [...scoresRef.current];
            newScores[teamIndex] += scoreWeight;
            scoresRef.current = newScores;
            setScores(newScores); // Update React UI

            // 2. Instant Teleport back to the drop zone
            Matter.Body.setPosition(marble, { 
              x: 60 + Math.random() * (width - 120), 
              y: 110 
            });
            Matter.Body.setVelocity(marble, { x: (Math.random() - 0.5) * 2, y: 0 });
          }
        }
      });
    });

    // --- DRAW PLINKO CANVAS UI HUCK SYSTEMS ---
    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const colors = teamColorsRef.current;
      const active = activeTeamsRef.current;

      // 1. Draw Countdown & Selection Screen
      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        
        if (t > 3) {
          ctx.font = 'bold 45px Inter';
          ctx.fillText('SELECT A TEAM!', width / 2, height / 2 - 160);
          ctx.font = 'bold 30px Inter';
          for (let i = 0; i < active; i++) {
            const yPos = height / 2 - 60 + (i * 55);
            ctx.beginPath();
            ctx.arc(width / 2 - 80, yPos - 10, 16, 0, Math.PI * 2);
            ctx.fillStyle = colors[i];
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

      // 2. Draw HUDs & Multiplier Labels
      if (currentStatus === 'running' || currentStatus === 'finished') {
        // Top HUD Timer
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, width, 85);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 42px Inter';
        ctx.fillText(`⏱️ ${timeRef.current}s`, width / 2, 58);

        // Render Multiplier Text Indicators over Buckets
        ctx.font = 'bold 26px Inter';
        multipliers.forEach((val, i) => {
          ctx.fillStyle = val === 100 ? '#ff0055' : val === 10 ? '#ffb700' : '#888';
          ctx.textAlign = 'center';
          ctx.fillText(`x${val}`, (i * bucketWidth) + bucketWidth / 2, height - 125);
        });

        // Bottom HUD Scores
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, height - 90, width, 90);
        ctx.font = 'bold 24px Inter';
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
          ctx.fillText(`${scoresRef.current[i]}`, xPos - 2, yPos);
        }
      }

      // 3. Draw Winner Screen
      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, width, height);
        const maxScore = Math.max(...scoresRef.current.slice(0, active));
        const winnerIndex = scoresRef.current.indexOf(maxScore);
        
        ctx.textAlign = 'center';
        ctx.font = 'bold 50px Inter';
        ctx.fillStyle = colors[winnerIndex];
        ctx.fillText(`🏆 TEAM ${winnerIndex + 1} WINS!`, width / 2, height / 2 - 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Inter';
        ctx.fillText(`Score: ${maxScore}`, width / 2, height / 2 + 30);

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

    return () => {
      Render.stop(render);
      render.canvas.remove();
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

  const startRecordingSequence = () => {
    setScores([0, 0, 0, 0, 0]);
    scoresRef.current = [0, 0, 0, 0, 0];
    setTimeLeft(30);
    fireworksRef.current = [];
    preGameTimeRef.current = 5; 
    setGameStatus('countdown');

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
      a.download = `Plinko-Battle-${Date.now()}.webm`;
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
        spawnPlinkoMarbles();
        
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

  const spawnPlinkoMarbles = () => {
    const { Composite, Bodies, Body } = Matter;
    const newBodies = [];
    
    for (let t = 0; t < activeTeamsRef.current; t++) {
      for (let m = 0; m < marbleCount; m++) {
        const marble = Bodies.circle(100 + Math.random() * (width - 200), 100 + (m * 25), 11, {
          restitution: 0.6,
          friction: 0.001,
          label: `team_${t}`,
          render: { fillStyle: teamColorsRef.current[t] }
        });
        
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 4, y: 0 });
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

    const maxScore = Math.max(...scoresRef.current.slice(0, activeTeamsRef.current));
    const winIdx = scoresRef.current.indexOf(maxScore);
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
      setGameStatus('idle');
    }, 4000);
  };

  let btnText = 'Start Plinko Sequence 🔴🎬';
  if (gameStatus === 'countdown') btnText = 'Counting Down... ⏳';
  if (gameStatus === 'running') btnText = 'Drop Active... ⏱️';
  if (gameStatus === 'finished') btnText = 'Saving Video... 🎆';

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>⚔️ Plinko Mode</h2>
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