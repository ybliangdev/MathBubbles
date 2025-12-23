let score = 0;
let currentTarget = 10;
let gameActive = false;
let bubbles = [];
let selectedBubbles = [];
let spawnRate = 1500; // ms
let lastSpawn = 0;
let gameSpeed = 1;
let timeLeft = 60;
let lastTimeUpdate = 0;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const targetElement = document.getElementById('target');
const timerElement = document.getElementById('timer');

// Audio Context for Haptic Fallback (iOS)
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playPopSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// Colors for bubbles
const colors = [
    'rgba(99, 102, 241, 0.6)', // Indigo
    'rgba(236, 72, 153, 0.6)', // Pink
    'rgba(168, 85, 247, 0.6)', // Purple
    'rgba(34, 197, 94, 0.6)',  // Green
    'rgba(59, 130, 246, 0.6)'  // Blue
];

class Bubble {
    constructor() {
        // Use logical dimensions for spawning
        const logicalWidth = canvas.offsetWidth;
        const logicalHeight = canvas.offsetHeight;

        this.radius = Math.random() * 20 + 35; // Size 35-55
        this.x = Math.random() * (logicalWidth - this.radius * 2) + this.radius;
        this.y = logicalHeight + this.radius;
        // Ensure values are within a range that makes sense for the current target
        this.value = Math.floor(Math.random() * (currentTarget - 1)) + 1;
        // Reverted to normal speed (removed 0.66)
        this.speed = (Math.random() * 0.5 + 0.5) * gameSpeed;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.selected = false;
        this.popping = false;
        this.popScale = 1;
        this.opacity = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Shadow/Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.selected ? '#fbbf24' : 'rgba(255, 255, 255, 0.2)';

        // Inner Gradient
        const gradient = ctx.createRadialGradient(
            this.x - this.radius / 3, this.y - this.radius / 3, this.radius / 10,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, this.color);

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * this.popScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Stroke
        ctx.strokeStyle = this.selected ? '#fbbf24' : 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = this.selected ? 4 : 2;
        ctx.stroke();

        // Text
        ctx.fillStyle = 'white';
        ctx.font = `bold ${this.radius * 0.8}px Outfit`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.value, this.x, this.y);

        ctx.restore();
    }

    update() {
        if (this.popping) {
            this.popScale += 0.1;
            this.opacity -= 0.1;
            return;
        }
        this.y -= this.speed;

        // Wobble effect
        this.x += Math.sin(this.y * 0.05) * 0.5;
    }

    isClicked(mx, my) {
        // Added 20px hit margin to make it easier to tap on small screens
        const dist = Math.sqrt((mx - this.x) ** 2 + (my - this.y) ** 2);
        return dist < (this.radius + 20);
    }
}

function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
}

window.addEventListener('resize', resize);
resize();

function spawnBubble() {
    bubbles.push(new Bubble());
}

function handleVibrate() {
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
    playPopSound(); // Sound feedback as fallback for iOS
}

function handleClick(e) {
    if (!gameActive) return;

    // Prevent default to avoid double events on mobile
    if (e.type === 'touchstart') {
        initAudio(); // Initialize audio on first user touch
    }

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.isClicked(x, y) && !b.popping) {
            if (b.selected) {
                b.selected = false;
                selectedBubbles = selectedBubbles.filter(sb => sb !== b);
            } else {
                b.selected = true;
                selectedBubbles.push(b);
                handleVibrate();
            }

            if (selectedBubbles.length === 2) {
                const sum = selectedBubbles[0].value + selectedBubbles[1].value;
                if (sum === currentTarget) {
                    // Correct!
                    selectedBubbles.forEach(sb => {
                        sb.popping = true;
                        score += 10;
                    });
                    scoreElement.innerText = score;
                    selectedBubbles = [];
                    handleVibrate(); // Double vibrate for success?
                    setTimeout(() => handleVibrate(), 100);

                    // Increase difficulty
                    gameSpeed += 0.02;

                    // Change target on every match
                    updateTarget();
                } else {
                    // Wrong! Deselect
                    setTimeout(() => {
                        selectedBubbles.forEach(sb => sb.selected = false);
                        selectedBubbles = [];
                    }, 200);
                }
            }
            break;
        }
    }
}

canvas.addEventListener('mousedown', handleClick);
canvas.addEventListener('touchstart', (e) => {
    handleClick(e);
    e.preventDefault();
}, { passive: false });

function update(time) {
    if (!gameActive) return;

    // Use physical dimensions for clearing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (time - lastSpawn > spawnRate) {
        spawnBubble();
        lastSpawn = time;
        // Speeds up spawning over time
        spawnRate = Math.max(800, 1500 - (score * 0.5));
    }

    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.update();
        b.draw();

        // If bubble hits top, just remove it. Target stays until matched.
        if (b.y < -b.radius && !b.popping) {
            b.popping = true;
            handleVibrate();
        }

        // Remove popped or off-screen
        if (b.opacity <= 0) {
            bubbles.splice(i, 1);
        }
    }

    // Timer Update - outside bubble loop
    if (time - lastTimeUpdate >= 1000) {
        timeLeft--;
        timerElement.innerText = timeLeft;
        lastTimeUpdate = time;
        if (timeLeft <= 0) {
            endGame();
            return;
        }
    }

    requestAnimationFrame(update);
}

function updateTarget() {
    if (score > 100) {
        currentTarget = Math.floor(Math.random() * 31) + 30; // 30-60
    } else {
        currentTarget = Math.floor(Math.random() * 21) + 10; // 10-30
    }
    targetElement.innerText = currentTarget;

    // Pulse animation for target change
    targetElement.parentElement.classList.add('target-pulse');
    setTimeout(() => {
        targetElement.parentElement.classList.remove('target-pulse');
    }, 500);
}

function startGame() {
    score = 0;
    timeLeft = 60;
    gameSpeed = 1;
    spawnRate = 1500;
    bubbles = [];
    selectedBubbles = [];
    scoreElement.innerText = score;
    timerElement.innerText = timeLeft;
    updateTarget();
    gameActive = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    lastSpawn = performance.now();
    lastTimeUpdate = performance.now();
    requestAnimationFrame(update);
}

function endGame() {
    gameActive = false;
    finalScoreElement.innerText = score;
    saveScore(score);
    updateHistoryUI();
    gameOverScreen.classList.remove('hidden');
}

function saveScore(newScore) {
    let history = JSON.parse(localStorage.getItem('math_bubble_scores')) || [];
    const entry = {
        score: newScore,
        date: new Date().toLocaleString()
    };
    history.unshift(entry);
    // Keep only last 100
    if (history.length > 100) history = history.slice(0, 100);
    localStorage.setItem('math_bubble_scores', JSON.stringify(history));
}

function updateHistoryUI() {
    const list = document.getElementById('history-list');
    const highScoreElement = document.getElementById('high-score');
    const history = JSON.parse(localStorage.getItem('math_bubble_scores')) || [];
    list.innerHTML = '';

    // Calculate High Score
    if (history.length > 0) {
        const highScore = Math.max(...history.map(h => h.score));
        highScoreElement.innerText = highScore;
    } else {
        highScoreElement.innerText = '0';
    }

    // Show top 10 on the UI to keep it clean, though 100 are saved
    history.slice(0, 10).forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${entry.date}</span> <b>${entry.score}</b>`;
        list.appendChild(li);
    });
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
