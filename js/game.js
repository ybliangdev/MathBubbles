let gameMode = 'normal'; // 'normal' or 'easy'
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
let indicators = [];

const feedbackMessages = ["Good job!", "Great!", "Perfect!", "Fantastic!", "Amazing!", "Well done!"];

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const easyBtn = document.getElementById('easy-btn');
const hardBtn = document.getElementById('hard-btn');
const restartBtn = document.getElementById('restart-btn');
const exitBtn = document.getElementById('exit-btn');

const targetElement = document.getElementById('target');
const timerElement = document.getElementById('timer');

// Audio Context for Haptic Fallback (iOS)
let audioCtx;
async function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

function playSound(type = 'pop') {
    if (!audioCtx || audioCtx.state !== 'running') return;

    if (type === 'pop') {
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
    } else if (type === 'success') {
        // Magic Sparkle: 4-note rising arpeggio (C-E-G-C)
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const time = audioCtx.currentTime + (i * 0.06); // Faster timing for sparkle
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.08, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(time);
            osc.stop(time + 0.15);
        });
    } else if (type === 'match') {
        // Power-Up Slide: Frequency glide low to high
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'bomb') {
        // Low "Boom" sound
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
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
    constructor(type = 'number', forcedValue = null) {
        const logicalWidth = canvas.offsetWidth;
        const logicalHeight = canvas.offsetHeight;

        this.type = type; // 'number', 'time', 'star'
        this.radius = Math.random() * 20 + 35; // Size 35-55
        this.x = Math.random() * (logicalWidth - this.radius * 2) + this.radius;
        this.y = logicalHeight + this.radius;

        if (this.type === 'number') {
            this.value = forcedValue !== null ? forcedValue : Math.floor(Math.random() * (currentTarget - 1)) + 1;
            this.color = colors[Math.floor(Math.random() * colors.length)];
        } else if (this.type === 'time') {
            this.value = '⏰';
            this.color = 'rgba(34, 197, 94, 0.7)'; // Greenish
        } else if (this.type === 'star') {
            this.value = '⭐';
            this.color = 'rgba(251, 191, 36, 0.7)'; // Golden
        } else if (this.type === 'bomb') {
            this.value = '💣';
            this.color = 'rgba(239, 68, 68, 0.7)'; // Reddish
        }

        this.speed = (Math.random() * 0.5 + 0.5) * gameSpeed;
        this.selected = false;
        this.popping = false;
        this.popScale = 1;
        this.opacity = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;

        // Special Glow for bonus/penalty bubbles
        if (this.type === 'time') {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#22c55e';
        } else if (this.type === 'star') {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#fbbf24';
        } else if (this.type === 'bomb') {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ef4444';
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.selected ? '#fbbf24' : 'rgba(255, 255, 255, 0.2)';
        }

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

        // Text / Icon
        ctx.fillStyle = 'white';
        const fontSize = this.type === 'number' ? this.radius * 0.8 : this.radius * 1.0;
        ctx.font = `bold ${fontSize}px Outfit`;
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

class Indicator {
    constructor(x, y, text) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.opacity = 1;
        this.speedy = -1.5;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }

    update() {
        this.y += this.speedy;
        this.opacity -= 0.02;
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
    const logicalWidth = canvas.offsetWidth;
    let type = 'number';
    let forcedValue = null;

    const rand = Math.random();
    if (rand < 0.02) {
        type = 'star';
    } else if (rand < 0.05) {
        type = 'bomb';
    } else if (rand < 0.10) {
        type = 'time';
    } else {
        // 50% chance to spawn a guaranteed match if target is high
        if (Math.random() < 0.5 && bubbles.length > 0) {
            const numericBubbles = bubbles.filter(b => b.type === 'number' && !b.popping && b.value < currentTarget);
            if (numericBubbles.length > 0) {
                const partner = numericBubbles[Math.floor(Math.random() * numericBubbles.length)];
                forcedValue = currentTarget - partner.value;
            }
        }
    }

    const newBubble = new Bubble(type, forcedValue);

    // Simple anti-overlap on spawn: if too close to last few bubbles, nudge it
    const lastFew = bubbles.slice(-3);
    for (const b of lastFew) {
        const dist = Math.abs(newBubble.x - b.x);
        if (dist < 80) { // Nudge if centers are closer than 80px
            newBubble.x = (newBubble.x + 100) % (logicalWidth - newBubble.radius * 2) + newBubble.radius;
        }
    }

    bubbles.push(newBubble);
}

function handleVibrate(type = 'pop') {
    if (navigator.vibrate) {
        if (type === 'match' || type === 'success') navigator.vibrate([50, 30, 50]);
        else if (type === 'bomb') navigator.vibrate([100, 50, 100]);
        else navigator.vibrate(50);
    }
    playSound(type); // Sound feedback
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

    let closestBubble = null;
    let minDist = Infinity;

    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (!b.popping) {
            const dist = Math.sqrt((x - b.x) ** 2 + (y - b.y) ** 2);
            // Check if within hit range (radius + 20px margin)
            if (dist < (b.radius + 20)) {
                if (dist < minDist) {
                    minDist = dist;
                    closestBubble = b;
                }
            }
        }
    }

    if (closestBubble) {
        const b = closestBubble;

        // Bonus Bubble Logic: Pop immediately
        if (b.type === 'time') {
            b.popping = true;
            timeLeft = Math.min(timeLeft + 10, 120); // Bonus +10s, max 120s
            timerElement.innerText = timeLeft;
            showFeedback(b.x, b.y, "+10s ⏰");
            handleVibrate('success');
            return;
        }
        if (b.type === 'star') {
            b.popping = true;
            score += 50;
            scoreElement.innerText = score;
            showFeedback(b.x, b.y, "+50 ⭐");
            handleVibrate('success');
            // Star bubbles also slightly increase speed
            gameSpeed += 0.05;
            return;
        }
        if (b.type === 'bomb') {
            b.popping = true;
            score = Math.max(0, score - 10);
            scoreElement.innerText = score;
            showFeedback(b.x, b.y, "-10 💣");
            handleVibrate('bomb');
            // Clear all other bubbles
            bubbles.forEach(bubble => {
                if (!bubble.popping) bubble.popping = true;
            });
            return;
        }

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
                const midX = (selectedBubbles[0].x + selectedBubbles[1].x) / 2;
                const midY = (selectedBubbles[0].y + selectedBubbles[1].y) / 2;
                showFeedback(midX, midY);

                selectedBubbles.forEach(sb => {
                    sb.popping = true;
                    score += 10;
                });
                scoreElement.innerText = score;
                selectedBubbles = [];
                handleVibrate('match'); // Power-Up Slide for math match

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
    }
}

canvas.addEventListener('mousedown', handleClick);
canvas.addEventListener('touchstart', (e) => {
    handleClick(e);
    e.preventDefault();
}, { passive: false });

function showFeedback(x, y, customMsg = null) {
    const msg = customMsg || feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)];
    indicators.push(new Indicator(x, y, msg));
}

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
            if (gameMode === 'hard') {
                score -= 1;
                scoreElement.innerText = score;
            }
        }

        // Remove popped or off-screen
        if (b.opacity <= 0) {
            bubbles.splice(i, 1);
        }
    }

    // Update and Draw Indicators
    for (let i = indicators.length - 1; i >= 0; i--) {
        const ind = indicators[i];
        ind.update();
        ind.draw();
        if (ind.opacity <= 0) {
            indicators.splice(i, 1);
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
    if (gameMode === 'easy') {
        currentTarget = Math.floor(Math.random() * 7) + 10; // 10-16
    } else if (gameMode === 'hard') {
        currentTarget = Math.floor(Math.random() * 71) + 30; // 30-100
    } else {
        if (score > 100) {
            currentTarget = Math.floor(Math.random() * 31) + 30; // 30-60
        } else {
            currentTarget = Math.floor(Math.random() * 21) + 10; // 10-30
        }
    }
    targetElement.innerText = currentTarget;

    // Pulse animation for target change
    targetElement.parentElement.classList.add('target-pulse');
    setTimeout(() => {
        targetElement.parentElement.classList.remove('target-pulse');
    }, 500);
}

function startGame() {
    initAudio(); // Unlock audio on game start
    score = 0;
    timeLeft = 60;
    gameSpeed = gameMode === 'hard' ? 1.5 : 1;
    spawnRate = 1500;
    bubbles = [];
    selectedBubbles = [];
    indicators = [];
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

startBtn.addEventListener('click', () => {
    gameMode = 'normal';
    startGame();
});

easyBtn.addEventListener('click', () => {
    gameMode = 'easy';
    startGame();
});

hardBtn.addEventListener('click', () => {
    gameMode = 'hard';
    startGame();
});

restartBtn.addEventListener('click', startGame);

exitBtn.addEventListener('click', () => {
    gameActive = false;
    startScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    bubbles = [];
    selectedBubbles = [];
    indicators = [];
    score = 0;
    scoreElement.innerText = score;
    // Physical dimensions for clearing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});
