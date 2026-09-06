const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
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

// Audio Context (Synthesized Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Image Assets — Horror Sprite Sheet
const fruitSprite = new Image();
fruitSprite.src = 'horror_fruits.png';

// Horror Fruit Sprite Sheet Data: 5 columns x 3 rows (800 x 480)
// Row 0: Evil Watermelon, Stitched Apple, Screaming Banana, Skull Pineapple, Zombie Strawberry
// Row 1: Crazy Kiwi, Zombie Orange, Sinister Grapes, Evil Watermelon alt, Stitched Apple alt
// Row 2: Screaming Banana alt, Skull Pineapple alt, Zombie Strawberry alt, Crazy Kiwi alt, Zombie Orange alt
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
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    if (type === 'slice') {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        const baseFreq = 750 * pitchMultiplier;
        osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(280 * pitchMultiplier, audioCtx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } else if (type === 'bomb') {
        // Bomb explosion synth: square rumble + low boom
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(15, audioCtx.currentTime + 0.6);
        gainNode.gain.setValueAtTime(0.6, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    } else if (type === 'combo') {
        // Combo fanfare chime
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'sine';
            const startTime = audioCtx.currentTime + idx * 0.05;
            osc.frequency.setValueAtTime(freq * pitchMultiplier, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            osc.start(startTime);
            osc.stop(startTime + 0.2);
        });
    }
}

// Game State
let gameState = 'start'; // 'start', 'playing', 'gameover'
let score = 0;
let lives = 3;
const MAX_LIVES = 3;
let timeRemaining = 45;
let misses = 0;
const MAX_MISSES = 3;

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
    // Keep trail points from the last 180ms
    while (sliceTrail.length > 0 && now - sliceTrail[0].time > 180) {
        sliceTrail.shift();
    }
}

function handleStart(e) {
    if (gameState !== 'playing') return;
    if (e.cancelable) e.preventDefault();
    isSlicing = true;
    sliceTrail = [];
    const pos = getEventPos(e);
    addTrailPoint(pos.x, pos.y);
}

function handleMove(e) {
    if (!isSlicing || gameState !== 'playing') return;
    if (e.cancelable) e.preventDefault();
    const pos = getEventPos(e);
    addTrailPoint(pos.x, pos.y);
    checkCollisions();
}

function handleEnd(e) {
    isSlicing = false;
}

// Attach listeners (with canvas & window fallbacks)
canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

canvas.addEventListener('touchstart', handleStart, { passive: false });
window.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd);

// Classes

// Sliced Fruit Half (tumbles in half when sliced)
class FruitHalf {
    constructor(x, y, vx, vy, radius, spriteCol, spriteRow, color, side, sliceAngle) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.spriteCol = spriteCol;
        this.spriteRow = spriteRow;
        this.color = color;
        this.side = side; // -1 for left half, +1 for right half
        
        // Push outward perpendicular to cut angle
        const perpAngle = sliceAngle + Math.PI / 2;
        const pushSpeed = 3.5;
        this.vx = vx + Math.cos(perpAngle) * pushSpeed * side;
        this.vy = vy + Math.sin(perpAngle) * pushSpeed * side - 2;
        this.gravity = 0.35;
        this.rotation = sliceAngle;
        this.vRot = (Math.random() * 0.08 + 0.05) * side;
        this.alpha = 1;
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
        
        // Clip along the cut axis
        ctx.beginPath();
        if (this.side === -1) {
            ctx.rect(-this.radius * 2, -this.radius * 2, this.radius * 2, this.radius * 4);
        } else {
            ctx.rect(0, -this.radius * 2, this.radius * 2, this.radius * 4);
        }
        ctx.clip();
        
