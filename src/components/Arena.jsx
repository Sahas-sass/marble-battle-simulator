import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // --- CUSTOMIZABLE UI STATES ---
  const [team1Color, setTeam1Color] = useState('#00ff87');
  const [team2Color, setTeam2Color] = useState('#ff0055');
  const [marbleCount, setMarbleCount] = useState(1);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [isRecording, setIsRecording] = useState(false);

  // Canvas Dimensions (9:16 vertical ratio)
  const width = 540;
  const height = 960;

  useEffect(() => {
    const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;

    // 1. Initialize Physics Engine
    const engine = Engine.create();
    engine.world.gravity.y = 0; // Zero gravity for top-down bounce simulation
    engineRef.current = engine;

    // 2. Initialize Renderer
    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: width,
        height: height,
        wireframes: false,
        background: '#12131c'
      }
    });
    renderRef.current = render;

    // 3. Build Circular Ring Boundary (Expanded Radius, Thinner Thickness)
    const arenaRadius = 255; // Enlarged arena size
    const center = { x: width / 2, y: height / 2 };
    const segments = 72; // Increased segments for smoother circle
    const wallThickness = 6; // Reduced wall thickness
    const boundaryBodies = [];

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * arenaRadius;
      const y = center.y + Math.sin(angle) * arenaRadius;

      const segment = Bodies.rectangle(x, y, 26, wallThickness, {
        isStatic: true,
        angle: angle,
        render: { fillStyle: '#ffffff' }
      });
      boundaryBodies.push(segment);
    }
    Composite.add(engine.world, boundaryBodies);

    // 4. Collision Listener for Scoring
    Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        if (bodyA.isStatic || bodyB.isStatic) {
          const marble = bodyA.isStatic ? bodyB : bodyA;

          if (marble.label === 'team1') {
            setScores((prev) => ({ ...prev, team1: prev.team1 + 1 }));
          } else if (marble.label === 'team2') {
            setScores((prev) => ({ ...prev, team2: prev.team2 + 1 }));
          }
        }
      });
    });

    // 5. Start Engine & Renderer
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    return () => {
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(engine.world);
      Engine.clear(engine);
    };
  }, []);

  // Spawn Marbles according to selected quantity, size, and colors
  const spawnMarbles = () => {
    const { Bodies, Composite, Body } = Matter;
    const center = { x: width / 2, y: height / 2 };
    const marbleRadius = 12; // Smaller marble size
    const newBodies = [];

    for (let i = 0; i < marbleCount; i++) {
      // Offset starting positions slightly if spawning multiple marbles
      const offsetY = (i - (marbleCount - 1) / 2) * (marbleRadius * 2.2);

      const team1 = Bodies.circle(center.x - 70, center.y + offsetY, marbleRadius, {
        restitution: 1.02,
        friction: 0,
        frictionAir: 0,
        label: 'team1',
        render: { fillStyle: team1Color }
      });

      const team2 = Bodies.circle(center.x + 70, center.y + offsetY, marbleRadius, {
        restitution: 1.02,
        friction: 0,
        frictionAir: 0,
        label: 'team2',
        render: { fillStyle: team2Color }
      });

      // Randomize initial velocities slightly for multi-marble chaos
      const speedX1 = -(5 + Math.random() * 3);
      const speedY1 = (Math.random() - 0.5) * 6;
      const speedX2 = 5 + Math.random() * 3;
      const speedY2 = (Math.random() - 0.5) * 6;

      Body.setVelocity(team1, { x: speedX1, y: speedY1 });
      Body.setVelocity(team2, { x: speedX2, y: speedY2 });

      newBodies.push(team1, team2);
    }

    Composite.add(engineRef.current.world, newBodies);
  };

  // Reset arena score & clear objects
  const resetArena = () => {
    const { Composite } = Matter;
    const allBodies = Composite.allBodies(engineRef.current.world);
    const nonStaticBodies = allBodies.filter((body) => !body.isStatic);
    nonStaticBodies.forEach((body) => Composite.remove(engineRef.current.world, body));
    setScores({ team1: 0, team2: 0 });
  };

  // MP4 Media Recording Setup
  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      const canvas = sceneRef.current.querySelector('canvas');
      const stream = canvas.captureStream(60);

      // Determine supported MP4 MIME type
      const mimeTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9' // Fallback for older browsers
      ];
      
      const selectedMimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/mp4';
      const fileExtension = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Marble-Battle-${Date.now()}.${fileExtension}`;
        a.click();
        URL.revokeObjectURL(url);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  };

  return (
    <div className="app-container">
      {/* Control Sidebar */}
      <div className="sidebar">
        <h2>⚔️ Battle Simulator</h2>

        {/* Customization Controls */}
        <div className="control-group">
          <label>Marbles Per Team: {marbleCount}</label>
          <input
            type="range"
            min="1"
            max="10"
            value={marbleCount}
            onChange={(e) => setMarbleCount(Number(e.target.value))}
          />
        </div>

        <div className="color-selectors">
          <div className="color-picker">
            <label>Team 1 Color</label>
            <input
              type="color"
              value={team1Color}
              onChange={(e) => setTeam1Color(e.target.value)}
            />
          </div>
          <div className="color-picker">
            <label>Team 2 Color</label>
            <input
              type="color"
              value={team2Color}
              onChange={(e) => setTeam2Color(e.target.value)}
            />
          </div>
        </div>

        <button className="btn btn-primary" onClick={spawnMarbles}>
          Drop Marbles 🏁
        </button>

        <button className="btn btn-secondary" onClick={resetArena}>
          Reset Arena 🔄
        </button>

        <button
          className={`btn ${isRecording ? 'btn-record' : 'btn-success'}`}
          onClick={toggleRecording}
        >
          {isRecording ? 'Stop & Save MP4 ⏹️' : 'Start Recording MP4 🔴'}
        </button>

        {/* Live Scoreboard */}
        <div className="scoreboard">
          <p style={{ margin: '0 0 8px 0', color: '#aaa', fontSize: '0.9rem' }}>
            Live Bounce Counter
          </p>
          <div className="team-score" style={{ color: team1Color }}>
            Team 1: {scores.team1}
          </div>
          <div className="team-score" style={{ color: team2Color }}>
            Team 2: {scores.team2}
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="stage-wrapper">
        <div className="canvas-container" ref={sceneRef} />
      </div>
    </div>
  );
}