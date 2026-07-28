import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function Arena8() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);

  const countdownTimerRef = useRef(null);

  // --- STATE ---
  const [launchPower, setLaunchPower] = useState(5); // Controls truck mass & speed
  const [jointStrength, setJointStrength] = useState(5); 
  const [gameStatus, setGameStatus] = useState('idle');

  // --- REFS ---
  const statusRef = useRef('idle');
  const powerRef = useRef(5);
  const strengthRef = useRef(5);
  const bridgeConstraintsRef = useRef([]);
  const particlesRef = useRef([]);
  const preGameTimeRef = useRef(5);

  const width = 540;
  const height = 960;

  const changeStatus = (newStatus) => {
    statusRef.current = newStatus;
    setGameStatus(newStatus);
  };

  useEffect(() => { powerRef.current = launchPower; }, [launchPower]);
  useEffect(() => { strengthRef.current = jointStrength; }, [jointStrength]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.innerHTML = ''; 

    const { Engine, Render, Runner, Bodies, Composite, Events, Vector, Constraint, Body } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 1.0; 
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width,
        height,
        wireframes: false,
        background: '#090a10',
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    const buildEnvironment = () => {
      Composite.clear(engine.world, false);
      bridgeConstraintsRef.current = [];
      particlesRef.current = [];

      // 🪨 Support Cliffs
      const leftCliff = Bodies.rectangle(45, 650, 110, 200, { isStatic: true, render: { fillStyle: '#1f2235' } });
      const rightCliff = Bodies.rectangle(width - 45, 650, 110, 200, { isStatic: true, render: { fillStyle: '#1f2235' } });
      
      // 🚀 The Launch Ramp (Top Left)
      const ramp = Bodies.rectangle(120, 350, 260, 20, { 
        isStatic: true, 
        angle: 0.35, // Angled downwards towards the bridge
        friction: 0.01,
        render: { fillStyle: '#ff0055' } 
      });
      Composite.add(engine.world, [leftCliff, rightCliff, ramp]);

      // 🌉 The Bridge Planks
      const plankWidth = 26;
      const plankHeight = 12;
      const startX = 110;
      const endX = width - 110;
      const totalSpan = endX - startX;
      const numPlanks = Math.floor(totalSpan / (plankWidth + 2));
      const actualSpacing = totalSpan / numPlanks;

      const planks = [];
      for (let i = 0; i <= numPlanks; i++) {
        const pX = startX + (i * actualSpacing);
        const normalizedPosition = (i / numPlanks) * 2 - 1; 
        const pY = 550 + (normalizedPosition * normalizedPosition * 20); // Sag curve

        const plank = Bodies.rectangle(pX, pY, plankWidth, plankHeight, {
          friction: 0.8,
          density: 0.002, 
          restitution: 0.1,
          label: 'bridge_plank',
          render: { fillStyle: '#e2a85c' } 
        });
        planks.push(plank);
        Composite.add(engine.world, plank);
      }

      // 🔗 Link Bridge Constraints
      for (let i = 0; i < planks.length - 1; i++) {
        const bridgeJoint = Constraint.create({
          bodyA: planks[i],
          bodyB: planks[i + 1],
          pointA: { x: plankWidth / 2, y: 0 },
          pointB: { x: -plankWidth / 2, y: 0 },
          stiffness: 0.95, 
          length: actualSpacing - plankWidth,
          render: { visible: true, lineWidth: 4, strokeStyle: '#00ff00' } 
        });
        bridgeConstraintsRef.current.push(bridgeJoint);
        Composite.add(engine.world, bridgeJoint);
      }

      // Anchor End Points
      const leftAnchor = Constraint.create({
        bodyA: leftCliff, bodyB: planks[0],
        pointA: { x: 55, y: -90 }, pointB: { x: -plankWidth / 2, y: 0 },
        stiffness: 0.95, render: { visible: true, lineWidth: 4, strokeStyle: '#00ff00' }
      });
      const rightAnchor = Constraint.create({
        bodyA: rightCliff, bodyB: planks[planks.length - 1],
        pointA: { x: -55, y: -90 }, pointB: { x: plankWidth / 2, y: 0 },
        stiffness: 0.95, render: { visible: true, lineWidth: 4, strokeStyle: '#00ff00' }
      });
      bridgeConstraintsRef.current.push(leftAnchor, rightAnchor);
      Composite.add(engine.world, [leftAnchor, rightAnchor]);

      // 📦 The Target Crate Pyramid (Middle of bridge)
      const crateSize = 30;
      const cX = width / 2;
      const cY = 500;
      const crateOpt = { density: 0.001, friction: 0.8, render: { fillStyle: '#00d2ff', strokeStyle: '#ffffff', lineWidth: 2 } };
      
      Composite.add(engine.world, [
        Bodies.rectangle(cX - 32, cY, crateSize, crateSize, crateOpt),
        Bodies.rectangle(cX, cY, crateSize, crateSize, crateOpt),
        Bodies.rectangle(cX + 32, cY, crateSize, crateSize, crateOpt),
        Bodies.rectangle(cX - 16, cY - 32, crateSize, crateSize, crateOpt),
        Bodies.rectangle(cX + 16, cY - 32, crateSize, crateSize, crateOpt),
        Bodies.rectangle(cX, cY - 64, crateSize, crateSize, crateOpt)
      ]);
    };

    buildEnvironment();

    // 🔬 STRUCTURAL SNAPPING MONITOR
    Events.on(engine, 'beforeUpdate', () => {
      const activeConstraints = bridgeConstraintsRef.current;
      const constraintsToKeep = [];
      let snappedCount = 0;

      const maxStretchTolerance = 8 + (strengthRef.current * 3); 

      activeConstraints.forEach(joint => {
        if (!joint.bodyA || !joint.bodyB) return;

        const posA = Vector.add(joint.bodyA.position, Vector.rotate(joint.pointA, joint.bodyA.angle));
        const posB = Vector.add(joint.bodyB.position, Vector.rotate(joint.pointB, joint.bodyB.angle));
        const absoluteDistance = Vector.magnitude(Vector.sub(posA, posB));
        
        const stretchAmount = absoluteDistance - (joint.length || 1);
        
        const normalizedStress = Math.max(0, Math.min(1, stretchAmount / maxStretchTolerance));
        const r = Math.floor(255 * normalizedStress);
        const g = Math.floor(255 * (1 - normalizedStress));
        joint.render.strokeStyle = `rgb(${r}, ${g}, 50)`;

        if (stretchAmount > maxStretchTolerance && statusRef.current === 'running') {
          Composite.remove(engine.world, joint);
          snappedCount++;

          for (let s = 0; s < 6; s++) {
            particlesRef.current.push({
              x: (posA.x + posB.x) / 2,
              y: (posA.y + posB.y) / 2,
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 12 - 4,
              size: Math.random() * 5 + 2,
              alpha: 1.0
            });
          }
        } else {
          constraintsToKeep.push(joint);
        }
      });

      if (snappedCount > 0) {
        bridgeConstraintsRef.current = constraintsToKeep;
      }
    });

    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      
      ctx.save();
      const pr = render.options.pixelRatio;
      ctx.setTransform(pr, 0, 0, pr, 0, 0);

      // Paint Splinters
      particlesRef.current.forEach(p => {
        ctx.fillStyle = `rgba(226, 168, 92, ${p.alpha})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4; 
        p.alpha -= 0.02;
      });
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

      if (currentStatus === 'idle') {
        ctx.fillStyle = 'rgba(9, 10, 16, 0.85)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px Inter';
        ctx.fillText('MONSTER TRUCK SMASH', width / 2, height / 2 - 20);
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 18px Inter';
        ctx.fillText('Adjust the launch power and hit Launch!', width / 2, height / 2 + 30);
      }

      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(9, 10, 16, 0.85)';
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        
        if (t > 3) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 32px Inter';
          ctx.fillText('REVVING ENGINE...', width / 2, height / 2 - 20);
          ctx.fillStyle = '#ff0055';
          ctx.font = 'bold 18px Inter';
          ctx.fillText('Prepare for impact!', width / 2, height / 2 + 30);
        } else if (t > 0) {
          ctx.fillStyle = '#ff0055';
          ctx.font = 'bold 140px Inter';
          ctx.fillText(t, width / 2, height / 2 + 50);
        }
      }

      if (currentStatus === 'running') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(20, 20, 160, 35);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`BRIDGE JOINTS: ${bridgeConstraintsRef.current.length}`, 35, 42);
      }

      ctx.restore();
    });

    window.rebuildStructuralBridge = buildEnvironment;

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
      clearInterval(countdownTimerRef.current);
      delete window.rebuildStructuralBridge;
    };
  }, []);

  // 🏎️ THE VEHICLE SPANWER & LAUNCHER
  const launchMonsterTruck = () => {
    if (!engineRef.current) return;
    const { Composite, Bodies, Constraint, Body } = Matter;

    // Mass scales directly with slider
    const tDensity = 0.005 + (powerRef.current * 0.003); 
    const vX = 40;
    const vY = 220;

    // Truck Chassis
    const chassis = Bodies.rectangle(vX, vY, 90, 30, { 
      density: tDensity, 
      frictionAir: 0.01,
      render: { fillStyle: '#b700ff' } 
    });
    
    // Truck Wheels
    const wheelOpt = { density: tDensity, friction: 0.9, restitution: 0.5, render: { fillStyle: '#ffffff' } };
    const wheelLeft = Bodies.circle(vX - 35, vY + 20, 20, wheelOpt);
    const wheelRight = Bodies.circle(vX + 35, vY + 20, 20, wheelOpt);

    // Shock Absorber Axles
    const axel1 = Constraint.create({
      bodyA: chassis, pointA: { x: -35, y: 15 },
      bodyB: wheelLeft, stiffness: 0.4, length: 5, render: { visible: false }
    });
    const axel2 = Constraint.create({
      bodyA: chassis, pointA: { x: 35, y: 15 },
      bodyB: wheelRight, stiffness: 0.4, length: 5, render: { visible: false }
    });

    const truck = Composite.create({ label: 'truck' });
    Composite.add(truck, [chassis, wheelLeft, wheelRight, axel1, axel2]);
    Composite.add(engineRef.current.world, truck);

    // 💥 BOOST INITIAL VELOCITY BASED ON SLIDER!
    const blastSpeed = 8 + (powerRef.current * 1.5);
    Body.setVelocity(chassis, { x: blastSpeed, y: 5 });
    Body.setVelocity(wheelLeft, { x: blastSpeed, y: 5 });
    Body.setVelocity(wheelRight, { x: blastSpeed, y: 5 });
    Body.setAngularVelocity(wheelLeft, 0.5); // Spin the wheels for effect
    Body.setAngularVelocity(wheelRight, 0.5);
  };

  const startTestSequence = () => {
    if (window.rebuildStructuralBridge) window.rebuildStructuralBridge();
    clearInterval(countdownTimerRef.current);
    
    preGameTimeRef.current = 5; 
    changeStatus('countdown');

    countdownTimerRef.current = setInterval(() => {
      preGameTimeRef.current -= 1;
      if (preGameTimeRef.current <= 0) {
        clearInterval(countdownTimerRef.current);
        changeStatus('running');
        launchMonsterTruck(); // 🏎️ FLY OFF THE RAMP
      }
    }, 1000);
  };

  const resetEnvironment = () => {
    if (window.rebuildStructuralBridge) window.rebuildStructuralBridge();
    changeStatus('idle');
  };

  return (
    <div className="arena-inner-container">
      <div className="luxury-sidebar">
        <h2 style={{ fontSize: '1.3rem', letterSpacing: '1px', fontWeight: '800', marginBottom: '20px' }}>
          🏎️ TRUCK SMASH TEST
        </h2>

        <div className="luxury-control-card">
          <label>TRUCK MASS & SPEED</label>
          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', color: '#00d2ff', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>
            <span>SLOW Bumper</span>
            <span>HYPER Mach-{launchPower}</span>
          </div>
          <input type="range" min="1" max="10" value={launchPower} disabled={gameStatus === 'countdown'} onChange={(e) => setLaunchPower(Number(e.target.value))} />
        </div>

        <div className="luxury-control-card">
          <label>STRUCTURAL JOINT STRENGTH</label>
          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', color: '#00ff87', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>
            <span>FRAGILE Planks</span>
            <span>STEEL Tier-{jointStrength}</span>
          </div>
          <input type="range" min="1" max="10" value={jointStrength} disabled={gameStatus === 'countdown'} onChange={(e) => setJointStrength(Number(e.target.value))} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
          <button className="btn-action" onClick={startTestSequence} disabled={gameStatus === 'countdown'}>
            🚀 Launch Monster Truck!
          </button>
          
          {gameStatus === 'running' && (
            <button className="btn-action" onClick={launchMonsterTruck} style={{ background: 'linear-gradient(135deg, #b700ff 0%, #ff0055 100%)' }}>
              ➕ Send Another Truck!
            </button>
          )}

          <button className="btn-action" onClick={resetEnvironment} style={{ background: '#1f2235', border: '1px solid rgba(255,255,255,0.1)' }}>
            🔄 Rebuild Bridge & Targets
          </button>
        </div>
      </div>

      <div className="simulation-viewport">
        <div className="canvas-frame-container" ref={sceneRef} style={{ width: '540px', height: '960px', backgroundColor: '#090a10', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }} />
      </div>
    </div>
  );
}