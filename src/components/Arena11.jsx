import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

// ⚽ The Ultimate 48-Team 2026 World Cup Roster
const COUNTRY_LIST = [
  // Group A
  { id: 'mx', name: 'Mexico', color: '#006847' },
  { id: 'za', name: 'South Africa', color: '#007749' },
  { id: 'kr', name: 'South Korea', color: '#c60c30' },
  { id: 'cz', name: 'Czechia', color: '#11457e' },
  // Group B
  { id: 'ca', name: 'Canada', color: '#ff0000' },
  { id: 'ba', name: 'Bosnia & Herz.', color: '#002395' },
  { id: 'qa', name: 'Qatar', color: '#8a1538' },
  { id: 'ch', name: 'Switzerland', color: '#ff0000' },
  // Group C
  { id: 'br', name: 'Brazil', color: '#009b3a' },
  { id: 'ma', name: 'Morocco', color: '#c1272d' },
  { id: 'ht', name: 'Haiti', color: '#00209f' },
  { id: 'gb-sct', name: 'Scotland', color: '#005eb8' },
  // Group D
  { id: 'us', name: 'USA', color: '#3c3b6e' },
  { id: 'py', name: 'Paraguay', color: '#d52b1e' },
  { id: 'au', name: 'Australia', color: '#00008b' },
  { id: 'tr', name: 'Türkiye', color: '#e30a17' },
  // Group E
  { id: 'de', name: 'Germany', color: '#dd0000' },
  { id: 'cw', name: 'Curaçao', color: '#002b7f' },
  { id: 'ci', name: 'Côte d’Ivoire', color: '#f77f00' },
  { id: 'ec', name: 'Ecuador', color: '#ffdd00' },
  // Group F
  { id: 'nl', name: 'Netherlands', color: '#ae1c28' },
  { id: 'jp', name: 'Japan', color: '#bc002d' },
  { id: 'se', name: 'Sweden', color: '#006aa7' },
  { id: 'tn', name: 'Tunisia', color: '#e70013' },
  // Group G
  { id: 'be', name: 'Belgium', color: '#ed2939' },
  { id: 'eg', name: 'Egypt', color: '#ce1126' },
  { id: 'ir', name: 'Iran', color: '#239f40' },
  { id: 'nz', name: 'New Zealand', color: '#00247d' },
  // Group H
  { id: 'es', name: 'Spain', color: '#aa151b' },
  { id: 'cv', name: 'Cabo Verde', color: '#003893' },
  { id: 'sa', name: 'Saudi Arabia', color: '#006c35' },
  { id: 'uy', name: 'Uruguay', color: '#0038a8' },
  // Group I
  { id: 'fr', name: 'France', color: '#002654' },
  { id: 'sn', name: 'Senegal', color: '#00853f' },
  { id: 'no', name: 'Norway', color: '#ba0c2f' },
  { id: 'iq', name: 'Iraq', color: '#007a3d' },
  // Group J
  { id: 'ar', name: 'Argentina', color: '#74acdf' },
  { id: 'dz', name: 'Algeria', color: '#006233' },
  { id: 'at', name: 'Austria', color: '#ed2939' },
  { id: 'jo', name: 'Jordan', color: '#ce1126' },
  // Group K
  { id: 'pt', name: 'Portugal', color: '#ff0000' },
  { id: 'cd', name: 'DR Congo', color: '#007fff' },
  { id: 'uz', name: 'Uzbekistan', color: '#0099b5' },
  { id: 'co', name: 'Colombia', color: '#fcd116' },
  // Group L
  { id: 'gb-eng', name: 'England', color: '#ce1124' },
  { id: 'hr', name: 'Croatia', color: '#ff0000' },
  { id: 'gh', name: 'Ghana', color: '#ce1126' },
  { id: 'pa', name: 'Panama', color: '#c8102e' }
];

