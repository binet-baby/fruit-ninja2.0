const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const finalScoreEl = document.getElementById('final-score');
const gameOverReasonEl = document.getElementById('game-over-reason');
const gameContainer = document.getElementById('game-container');

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Image Assets
const fruitSprite = new Image();
fruitSprite.src = 'fruits.png';

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'slice') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'bomb') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

// Game State
let gameState = 'start'; // start, playing, gameover
let score = 0;
let timeRemaining = 60;
let misses = 0;
const MAX_MISSES = 3;
let entities = [];
let particles = [];
let sliceTrail = [];
let isSlicing = false;

// Time tracking
let lastTime = 0;
let spawnTimer = 0;
let difficultyMultiplier = 1;
let gameStartTime = 0;

// Colors for fruits
const fruitColors = ['#e74c3c', '#2ecc71', '#9b59b6', '#f1c40f', '#e67e22'];

// Resize Canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Input Handling
function addTrailPoint(x, y) {
    sliceTrail.push({ x, y });
    if (sliceTrail.length > 2) sliceTrail.shift();
}

function handleStart(e) {
    if (gameState !== 'playing') return;
    isSlicing = true;
    sliceTrail = [];
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    addTrailPoint(clientX, clientY);
}

function handleMove(e) {
    if (!isSlicing || gameState !== 'playing') return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    addTrailPoint(clientX, clientY);
    checkCollisions();
}

function handleEnd() {
    isSlicing = false;
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);
canvas.addEventListener('touchstart', handleStart, {passive: false});
canvas.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd);

// Classes
class Entity {
    constructor() {
        this.radius = Math.random() * 20 + 30;
        this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
        this.y = canvas.height + this.radius;
        
        // Target roughly the center top
        const targetX = canvas.width / 2 + (Math.random() * 200 - 100);
        const targetY = canvas.height * 0.1;
        
        // Calculate velocity to reach target height
        const timeToPeak = 2.5 - (difficultyMultiplier * 0.2); // gets faster
        this.vy = -Math.abs(this.y - targetY) / (timeToPeak * 30); 
        this.vx = (targetX - this.x) / (timeToPeak * 60);
        
        this.gravity = 0.08 * difficultyMultiplier;
        this.isBomb = Math.random() < 0.2; // 20% chance to be a bomb
        this.color = this.isBomb ? '#000' : fruitColors[Math.floor(Math.random() * fruitColors.length)];
        this.sliced = false;
        
        // Sprite selection (3 rows, 5 columns)
        this.spriteCol = Math.floor(Math.random() * 5);
        this.spriteRow = Math.floor(Math.random() * 3);
        
        // For bomb fuse
        this.rotation = 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.rotation += 0.05;
    }

    draw() {
        if (this.sliced) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        if (this.isBomb) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            
            // Draw fuse
            ctx.beginPath();
            ctx.moveTo(0, -this.radius);
            ctx.quadraticCurveTo(10, -this.radius - 10, 20, -this.radius - 5);
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 4;
            ctx.stroke();
            // Spark
            ctx.beginPath();
            ctx.arc(20, -this.radius - 5, Math.random() * 5 + 3, 0, Math.PI*2);
            ctx.fillStyle = '#f1c40f';
            ctx.fill();
            
            // Bomb highlight
            ctx.beginPath();
            ctx.arc(-this.radius*0.3, -this.radius*0.3, this.radius*0.2, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fill();
        } else {
            // Draw fruit sprite
            if (fruitSprite.complete && fruitSprite.naturalWidth !== 0) {
                const spriteW = fruitSprite.width / 5;
                const spriteH = fruitSprite.height / 3;
                const drawSize = this.radius * 2.5; // Scale up to cover the collision radius well
                
                ctx.drawImage(
                    fruitSprite,
                    this.spriteCol * spriteW, this.spriteRow * spriteH, spriteW, spriteH,
                    -drawSize/2, -drawSize/2, drawSize, drawSize
                );
            } else {
                // Fallback if image not loaded
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1;
        this.color = color;
        this.size = Math.random() * 5 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
        this.life -= 0.02;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Logic
function spawnEntities() {
    const spawnRate = Math.max(500, 1500 - (difficultyMultiplier * 200));
    if (performance.now() - spawnTimer > spawnRate) {
        const count = Math.floor(Math.random() * 3) + 1;
        for(let i=0; i<count; i++) {
            entities.push(new Entity());
        }
        spawnTimer = performance.now();
    }
}

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

function checkCollisions() {
    if (sliceTrail.length < 2) return;
    
    const p1 = sliceTrail[sliceTrail.length - 2];
    const p2 = sliceTrail[sliceTrail.length - 1];
    
    let hitCount = 0;
    
    for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        if (entity.sliced) continue;
        
        if (lineIntersectsCircle(p1, p2, entity)) {
            entity.sliced = true;
            
            if (entity.isBomb) {
                playSound('bomb');
                // Penalty for hitting a bomb
                score = Math.max(0, score - 50);
            } else {
                playSound('slice');
                hitCount++;
                score += 10;
                
                // Spawn particles
                for(let p=0; p<15; p++) {
                    particles.push(new Particle(entity.x, entity.y, entity.color));
                }
            }
        }
    }
    
    if (hitCount > 1) {
        // Combo bonus
        score += hitCount * 5;
    }
    
    scoreEl.innerText = score;
}

function triggerGameOver(reason) {
    gameState = 'gameover';
    finalScoreEl.innerText = score;
    gameOverReasonEl.innerText = reason;
    
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    gameOverScreen.classList.add('active');
    
    gameContainer.classList.add('shake-animation', 'flash-animation');
    setTimeout(() => {
        gameContainer.classList.remove('shake-animation', 'flash-animation');
    }, 500);
}

// Main Loop
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        // Precise timer logic using timestamp
        const elapsed = (timestamp - gameStartTime) / 1000;
        timeRemaining = Math.max(0, 60 - Math.floor(elapsed));
        timerEl.innerText = timeRemaining;
        
        if (timeRemaining <= 0) {
            triggerGameOver("Time's up!");
        }
        
        difficultyMultiplier = 1 + (elapsed / 60); // Max 2x at end
        spawnEntities();
    }
    
    if (gameState === 'playing' || gameState === 'gameover') {
        // Update & Draw Entities
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            if (gameState === 'playing') entity.update();
            entity.draw();
            
            // Remove off-screen entities
            if (gameState === 'playing' && entity.y > canvas.height + entity.radius * 2) {
                if (!entity.isBomb && !entity.sliced) {
                    misses++;
                    score = Math.max(0, score - 5); // Just deduct points for misses
                }
                entities.splice(i, 1);
            }
        }
        
        // Update & Draw Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            if (gameState === 'playing') p.update();
            p.draw();
            if (p.life <= 0 && gameState === 'playing') particles.splice(i, 1);
        }
        
        // Draw Slicing Symbol
        if (isSlicing && sliceTrail.length > 0) {
            const pos = sliceTrail[sliceTrail.length - 1];
            ctx.font = '40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔪', pos.x, pos.y);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Start Game
let timerInterval = null; // Unused now but keep variable just in case

function startGame() {
    gameState = 'playing';
    score = 0;
    timeRemaining = 60;
    misses = 0;
    entities = [];
    particles = [];
    sliceTrail = [];
    difficultyMultiplier = 1;
    gameStartTime = performance.now();
    
    scoreEl.innerText = score;
    timerEl.innerText = timeRemaining;
    
    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.remove('active');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    
    audioCtx.resume();
    
    spawnTimer = performance.now();
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

requestAnimationFrame(gameLoop);
