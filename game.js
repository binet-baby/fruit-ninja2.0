const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const homeScreen = document.getElementById('home-screen');
const startScreen = document.getElementById('start-screen') || homeScreen;
const settingsScreen = document.getElementById('settings-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const livesEl = document.getElementById('lives');
const finalScoreEl = document.getElementById('final-score');
const finalLivesEl = document.getElementById('final-lives');
const gameOverReasonEl = document.getElementById('game-over-reason');
const gameContainer = document.getElementById('game-container');
const timerBoard = timerEl ? timerEl.parentElement : null;

// Audio System Settings
let soundEnabled = true;
let musicEnabled = true;
let isMuted = false;

// Audio Context (Synthesized Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterGain = null;
let bgmGain = null;
let sfxGain = null;
let bgmInterval = null;
let bgmStep = 0;
let previousScreen = 'home';

function initAudioEngine() {
    if (!masterGain) {
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(isMuted ? 0 : 1.0, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
    }
    if (!bgmGain) {
        bgmGain = audioCtx.createGain();
        bgmGain.gain.setValueAtTime(musicEnabled && !isMuted ? 0.22 : 0, audioCtx.currentTime);
        bgmGain.connect(masterGain);
    }
    if (!sfxGain) {
        sfxGain = audioCtx.createGain();
        sfxGain.gain.setValueAtTime(soundEnabled && !isMuted ? 0.8 : 0, audioCtx.currentTime);
        sfxGain.connect(masterGain);
    }
}

function updateAudioGains() {
    initAudioEngine();
    const now = audioCtx.currentTime;
    if (masterGain) masterGain.gain.setValueAtTime(isMuted ? 0 : 1.0, now);
    if (bgmGain) bgmGain.gain.setValueAtTime(musicEnabled && !isMuted ? 0.22 : 0, now);
    if (sfxGain) sfxGain.gain.setValueAtTime(soundEnabled && !isMuted ? 0.8 : 0, now);
}

// Spooky BGM Synth Pattern Scheduler (~110 BPM loop)
function startBGMScheduler() {
    if (bgmInterval) return;
    initAudioEngine();
    
    bgmInterval = setInterval(() => {
        if (audioCtx.state === 'suspended') return;
        
        if (!musicEnabled || isMuted) {
            bgmStep = (bgmStep + 1) % 16;
            return;
        }

        const now = audioCtx.currentTime;
        
        // 1. Spooky Bass Line (D Minor: D2, F2, G#2, A2)
        const bassFreqs = [73.42, 0, 87.31, 0, 103.83, 0, 110.0, 0, 73.42, 0, 87.31, 0, 103.83, 0, 110.0, 0];
        const bassFreq = bassFreqs[bgmStep];
        if (bassFreq > 0) {
            const osc = audioCtx.createOscillator();
            const noteGain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(bassFreq, now);
            noteGain.gain.setValueAtTime(0.28, now);
            noteGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            osc.connect(noteGain);
            noteGain.connect(bgmGain);
            osc.start(now);
            osc.stop(now + 0.24);
        }
        
        // 2. High Arpeggiated Spooky Bells (D5, F5, G#5, A5, C6)
        const melodyNotes = [
            587.33, 0, 698.46, 830.61, 880.0, 0, 698.46, 587.33,
            1046.5, 0, 880.0, 830.61, 698.46, 0, 587.33, 830.61
        ];
        const melFreq = melodyNotes[bgmStep];
        if (melFreq > 0) {
            const osc = audioCtx.createOscillator();
            const noteGain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(melFreq, now);
            noteGain.gain.setValueAtTime(0.18, now);
            noteGain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);
            osc.connect(noteGain);
            noteGain.connect(bgmGain);
            osc.start(now);
            osc.stop(now + 0.20);
        }
        
        bgmStep = (bgmStep + 1) % 16;
    }, 135);
}

// Auto-resume AudioContext on first user interaction
function autoResumeAudio() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            initAudioEngine();
            updateAudioGains();
        });
    }
}

['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
    window.addEventListener(evt, autoResumeAudio, { once: false });
});

// Image Assets — Horror Sprite Sheet
const fruitSprite = new Image();
fruitSprite.src = 'horror_fruits.png';

