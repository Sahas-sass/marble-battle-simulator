import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // --- STATE ---
  const [activeTeams, setActiveTeams] = useState(2);
  const [marbleCount, setMarbleCount] = useState(1);
  const [teamColors, setTeamColors] = useState(['#00ff87', '#ff0055', '#00d2ff', '#ffb700', '#b700ff']);
  
  const [gameStatus, setGameStatus] = useState('idle'); // 'idle' | 'running' | 'finished'
  const [scores, setScores] = useState([0, 0, 0, 0, 0]);
  const [timeLeft, setTimeLeft] = useState(30);

  // --- REFS FOR MATTER.JS RENDER LOOP ---
  // (We need refs because Matter.js event listeners don't always get fresh React state)
  const scoresRef = useRef([0, 0, 0, 0, 0]);
  const timeRef = useRef(30);
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(2);
  const teamColorsRef = useRef(teamColors);

  const width = 540;
  const height = 960;

  // Sync state to refs for the canvas renderer
  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { teamColorsRef.current = teamColors; }, [teamColors]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { timeRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { statusRef.current = gameStatus; }, [gameStatus]);

  useEffect(() => {
    const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 0;
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width, height,
        wireframes: false,
        background: '#12131c'
      }
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
          { isStatic: true, angle: angle, render: { fillStyle: '#ffffff' } }
        )
      );
    }
    Composite.add(engine.world, boundaryBodies);

    // Collision Scoring
    Events.on(engine, 'collisionStart', (event) => {
      if (statusRef.current !== 'running') return;

      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.isStatic || bodyB.isStatic) {
          const marble = bodyA.isStatic ? bodyB : bodyA;
          if (marble.label.startsWith('team_')) {
            const teamIndex = parseInt(marble.label.split('_')[1], 10);
            
            // Update ref and state
            const newScores = [...scoresRef.current];
            newScores[teamIndex]++;
            scoresRef.current = newScores;
            setScores(newScores);
          }
        }
      });
    });

    // --- DRAW TEXT ON VIDEO CANVAS ---
    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const tLeft = timeRef.current;
      const currentScores = scoresRef.current;
      const active = activeTeamsRef.current;
      const colors = teamColorsRef.current;

      ctx.textAlign = 'left';
      ctx.font = 'bold 20px Inter, sans-serif';

      if (currentStatus === 'running' || currentStatus === 'finished') {
        // Draw Timer
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px Inter';
        ctx.fillText(`⏱️ ${tLeft}s`, width / 2, 60);

        // Draw Scoreboard
        ctx.textAlign = 'left';
        ctx.font = 'bold 22px Inter';
        for (let i = 0; i < active; i++) {
          ctx.fillStyle = colors[i];
          ctx.fillText(`Team ${i + 1}: ${currentScores[i]}`, 30, 50 + (i * 35));
        }
      }

      // Draw Winner Screen
      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);
        
        // Find highest score
        const maxScore = Math.max(...currentScores.slice(0, active));
        const winnerIndex = currentScores.indexOf(maxScore);

        ctx.textAlign = 'center';
        ctx.font = 'bold 45px Inter';
        ctx.fillStyle = colors[winnerIndex];
        ctx.fillText(`🏆 TEAM ${winnerIndex + 1} WINS!`, width / 2, height / 2 - 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Inter';
        ctx.fillText(`Score: ${maxScore}`, width / 2, height / 2 + 30);
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
      clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Update a specific team's color
  const updateTeamColor = (index, color) => {
    const newColors = [...teamColors];
    newColors[index] = color;
    setTeamColors(newColors);
  };

  // 1. START RACE & RECORDING
  const startRaceAndRecording = () => {
    // Reset Scores & Time
    setScores([0, 0, 0, 0, 0]);
    scoresRef.current = [0, 0, 0, 0, 0];
    setTimeLeft(30);
    setGameStatus('running');

    // Clear old marbles
    const { Composite, Bodies, Body } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    const marbles = allBodies.filter((b) => !b.isStatic);
    marbles.forEach((b) => Composite.remove(engineRef.current.world, b));

    // Start Recording
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

    // Drop Marbles
    const center = { x: width / 2, y: height / 2 };
    const newBodies = [];
    
    for (let t = 0; t < activeTeams; t++) {
      for (let m = 0; m < marbleCount; m++) {
        const marble = Bodies.circle(center.x + (Math.random() * 40 - 20), center.y + (Math.random() * 40 - 20), 12, {
          restitution: 1.02, friction: 0, frictionAir: 0,
          label: `team_${t}`,
          render: { fillStyle: teamColors[t] }
        });
        
        Body.setVelocity(marble, { 
          x: (Math.random() - 0.5) * 15, 
          y: (Math.random() - 0.5) * 15 
        });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);

    // Start Timer
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endRace();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 2. END RACE
  const endRace = () => {
    clearInterval(timerIntervalRef.current);
    setGameStatus('finished');

    // Remove physics balls to freeze the screen
    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    const marbles = allBodies.filter((b) => !b.isStatic);
    marbles.forEach((b) => Composite.remove(engineRef.current.world, b));

    // Wait 2.5 seconds to show winner screen, then stop recording and download
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setGameStatus('idle');
    }, 2500);
  };

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
          onClick={startRaceAndRecording}
          disabled={gameStatus !== 'idle'}
          style={{ marginTop: '20px' }}
        >
          {gameStatus === 'idle' ? 'Start Race & Recording 🔴🏁' : 'Race in Progress... ⏱️'}
        </button>

      </div>
      <div className="stage-wrapper"><div className="canvas-container" ref={sceneRef} /></div>
    </div>
  );
}