        if (fruitSprite.complete && fruitSprite.naturalWidth !== 0) {
            const spriteW = fruitSprite.width / 5;
            const spriteH = fruitSprite.height / 3;
            const drawSize = this.radius * 2.5;
            ctx.drawImage(
                fruitSprite,
                this.spriteCol * spriteW, this.spriteRow * spriteH, spriteW, spriteH,
                -drawSize / 2, -drawSize / 2, drawSize, drawSize
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
        
        // Spawn across screen width with safety padding
        this.x = Math.random() * (canvas.width * 0.7) + canvas.width * 0.15;
        this.y = canvas.height + this.radius;
        
        // Target a higher arc across the upper portion of the screen
        const targetX = canvas.width * (0.15 + Math.random() * 0.7);
        const targetY = canvas.height * (0.04 + Math.random() * 0.18);
        
        // Calculate physics velocity to smoothly reach target peak
        const timeToPeak = Math.max(1.6, 2.4 - (difficultyMultiplier * 0.2));
        this.vy = -Math.abs(this.y - targetY) / (timeToPeak * 30);
        this.vx = (targetX - this.x) / (timeToPeak * 60);
        this.gravity = 0.085 * difficultyMultiplier;
        
        // 20% chance to be a bomb
        this.isBomb = Math.random() < 0.2;
        
        // Sprite selection (3 rows, 5 columns)
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
            // Bomb shadow
            ctx.beginPath();
            ctx.arc(4, 4, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fill();

            // Bomb main body
            const gradient = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 5, 0, 0, this.radius);
            gradient.addColorStop(0, '#555');
            gradient.addColorStop(0.7, '#1a1a1a');
            gradient.addColorStop(1, '#000');
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Bomb cap
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(-this.radius * 0.25, -this.radius - 6, this.radius * 0.5, 8);
            
            // Curved fuse
            ctx.beginPath();
            ctx.moveTo(0, -this.radius - 6);
            ctx.quadraticCurveTo(15, -this.radius - 22, 22, -this.radius - 12);
            ctx.strokeStyle = '#d35400';
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // Animated burning spark
            const sparkSize = Math.random() * 6 + 4;
            ctx.beginPath();
            ctx.arc(22, -this.radius - 12, sparkSize, 0, Math.PI * 2);
            ctx.fillStyle = Math.random() > 0.5 ? '#f1c40f' : '#ff4757';
            ctx.fill();
        } else {
            // Draw fruit sprite
            if (fruitSprite.complete && fruitSprite.naturalWidth !== 0) {
                const spriteW = fruitSprite.width / 5;
                const spriteH = fruitSprite.height / 3;
                const drawSize = this.radius * 2.5;
                
                ctx.drawImage(
                    fruitSprite,
                    this.spriteCol * spriteW, this.spriteRow * spriteH, spriteW, spriteH,
                    -drawSize / 2, -drawSize / 2, drawSize, drawSize
                );
            } else {
                // Fallback circle if image not loaded
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
}

// Particle System (Juice bursts and bomb sparks)
class Particle {
    constructor(x, y, color, speed = 10, isBombParticle = false) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * speed + 2;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.02;
        this.color = color;
        this.size = Math.random() * 6 + 3;
        this.gravity = isBombParticle ? 0.08 : 0.25;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
    }

    draw() {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Floating Text Indicator (+10, COMBO!, BOMB!)
class FloatingText {
    constructor(x, y, text, color = '#f1c40f', fontSize = 28) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.fontSize = fontSize;
        this.life = 1;
        this.vy = -2.2;
    }

    update() {
        this.y += this.vy;
        this.life -= 0.022;
    }

    draw() {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = `900 ${this.fontSize}px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Text stroke
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 5;
        ctx.strokeText(this.text, this.x, this.y);
        
        // Fill
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// Logic: Wave Spawning
function spawnEntities() {
    const spawnRate = Math.max(700, 1700 - (difficultyMultiplier * 350));
    if (performance.now() - spawnTimer > spawnRate) {
        // Spawn wave of 1 to 3 items (increasing with difficulty)
        const waveCount = Math.min(4, Math.floor(Math.random() * (1.5 + difficultyMultiplier * 0.7)) + 1);
        let bombSpawnedInWave = false;
        
        for (let i = 0; i < waveCount; i++) {
            const entity = new Entity();
            // Prevent waves of pure bombs
            if (entity.isBomb) {
                if (bombSpawnedInWave) {
                    entity.isBomb = false;
                    entity.color = fruitData[entity.spriteRow][entity.spriteCol].color;
                } else {
                    bombSpawnedInWave = true;
                }
            }
            entities.push(entity);
        }
        spawnTimer = performance.now();
    }
}

// Collision helper: Line segment to circle intersection
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
                
                // Screen shake and flash animation
                gameContainer.classList.remove('shake-animation', 'flash-animation');
                void gameContainer.offsetWidth; // Trigger reflow
                gameContainer.classList.add('shake-animation', 'flash-animation');
                setTimeout(() => {
                    gameContainer.classList.remove('shake-animation', 'flash-animation');
                }, 500);
                
                // Explosion particles
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
                
                // Sliced fruit halves
                fruitHalves.push(new FruitHalf(
                    entity.x, entity.y, entity.vx, entity.vy,
                    entity.radius, entity.spriteCol, entity.spriteRow, entity.color, -1, sliceAngle
                ));
                fruitHalves.push(new FruitHalf(
                    entity.x, entity.y, entity.vx, entity.vy,
                    entity.radius, entity.spriteCol, entity.spriteRow, entity.color, 1, sliceAngle
                ));
                
                // Juice splatter particles
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
    // Prune stale trail points
    while (sliceTrail.length > 0 && now - sliceTrail[0].time > 180) {
        sliceTrail.shift();
    }
    
    if (sliceTrail.length < 2) return;
    
    ctx.save();
    for (let i = 1; i < sliceTrail.length; i++) {
        const p1 = sliceTrail[i - 1];
        const p2 = sliceTrail[i];
        const progress = i / sliceTrail.length; // 0 at tail, 1 at tip
        
        // Outer glowing ectoplasm blade (slime green glow)
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(46, 213, 115, ${progress * 0.85})`;
        ctx.lineWidth = progress * 10 + 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // Inner white-hot core
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${progress * 0.95})`;
        ctx.lineWidth = progress * 4 + 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    
    // Glowing gleam at the blade tip
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
    
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
    
    gameContainer.classList.add('shake-animation', 'flash-animation');
    setTimeout(() => {
        gameContainer.classList.remove('shake-animation', 'flash-animation');
    }, 500);
}

// Main Game Loop
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a subtle dark translucent wash so the CSS graveyard background
    // shows through the canvas while keeping fruits clearly visible
    ctx.fillStyle = 'rgba(4, 2, 10, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        // Precise 45-second countdown timer
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
        
        difficultyMultiplier = 1 + (elapsed / 45); // Scales to 2x at end of round
        spawnEntities();
    }
    
    if (gameState === 'playing' || gameState === 'gameover') {
        // Update & Draw Active Flying Entities
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            if (gameState === 'playing') entity.update();
            entity.draw();
            
            // Remove entities that fall below the screen
            if (entity.y > canvas.height + entity.radius * 2.5) {
                if (gameState === 'playing' && !entity.isBomb && !entity.sliced) {
                    misses++;
                    score = Math.max(0, score - 5); // Deduct 5 points on miss
                    scoreEl.innerText = score;
                }
                entities.splice(i, 1);
            } else if (entity.sliced) {
                entities.splice(i, 1);
            }
        }
        
        // Update & Draw Sliced Fruit Halves
        for (let i = fruitHalves.length - 1; i >= 0; i--) {
            const half = fruitHalves[i];
            if (gameState === 'playing') half.update();
            half.draw();
            
            if (half.y > canvas.height + half.radius * 3) {
                fruitHalves.splice(i, 1);
            }
        }
        
        // Update & Draw Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            if (gameState === 'playing') p.update();
            p.draw();
            if (p.life <= 0) particles.splice(i, 1);
        }
        
        // Update & Draw Floating Score/Combo Texts
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const ft = floatingTexts[i];
            if (gameState === 'playing') ft.update();
            ft.draw();
            if (ft.life <= 0) floatingTexts.splice(i, 1);
        }
        
        // Draw Slicing Blade Trail
        drawBladeTrail();
    }
    
    requestAnimationFrame(gameLoop);
}

// Start / Restart Game
function startGame() {
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
    
    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    
    audioCtx.resume();
    spawnTimer = performance.now();
}

// Event Listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// Start game loop
requestAnimationFrame(gameLoop);