// Horror Fruit Sprite Sheet Data: 5 columns x 3 rows (800 x 480)
const fruitData = [
    // Row 0
    [
        { name: 'Evil Watermelon',   color: '#2ed573', splash: '#8b0000' },
        { name: 'Stitched Apple',    color: '#c0392b', splash: '#6ab04c' },
        { name: 'Screaming Banana',  color: '#f9ca24', splash: '#8b6914' },
        { name: 'Skull Pineapple',   color: '#d4a017', splash: '#2d8a4e' },
        { name: 'Zombie Strawberry', color: '#c0392b', splash: '#2ed573' }
    ],
    // Row 1
    [
        { name: 'Crazy Kiwi',        color: '#6ab04c', splash: '#a29bfe' },
        { name: 'Zombie Orange',     color: '#e67e22', splash: '#8b0000' },
        { name: 'Sinister Grapes',   color: '#6c3483', splash: '#fd79a8' },
        { name: 'Evil Watermelon',   color: '#27ae60', splash: '#8b0000' },
        { name: 'Stitched Apple',    color: '#e74c3c', splash: '#55efc4' }
    ],
    // Row 2
    [
        { name: 'Screaming Banana',  color: '#f1c40f', splash: '#2d3436' },
        { name: 'Skull Pineapple',   color: '#f39c12', splash: '#6c3483' },
        { name: 'Zombie Strawberry', color: '#e84393', splash: '#2ed573' },
        { name: 'Crazy Kiwi',        color: '#00b894', splash: '#d63031' },
        { name: 'Zombie Orange',     color: '#e17055', splash: '#2d8a4e' }
    ]
];

// Sound Synthesizer
function playSound(type, pitchMultiplier = 1) {
    autoResumeAudio();
    if (!soundEnabled || isMuted) return;
    
    initAudioEngine();
    const now = audioCtx.currentTime;
    
    if (type === 'slice') {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'triangle';
        const baseFreq = 750 * pitchMultiplier;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(280 * pitchMultiplier, now + 0.12);
        gainNode.gain.setValueAtTime(0.35, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gainNode);
        gainNode.connect(sfxGain || masterGain);
        osc.start(now);
        osc.stop(now + 0.12);
    } else if (type === 'bomb') {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(15, now + 0.6);
        gainNode.gain.setValueAtTime(0.6, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gainNode);
        gainNode.connect(sfxGain || masterGain);
        osc.start(now);
        osc.stop(now + 0.6);
    } else if (type === 'combo') {
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            const startTime = now + idx * 0.05;
            osc.frequency.setValueAtTime(freq * pitchMultiplier, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            osc.connect(gain);
            gain.connect(sfxGain || masterGain);
            osc.start(startTime);
            osc.stop(startTime + 0.2);
        });
    } else if (type === 'click') {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gainNode);
        gainNode.connect(sfxGain || masterGain);
        osc.start(now);
        osc.stop(now + 0.08);
    }
}

// Game State
let gameState = 'home'; // 'home', 'playing', 'gameover', 'settings'
let score = 0;
let lives = 3;
const MAX_LIVES = 3;
let timeRemaining = 45;
let misses = 0;

let entities = [];
let fruitHalves = [];
let particles = [];
let floatingTexts = [];
let sliceTrail = [];
let isSlicing = false;

// Helper to update HUD lives display
function updateLivesDisplay() {
    let hearts = '';
    for (let i = 0; i < MAX_LIVES; i++) {
        hearts += i < lives ? '❤️' : '🖤';
    }
    if (livesEl) {
        livesEl.innerText = hearts;
    }
}

// Time tracking
let lastTime = 0;
let spawnTimer = 0;
let difficultyMultiplier = 1;
let gameStartTime = 0;

// Resize Canvas
function resizeCanvas() {
    canvas.width = gameContainer.clientWidth || window.innerWidth;
    canvas.height = gameContainer.clientHeight || window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Coordinate helper
function getEventPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

// Input Handling
function addTrailPoint(x, y) {
    const now = performance.now();
    sliceTrail.push({ x, y, time: now });
}

function handleStart(e) {
    if (gameState !== 'playing') return;
    isSlicing = true;
    sliceTrail = [];
    const pos = getEventPos(e);
    addTrailPoint(pos.x, pos.y);
}

function handleMove(e) {
    if (!isSlicing || gameState !== 'playing') return;
    const pos = getEventPos(e);
    addTrailPoint(pos.x, pos.y);
    checkCollisions();
}

function handleEnd() {
    isSlicing = false;
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e); }, { passive: false });
window.addEventListener('touchend', handleEnd);

