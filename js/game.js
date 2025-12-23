const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

let score = 0;
let currentTarget = 10;
let gameActive = false;
let bubbles = [];
let selectedBubbles = [];
let spawnRate = 1500; // ms
let lastSpawn = 0;
let gameSpeed = 1;

const targetElement = document.getElementById('target');

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
        this.radius = Math.random() * 20 + 35; // Size 35-55
        this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
        this.y = canvas.height + this.radius;
        // Ensure values are within a range that makes sense for the current target
        this.value = Math.floor(Math.random() * (currentTarget - 1)) + 1;
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
        const dist = Math.sqrt((mx - this.x) ** 2 + (my - this.y) ** 2);
        return dist < this.radius;
    }
}

function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
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
}

function handleClick(e) {
    if (!gameActive) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

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

                    // Randomly change target every 50 points to keep it fresh
                    if (score % 50 === 0) {
                        updateTarget();
                    }
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
canvas.addEventListener('touchstart', handleClick);

function update(time) {
    if (!gameActive) return;

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

        // Game Over condition: if bubble hits top (y < -radius)
        if (b.y < -b.radius && !b.popping) {
            endGame();
        }

        // Remove popped or off-screen
        if (b.opacity <= 0) {
            bubbles.splice(i, 1);
        }
    }

    requestAnimationFrame(update);
}

function updateTarget() {
    currentTarget = Math.floor(Math.random() * 41) + 10; // 10-50
    targetElement.innerText = currentTarget;

    // Pulse animation for target change
    targetElement.parentElement.classList.add('target-pulse');
    setTimeout(() => {
        targetElement.parentElement.classList.remove('target-pulse');
    }, 500);
}

function startGame() {
    score = 0;
    gameSpeed = 1;
    spawnRate = 1500;
    bubbles = [];
    selectedBubbles = [];
    scoreElement.innerText = score;
    updateTarget();
    gameActive = true;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    lastSpawn = performance.now();
    requestAnimationFrame(update);
}

function endGame() {
    gameActive = false;
    finalScoreElement.innerText = score;
    gameOverScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