export default function Arena11() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  const countdownTimerRef = useRef(null);
  const maxMatchTimerRef = useRef(null);

  // --- STATE ---
  const [activeTeams, setActiveTeams] = useState(8); // Default to 2 Groups
  const [marbleCount, setMarbleCount] = useState(2); 
  const [selectedCountries, setSelectedCountries] = useState(COUNTRY_LIST.slice(0, 16)); // Load up to 16 slots
  const [gameStatus, setGameStatus] = useState('idle');

  // --- REFS ---
  const statusRef = useRef('idle');
  const activeTeamsRef = useRef(8);
  const countriesRef = useRef(selectedCountries);
  const preGameTimeRef = useRef(5);
  const fireworksRef = useRef([]);
  const spinnersRef = useRef([]); 
  const flagImagesRef = useRef({}); 
  
  const cameraYRef = useRef(0);
  const leaderIndexRef = useRef(null); 
  const podiumRef = useRef([]); 

  const width = 540;
  const height = 960; 
  const totalTrackHeight = 8500; 
  const finishLineY = totalTrackHeight - 140;

  const changeStatus = (newStatus) => {
    statusRef.current = newStatus;
    setGameStatus(newStatus);
  };

  useEffect(() => { activeTeamsRef.current = activeTeams; }, [activeTeams]);
  useEffect(() => { 
    countriesRef.current = selectedCountries; 
    selectedCountries.forEach(c => {
      if (c && !flagImagesRef.current[c.id]) {
        const img = new Image();
        img.crossOrigin = "anonymous"; 
        img.src = `https://hatscripts.github.io/circle-flags/flags/${c.id}.svg`;
        flagImagesRef.current[c.id] = img;
      }
    });
  }, [selectedCountries]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.innerHTML = ''; 

    const { Engine, Render, Runner, Bodies, Composite, Events, Body, Vector } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 0.85; 
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { 
        width, 
        height, 
        wireframes: false, 
        background: '#0a0d14',
        hasBounds: true,
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: width, y: height } });

    const buildWorldCupTrack = () => {
      if (!engineRef.current) return;
      Composite.clear(engineRef.current.world, false);
      spinnersRef.current = [];
      cameraYRef.current = 0;
      leaderIndexRef.current = null;
      podiumRef.current = []; 

      Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: width, y: height } });

      Composite.add(engineRef.current.world, [
        Bodies.rectangle(10, totalTrackHeight/2, 20, totalTrackHeight, { isStatic: true, friction: 0, render: { fillStyle: '#1b1f33' } }),
        Bodies.rectangle(width-10, totalTrackHeight/2, 20, totalTrackHeight, { isStatic: true, friction: 0, render: { fillStyle: '#1b1f33' } }),
      ]);

      // 🌍 SECTION 1: Dense Funnel Maze 
      for(let i = 0; i < 7; i++) {
        const yPos = 300 + (i * 220);
        Composite.add(engineRef.current.world, [
          Bodies.rectangle(100, yPos, 260, 20, { isStatic: true, angle: 0.35, render: { fillStyle: '#3d446b' } }),
          Bodies.rectangle(width - 100, yPos + 90, 260, 20, { isStatic: true, angle: -0.35, render: { fillStyle: '#3d446b' } }),
          Bodies.circle(width / 2, yPos + 150, 18, { isStatic: true, restitution: 1.2, render: { fillStyle: '#00d2ff' } })
        ]);
      }

      // 🌀 SECTION 2: Motorized Spinners 
      for(let j = 0; j < 6; j++) {
        const yPos = 2000 + (j * 220);
        const centerX = j % 2 === 0 ? 140 : width - 140;
        
        Composite.add(engineRef.current.world, [
          Bodies.rectangle(j % 2 === 0 ? 80 : width - 80, yPos - 80, 160, 16, { 
            isStatic: true, angle: j % 2 === 0 ? 0.3 : -0.3, render: { fillStyle: '#1b1f33' } 
          })
        ]);

        const spinner = Bodies.rectangle(centerX, yPos, 200, 20, {
          isStatic: true, friction: 0, render: { fillStyle: '#00ff87' }
        });
        
        Composite.add(engineRef.current.world, spinner);
        spinnersRef.current.push({ body: spinner, speed: j % 2 === 0 ? 0.08 : -0.08, originalX: centerX, originalY: yPos });
      }

      // 🏔️ SECTION 3: The Smooth S-Curve Mountain
      for(let k = 0; k < 8; k++) {
        const yPos = 3500 + (k * 180); 
        const isLeft = k % 2 === 0;
        Composite.add(engineRef.current.world, [
          Bodies.rectangle(isLeft ? 180 : width - 180, yPos, 380, 20, { 
            isStatic: true, angle: isLeft ? 0.25 : -0.25, chamfer: { radius: 10 }, render: { fillStyle: '#1b1f33' } 
          }),
        ]);
      }

      // ☄️ SECTION 4: High-Density Bumper Field
      const freefallBumpers = [];
      for (let r = 0; r < 12; r++) {
        const yRow = 5000 + (r * 130);
        const pinCount = r % 2 === 0 ? 4 : 5;
        const spacing = width / (pinCount + 1);
        for (let c = 0; c < pinCount; c++) {
          freefallBumpers.push(Bodies.circle(spacing * (c + 1), yRow, 16, {
            isStatic: true, restitution: 1.3, render: { fillStyle: '#ffeb3b' } 
          }));
        }
      }
      Composite.add(engineRef.current.world, freefallBumpers);

      // 🌪️ SECTION 5: The Final Sieve 
      const sieve = [];
      for (let r = 0; r < 8; r++) {
        const yRow = 6700 + (r * 120); 
        for (let c = 0; c < 6; c++) { 
          const shift = r % 2 === 0 ? 0 : 45;
          sieve.push(Bodies.circle(45 + c * 90 + shift, yRow, 10, {
            isStatic: true, restitution: 1.5, render: { fillStyle: '#ffffff' } 
          }));
        }
      }
      Composite.add(engineRef.current.world, sieve);

      // 🏁 SECTION 6: The Finish Line Funnel
      Composite.add(engineRef.current.world, [
        Bodies.rectangle(100, finishLineY - 120, 250, 20, { isStatic: true, angle: 0.6, render: { fillStyle: '#3d446b' } }),
        Bodies.rectangle(width - 100, finishLineY - 120, 250, 20, { isStatic: true, angle: -0.6, render: { fillStyle: '#3d446b' } })
      ]);

      const finishLine = Bodies.rectangle(width / 2, finishLineY, width - 20, 10, {
        isStatic: true,
        isSensor: true, 
        label: 'finish_line',
        render: { fillStyle: '#ffeb3b' } 
      });
      Composite.add(engineRef.current.world, finishLine);
    };

    buildWorldCupTrack();

    Events.on(engine, 'beforeUpdate', () => {
      if (statusRef.current !== 'running') return;

      spinnersRef.current.forEach(spinner => {
        Body.setAngle(spinner.body, spinner.body.angle + spinner.speed);
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

        if (speed < 0.25 && b.position.y > 140) {
          Body.applyForce(b, b.position, {
            x: (Math.random() - 0.5) * 0.005,
            y: -0.003
          });
        }

        if (b.position.y >= finishLineY && !b.hasFinished) {
          b.hasFinished = true;
          const teamIndex = parseInt(b.label.split('_')[1], 10);
          
          if (!podiumRef.current.includes(teamIndex) && podiumRef.current.length < 3) {
            podiumRef.current.push(teamIndex);
          }
        }
      });

      if (activeMarbles > 0 && (podiumRef.current.length >= 3 || marbles.filter(m => !m.hasFinished).length === 0)) {
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
        cameraYRef.current += (targetY - cameraYRef.current) * 0.15; 
      }

      Render.lookAt(render, { min: { x: 0, y: cameraYRef.current }, max: { x: width, y: cameraYRef.current + height } });
    });

    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const currentStatus = statusRef.current;
      const activeCountries = countriesRef.current;
      const activeCount = activeTeamsRef.current;

      const allBodies = Composite.allBodies(engine.world);
      const marbles = allBodies.filter(b => b.label.startsWith('team_'));

      ctx.save();
      const pr = render.options.pixelRatio;
      ctx.setTransform(pr, 0, 0, pr, 0, 0); 

      marbles.forEach(m => {
        const teamIdx = parseInt(m.label.split('_')[1], 10);
        const country = activeCountries[teamIdx];
        const img = country ? flagImagesRef.current[country.id] : null;

        const screenY = m.position.y - cameraYRef.current;
        ctx.translate(m.position.x, screenY);
        ctx.rotate(m.angle); 

        if (img && img.complete) {
          ctx.drawImage(img, -14, -14, 28, 28);
        } else {
          ctx.fillStyle = country?.color || '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, 2 * Math.PI);
          ctx.fill();
        }

        ctx.rotate(-m.angle);
        ctx.translate(-m.position.x, -screenY);
      });

      if (currentStatus === 'idle') {
        ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px Inter';
        ctx.fillText('⚽ WORLD CUP RACE', width / 2, height / 2 - 20);
        ctx.fillStyle = '#00d2ff';
        ctx.font = 'bold 18px Inter';
        ctx.fillText('Select your countries to begin!', width / 2, height / 2 + 30);
      }

      if (currentStatus === 'countdown') {
        const t = preGameTimeRef.current;
        ctx.fillStyle = 'rgba(10, 13, 20, 0.95)';
        ctx.fillRect(0, 0, width, height);
        ctx.textAlign = 'center';
        
        if (t > 2) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 32px Inter';
          ctx.fillText('REPRESENTING NATIONS', width / 2, 80);

          ctx.font = 'bold 16px Inter';
          // Draw list up to 16 teams max cleanly on screen
          for (let i = 0; i < Math.min(activeCount, 16); i++) {
            const col = i < 8 ? 0 : 1;
            const row = i % 8;
            const xPos = col === 0 ? 90 : width / 2 + 40;
            const yPos = 140 + (row * 40);

            const c = activeCountries[i];
            const img = c ? flagImagesRef.current[c.id] : null;

            if (img && img.complete) {
              ctx.drawImage(img, xPos - 26, yPos - 12, 20, 20);
            }
            ctx.textAlign = 'left';
            ctx.fillText(c?.name || '', xPos, yPos + 4);
          }

          ctx.fillStyle = 'rgba(0, 255, 135, 0.1)';
          ctx.fillRect(40, 480, width - 80, 140);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#00ff87';
          ctx.strokeRect(40, 480, width - 80, 140);

          ctx.textAlign = 'center';
          ctx.fillStyle = '#00ff87';
          ctx.font = '900 24px Inter';
          ctx.fillText('LOCK YOUR BET IN!', width / 2, 530);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px Inter';
          ctx.fillText('Comment the country you support! 👇', width / 2, 575);

        } else if (t > 0) {
          ctx.fillStyle = '#ff0055';
          ctx.font = 'bold 220px Inter';
          ctx.fillText(t, width / 2, height / 2 + 60);
        }
      }

      if (currentStatus === 'running') {
        ctx.fillStyle = 'rgba(10, 13, 20, 0.9)';
        ctx.fillRect(0, 0, width, 85);
        ctx.textAlign = 'center';
        if (leaderIndexRef.current !== null && activeCountries[leaderIndexRef.current]) {
           const leader = activeCountries[leaderIndexRef.current];
           const img = flagImagesRef.current[leader.id];
           
           ctx.fillStyle = '#8892b0';
           ctx.font = '700 14px Inter';
           ctx.fillText(`RACE LEADER`, width / 2, 30);
           
           if (img && img.complete) {
             ctx.drawImage(img, width / 2 - 14, 45, 28, 28);
           }
        }
      }

      if (currentStatus === 'finished') {
        ctx.fillStyle = 'rgba(10, 13, 20, 0.96)';
        ctx.fillRect(0, 0, width, height);
        
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Inter';
        ctx.fillText(`🏆 TOP SCORES`, width / 2, 120);

        const podium = podiumRef.current;
        const p1 = activeCountries[podium[0]];
        const p2 = activeCountries[podium[1]];
        const p3 = activeCountries[podium[2]];

        const drawPodiumStep = (country, x, y, title, titleColor, size) => {
          if (!country) return;
          const img = flagImagesRef.current[country.id];
          ctx.fillStyle = titleColor;
          ctx.font = 'bold 24px Inter';
          ctx.fillText(title, x, y);
          
          if (img && img.complete) {
            ctx.drawImage(img, x - (size/2), y + 20, size, size);
          }
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 30px Inter';
          ctx.fillText(country.name, x, y + size + 60);
        };

        drawPodiumStep(p1, width / 2, 250, '🥇 TOP SCORER', '#ffeb3b', 100);
        drawPodiumStep(p2, width / 2 - 130, 480, '🥈 2ND', '#c0c0c0', 70);
        drawPodiumStep(p3, width / 2 + 130, 480, '🥉 3RD', '#cd7f32', 70);

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

    window.rebuildWorldCupArena = buildWorldCupTrack;
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
      delete window.rebuildWorldCupArena;
    };
  }, []);

  const handleCountryChange = (index, newCountryId) => {
    const newCountries = [...selectedCountries];
    const foundCountry = COUNTRY_LIST.find(c => c.id === newCountryId);
    if (foundCountry) {
      newCountries[index] = foundCountry;
      setSelectedCountries(newCountries);
    }
  };

  const startRecordingSequence = () => {
    if (window.rebuildWorldCupArena) window.rebuildWorldCupArena();
    clearInterval(countdownTimerRef.current);
    clearInterval(maxMatchTimerRef.current);
    
    podiumRef.current = [];
    fireworksRef.current = [];
    preGameTimeRef.current = 5; 
    changeStatus('countdown');

    const canvas = sceneRef.current.querySelector('canvas');
    if (!canvas) return;

    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recordedChunksRef.current = [];
    
    recorder.ondataavailable = (e) => { 
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data); 
    };
    
    recorder.onstop = () => {
      if (recordedChunksRef.current.length > 0) {
        try {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `WorldCup-Race-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error("Failed to save video:", err);
        }
      }
      recordedChunksRef.current = [];
    };
    
    recorder.start(100);
    mediaRecorderRef.current = recorder;

    countdownTimerRef.current = setInterval(() => {
      preGameTimeRef.current -= 1;
      if (preGameTimeRef.current <= 0) {
        clearInterval(countdownTimerRef.current);
        changeStatus('running');
        spawnRacingMarbles();
        maxMatchTimerRef.current = setInterval(() => { endRace(); }, 90000); 
      }
    }, 1000);
  };

  const spawnRacingMarbles = () => {
    const { Composite, Bodies, Body } = Matter;
    const newBodies = [];
    for (let t = 0; t < activeTeamsRef.current; t++) {
      for (let m = 0; m < marbleCount; m++) {
        const spawnX = width / 2 + (Math.random() * 80 - 40);
        
        const marble = Bodies.circle(spawnX, 100 - (m * 20), 14, { 
          restitution: 0.5, 
          friction: 0.005, 
          frictionAir: 0.01,
          label: `team_${t}`, 
          render: { visible: false } 
        });
        Body.setVelocity(marble, { x: (Math.random() - 0.5) * 3, y: 3 });
        newBodies.push(marble);
      }
    }
    Composite.add(engineRef.current.world, newBodies);
  };

  const endRace = () => {
    clearInterval(maxMatchTimerRef.current);
    changeStatus('finished');
    
    let winColor = '#ffffff';
    if (podiumRef.current[0] !== undefined) {
       winColor = countriesRef.current[podiumRef.current[0]].color;
    }

    const particles = [];
    for(let i = 0; i < 350; i++) {
      particles.push({ x: width / 2, y: height / 2, vx: (Math.random() - 0.5) * 35, vy: (Math.random() - 0.5) * 35 - 5, size: Math.random() * 6 + 2, color: Math.random() > 0.4 ? winColor : '#ffffff' });
    }
    fireworksRef.current = particles;
    
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      changeStatus('idle');
    }, 5000);
  };

  let btnText = 'Start World Cup Race 🌍🏆';
  if (gameStatus === 'countdown') btnText = 'Grid Locking... ⏳';
  if (gameStatus === 'running') btnText = 'Tournament Live... 🏁';
  if (gameStatus === 'finished') btnText = 'Crowning Champion... 🎆';

  return (
    <div className="app-container">
      <div className="sidebar" style={{ maxHeight: '100vh', overflowY: 'auto' }}>
        <h2>⚽ WORLD CUP RACE</h2>
        <div className="control-group">
          <label>Competing Nations: {activeTeams}</label>
          <input type="range" min="2" max="16" value={activeTeams} disabled={gameStatus !== 'idle'} onChange={(e) => setActiveTeams(Number(e.target.value))} />
        </div>
        <div className="control-group">
          <label>Balls Per Nation: {marbleCount}</label>
          <input type="range" min="1" max="5" value={marbleCount} disabled={gameStatus !== 'idle'} onChange={(e) => setMarbleCount(Number(e.target.value))} />
        </div>
        
        <div className="color-selectors" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: '#8892b0', fontSize: '12px', fontWeight: 'bold' }}>NATION ROSTER (48 TEAMS)</label>
          {Array.from({ length: activeTeams }).map((_, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src={`https://hatscripts.github.io/circle-flags/flags/${selectedCountries[idx]?.id || 'ar'}.svg`} 
                alt="flag" 
                style={{ width: '28px', height: '28px', borderRadius: '50%' }}
              />
              <select 
                value={selectedCountries[idx]?.id || 'ar'} 
                disabled={gameStatus !== 'idle'} 
                onChange={(e) => handleCountryChange(idx, e.target.value)}
                style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
              >
                {COUNTRY_LIST.map(country => (
                  <option key={country.id} value={country.id} style={{ color: '#000' }}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <button className={`btn ${gameStatus === 'idle' ? 'btn-record' : 'btn-secondary'}`} onClick={startRecordingSequence} disabled={gameStatus !== 'idle'} style={{ marginTop: '15px', width: '100%', background: 'linear-gradient(135deg, #00d2ff 0%, #3b82f6 100%)' }}>
          {btnText}
        </button>
      </div>
      <div className="stage-wrapper">
        <div className="canvas-container" ref={sceneRef} style={{ width: '540px', height: '960px', backgroundColor: '#0a0d14', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }} />
      </div>
    </div>
  );
}