// Sliced Fruit Half Class
class FruitHalf {
    constructor(x, y, vx, vy, radius, spriteCol, spriteRow, color, side, sliceAngle) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.spriteCol = spriteCol;
        this.spriteRow = spriteRow;
        this.color = color;
        this.side = side; // -1 for left half, 1 for right half
        this.sliceAngle = sliceAngle;
        
        const separationSpeed = 4 + Math.random() * 3;
        const normalAngle = sliceAngle + (side * Math.PI / 2);
        this.vx = vx * 0.4 + Math.cos(normalAngle) * separationSpeed;
        this.vy = vy * 0.4 + Math.sin(normalAngle) * separationSpeed - 2;
        
        this.rotation = sliceAngle;
        this.vRot = side * (0.1 + Math.random() * 0.15);
        this.gravity = 0.42;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.rotation += this.vRot;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.beginPath();
        if (this.side === -1) {
            ctx.rect(-this.radius * 1.5, -this.radius * 1.5, this.radius * 1.5, this.radius * 3);
        } else {
            ctx.rect(0, -this.radius * 1.5, this.radius * 1.5, this.radius * 3);
        }
        ctx.clip();
        
        const cellW = fruitSprite.naturalWidth / 5 || 160;
        const cellH = fruitSprite.naturalHeight / 3 || 160;
        const sx = this.spriteCol * cellW;
        const sy = this.spriteRow * cellH;
        
        if (fruitSprite.complete && fruitSprite.naturalWidth > 0) {
            ctx.drawImage(
                fruitSprite,
                sx, sy, cellW, cellH,
                -this.radius, -this.radius, this.radius * 2, this.radius * 2
            );
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// Active Flying Entity (Fruit or Bomb)
class Entity {
    constructor() {
        this.radius = Math.random() * 15 + 35;
        this.x = Math.random() * (canvas.width * 0.7) + canvas.width * 0.15;
        this.y = canvas.height + this.radius;
        
        const targetX = canvas.width * (0.15 + Math.random() * 0.7);
        const targetY = canvas.height * (0.04 + Math.random() * 0.18);
        
        const timeToPeak = Math.max(1.6, 2.4 - (difficultyMultiplier * 0.2));
        this.vy = -Math.abs(this.y - targetY) / (timeToPeak * 30);
        this.vx = (targetX - this.x) / (timeToPeak * 60);
        this.gravity = 0.085 * difficultyMultiplier;
        
        this.isBomb = Math.random() < 0.2;
        
        this.spriteCol = Math.floor(Math.random() * 5);
        this.spriteRow = Math.floor(Math.random() * 3);
        const fruitInfo = fruitData[this.spriteRow][this.spriteCol];
        this.color = this.isBomb ? '#111' : fruitInfo.color;
        this.splashColor = this.isBomb ? '#ff9900' : fruitInfo.splash;
        
        this.sliced = false;
        this.rotation = Math.random() * Math.PI * 2;
        this.vRot = (Math.random() - 0.5) * 0.06;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.rotation += this.vRot;
    }

    draw() {
        if (this.sliced) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        if (this.isBomb) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#1e272e';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ff4757';
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(0, -this.radius);
            ctx.quadraticCurveTo(10, -this.radius - 12, 15, -this.radius - 18);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#d2dae2';
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(15, -this.radius - 18, 4 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fillStyle = Math.random() > 0.5 ? '#ffdd59' : '#ff5e57';
            ctx.fill();
        } else {
            const cellW = fruitSprite.naturalWidth / 5 || 160;
            const cellH = fruitSprite.naturalHeight / 3 || 160;
            const sx = this.spriteCol * cellW;
            const sy = this.spriteRow * cellH;
            
            if (fruitSprite.complete && fruitSprite.naturalWidth > 0) {
                ctx.drawImage(
                    fruitSprite,
                    sx, sy, cellW, cellH,
                    -this.radius, -this.radius, this.radius * 2, this.radius * 2
                );
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
}

// Particle Class
class Particle {
    constructor(x, y, color, speed = 10, isExplosion = false) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = isExplosion ? Math.random() * 6 + 3 : Math.random() * 4 + 2;
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * speed + 2;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.025;
        this.gravity = isExplosion ? 0.2 : 0.35;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// Floating Score / Combo Text Class
class FloatingText {
    constructor(x, y, text, color = '#ffffff', fontSize = 28) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.fontSize = fontSize;
        this.vy = -2.5;
        this.life = 1.0;
        this.decay = 0.025;
    }

    update() {
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = `900 ${this.fontSize}px 'Arial Black', Impact, sans-serif`;
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// Spawn Wave Logic
function spawnEntities() {
    const now = performance.now();
    const spawnInterval = Math.max(1200, 2400 - (difficultyMultiplier * 300));
    
    if (now - spawnTimer > spawnInterval) {
        spawnTimer = now;
        const waveSize = Math.floor(Math.random() * 2) + 1 + Math.floor(difficultyMultiplier * 0.5);
        let bombSpawnedInWave = false;
        
        for (let i = 0; i < waveSize; i++) {
            const entity = new Entity();
            if (entity.isBomb) {
                if (bombSpawnedInWave) {
                    entity.isBomb = false;
                } else {
                    bombSpawnedInWave = true;
                }
            }
            entities.push(entity);
        }
    }
}

// Geometry helper
function lineIntersectsCircle(p1, p2, circle) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return false;
    
    let t = ((circle.x - p1.x) * dx + (circle.y - p1.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    
    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;
    
    const distance = Math.hypot(circle.x - closestX, circle.y - closestY);
    return distance < circle.radius;
}

// Check Slicing Collisions
function checkCollisions() {
    if (sliceTrail.length < 2) return;
    
    const p1 = sliceTrail[sliceTrail.length - 2];
    const p2 = sliceTrail[sliceTrail.length - 1];
    const sliceAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    
    let hitCount = 0;
    let comboPoints = 0;
    let lastHitX = p2.x;
    let lastHitY = p2.y;
    
    for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        if (entity.sliced) continue;
        
        if (lineIntersectsCircle(p1, p2, entity)) {
            entity.sliced = true;
            lastHitX = entity.x;
            lastHitY = entity.y;
            
            if (entity.isBomb) {
                playSound('bomb');
                
                // Bomb penalty: decrease 1 life (NOT score)
                lives = Math.max(0, lives - 1);
                updateLivesDisplay();
                
                gameContainer.classList.remove('shake-animation', 'flash-animation');
                void gameContainer.offsetWidth; // Trigger reflow
                gameContainer.classList.add('shake-animation', 'flash-animation');
                setTimeout(() => {
                    gameContainer.classList.remove('shake-animation', 'flash-animation');
                }, 500);
                
                const explosionColors = ['#ff4757', '#ffa502', '#ffda79', '#ffffff', '#2f3542'];
                for (let p = 0; p < 45; p++) {
                    const col = explosionColors[Math.floor(Math.random() * explosionColors.length)];
                    particles.push(new Particle(entity.x, entity.y, col, 16, true));
                }
                
                floatingTexts.push(new FloatingText(entity.x, entity.y, '-1 LIFE!', '#ff4757', 36));
                
                if (lives <= 0) {
                    triggerGameOver('Out of lives!');
                    return;
                }
            } else {
                hitCount++;
                score += 10;
                comboPoints += 10;
                
                fruitHalves.push(new FruitHalf(
                    entity.x, entity.y, entity.vx, entity.vy,
                    entity.radius, entity.spriteCol, entity.spriteRow, entity.color, -1, sliceAngle
                ));
                fruitHalves.push(new FruitHalf(
                    entity.x, entity.y, entity.vx, entity.vy,
                    entity.radius, entity.spriteCol, entity.spriteRow, entity.color, 1, sliceAngle
                ));
                
                for (let p = 0; p < 20; p++) {
                    const particleColor = Math.random() > 0.4 ? entity.color : entity.splashColor;
                    particles.push(new Particle(entity.x, entity.y, particleColor, 12));
                }
            }
        }
    }
    
    // Combo Bonus Handling
    if (hitCount > 0) {
        if (hitCount > 1) {
            const bonus = hitCount * 5;
            score += bonus;
            playSound('combo', 1 + hitCount * 0.15);
            floatingTexts.push(new FloatingText(
                lastHitX, lastHitY,
                `${hitCount}x COMBO! +${comboPoints + bonus}`,
                '#f1c40f',
                32
            ));
        } else {
            playSound('slice');
            floatingTexts.push(new FloatingText(lastHitX, lastHitY, '+10', '#ffffff', 24));
        }
    }
    
    scoreEl.innerText = score;
}

// Render Glowing Blade Trail
function drawBladeTrail() {
    const now = performance.now();
    while (sliceTrail.length > 0 && now - sliceTrail[0].time > 180) {
        sliceTrail.shift();
    }
    
    if (sliceTrail.length < 2) return;
    
    ctx.save();
    for (let i = 1; i < sliceTrail.length; i++) {
        const p1 = sliceTrail[i - 1];
        const p2 = sliceTrail[i];
        const progress = i / sliceTrail.length;
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(46, 213, 115, ${progress * 0.85})`;
        ctx.lineWidth = progress * 10 + 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${progress * 0.95})`;
        ctx.lineWidth = progress * 4 + 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    
    const tip = sliceTrail[sliceTrail.length - 1];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#2ed573';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();
}

// Game Over
function triggerGameOver(reason) {
    if (gameState === 'gameover') return;
    gameState = 'gameover';
    isSlicing = false;
    finalScoreEl.innerText = score;
    if (finalLivesEl) {
        let hearts = '';
        for (let i = 0; i < MAX_LIVES; i++) {
            hearts += i < lives ? '❤️' : '🖤';
        }
        finalLivesEl.innerText = `${lives} (${hearts})`;
    }
    gameOverReasonEl.innerText = reason;
    
    if (hud) hud.classList.add('hidden');
    if (gameOverScreen) {
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.classList.add('active');
    }
    
    gameContainer.classList.add('shake-animation', 'flash-animation');
    setTimeout(() => {
        gameContainer.classList.remove('shake-animation', 'flash-animation');
    }, 500);
}

// Screen Navigation Helpers
function showHomeScreen() {
    gameState = 'home';
    isSlicing = false;
    
    if (homeScreen) {
        homeScreen.classList.remove('hidden');
        homeScreen.classList.add('active');
    }
    if (startScreen && startScreen !== homeScreen) {
        startScreen.classList.remove('active');
        startScreen.classList.add('hidden');
    }
    if (settingsScreen) {
        settingsScreen.classList.remove('active');
        settingsScreen.classList.add('hidden');
    }
    if (gameOverScreen) {
        gameOverScreen.classList.remove('active');
        gameOverScreen.classList.add('hidden');
    }
    if (hud) hud.classList.add('hidden');
}

function showSettingsScreen(fromScreen = 'home') {
    previousScreen = fromScreen;
    if (settingsScreen) {
        settingsScreen.classList.remove('hidden');
        settingsScreen.classList.add('active');
    }
}

function hideSettingsScreen() {
    if (settingsScreen) {
        settingsScreen.classList.remove('active');
        settingsScreen.classList.add('hidden');
    }
    if (previousScreen === 'playing' && gameState === 'playing') {
        if (hud) hud.classList.remove('hidden');
    } else if (previousScreen === 'gameover' && gameState === 'gameover') {
        if (gameOverScreen) {
            gameOverScreen.classList.remove('hidden');
            gameOverScreen.classList.add('active');
        }
    } else {
        showHomeScreen();
    }
}

// Main Game Loop
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'rgba(4, 2, 10, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        const elapsed = (timestamp - gameStartTime) / 1000;
        timeRemaining = Math.max(0, 45 - Math.floor(elapsed));
        timerEl.innerText = timeRemaining;
        
        if (timerBoard) {
            if (timeRemaining <= 10 && timeRemaining > 0) {
                timerBoard.classList.add('warning');
            } else {
                timerBoard.classList.remove('warning');
            }
        }
        
        if (timeRemaining <= 0) {
            triggerGameOver("Time's up!");
        }
        
        difficultyMultiplier = 1 + (elapsed / 45);
        spawnEntities();
    }
    
    if (gameState === 'playing' || gameState === 'gameover') {
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            if (gameState === 'playing') entity.update();
            entity.draw();
            
            if (entity.y > canvas.height + entity.radius * 2.5) {
                if (gameState === 'playing' && !entity.isBomb && !entity.sliced) {
                    misses++;
                    score = Math.max(0, score - 5);
                    scoreEl.innerText = score;
                }
                entities.splice(i, 1);
            } else if (entity.sliced) {
                entities.splice(i, 1);
            }
        }
        
        for (let i = fruitHalves.length - 1; i >= 0; i--) {
            const half = fruitHalves[i];
            if (gameState === 'playing') half.update();
            half.draw();
            
            if (half.y > canvas.height + half.radius * 3) {
                fruitHalves.splice(i, 1);
            }
        }
        
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            if (gameState === 'playing') p.update();
            p.draw();
            if (p.life <= 0) particles.splice(i, 1);
        }
        
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const ft = floatingTexts[i];
            if (gameState === 'playing') ft.update();
            ft.draw();
            if (ft.life <= 0) floatingTexts.splice(i, 1);
        }
        
        drawBladeTrail();
    }
    
    requestAnimationFrame(gameLoop);
}

// Start / Restart Game
function startGame() {
    autoResumeAudio();
    playSound('click');
    
    gameState = 'playing';
    score = 0;
    lives = 3;
    timeRemaining = 45;
    misses = 0;
    entities = [];
    fruitHalves = [];
    particles = [];
    floatingTexts = [];
    sliceTrail = [];
    isSlicing = false;
    difficultyMultiplier = 1;
    gameStartTime = performance.now();
    
    scoreEl.innerText = score;
    timerEl.innerText = timeRemaining;
    updateLivesDisplay();
    if (timerBoard) timerBoard.classList.remove('warning');
    
    if (homeScreen) {
        homeScreen.classList.remove('active');
        homeScreen.classList.add('hidden');
    }
    if (startScreen && startScreen !== homeScreen) {
        startScreen.classList.remove('active');
        startScreen.classList.add('hidden');
    }
    if (settingsScreen) {
        settingsScreen.classList.remove('active');
        settingsScreen.classList.add('hidden');
    }
    if (gameOverScreen) {
        gameOverScreen.classList.remove('active');
        gameOverScreen.classList.add('hidden');
    }
    if (hud) hud.classList.remove('hidden');
    
    spawnTimer = performance.now();
}

// Event Listeners for UI Buttons
const startGameBtn = document.getElementById('start-game-btn');
const startBtn = document.getElementById('start-btn');

if (startGameBtn) startGameBtn.addEventListener('click', startGame);
if (startBtn && startBtn !== startGameBtn) startBtn.addEventListener('click', startGame);

const restartBtn = document.getElementById('restart-btn');
if (restartBtn) restartBtn.addEventListener('click', startGame);

const homeSettingsBtn = document.getElementById('home-settings-btn');
if (homeSettingsBtn) {
    homeSettingsBtn.addEventListener('click', () => {
        playSound('click');
        showSettingsScreen('home');
    });
}

const hudSettingsBtn = document.getElementById('hud-settings-btn');
if (hudSettingsBtn) {
    hudSettingsBtn.addEventListener('click', () => {
        playSound('click');
        showSettingsScreen(gameState);
    });
}

const settingsBackBtn = document.getElementById('settings-back-btn');
if (settingsBackBtn) {
    settingsBackBtn.addEventListener('click', () => {
        playSound('click');
        hideSettingsScreen();
    });
}

const homeBtn = document.getElementById('home-btn');
if (homeBtn) {
    homeBtn.addEventListener('click', () => {
        playSound('click');
        showHomeScreen();
    });
}

// Settings Audio Toggles
const sfxToggleBtn = document.getElementById('sfx-toggle');
const musicToggleBtn = document.getElementById('music-toggle');
const muteToggleBtn = document.getElementById('mute-toggle');

if (sfxToggleBtn) {
    sfxToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        sfxToggleBtn.classList.toggle('active', soundEnabled);
        sfxToggleBtn.innerText = soundEnabled ? 'ON' : 'OFF';
        updateAudioGains();
        if (soundEnabled) playSound('click');
    });
}

if (musicToggleBtn) {
    musicToggleBtn.addEventListener('click', () => {
        musicEnabled = !musicEnabled;
        musicToggleBtn.classList.toggle('active', musicEnabled);
        musicToggleBtn.innerText = musicEnabled ? 'ON' : 'OFF';
        updateAudioGains();
        if (soundEnabled) playSound('click');
    });
}

if (muteToggleBtn) {
    muteToggleBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        muteToggleBtn.classList.toggle('active', isMuted);
        muteToggleBtn.innerText = isMuted ? 'ON (MUTED)' : 'OFF';
        updateAudioGains();
        if (!isMuted && soundEnabled) playSound('click');
    });
}

// Start BGM Scheduler & Show Home Screen
startBGMScheduler();
showHomeScreen();

// Start Game Loop
requestAnimationFrame(gameLoop);
