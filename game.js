/* ==============================
   トイ・ストーリー・マニア! — パチンコ版 Game Engine
   スリングショットで弾を飛ばしてターゲットを狙え！
   ============================== */

(function () {
    'use strict';

    // ===== CONFIG =====
    const CONFIG = {
        TOTAL_TIME: 60,
        ROUNDS: [
            {
                name: 'ROUND 1',
                theme: 'エイリアンを撃て！',
                charImg: 'assets/alien.png',
                duration: 20,
                targets: ['alien'],
                spawnInterval: [1800, 2800],
                targetSizeFactor: [0.10, 0.14], // fraction of min(vw,vh)
                speed: 0.3,
                maxTargets: 4,
                lifetime: [3500, 5500],
            },
            {
                name: 'ROUND 2',
                theme: 'バズを撃て！',
                charImg: 'assets/buzz.png',
                duration: 20,
                targets: ['buzz'],
                spawnInterval: [1400, 2200],
                targetSizeFactor: [0.08, 0.12],
                speed: 0.5,
                maxTargets: 5,
                lifetime: [3000, 4500],
            },
            {
                name: 'ROUND 3',
                theme: '全員まとめて撃て！',
                charImg: 'assets/alien.png',
                duration: 20,
                targets: ['alien', 'buzz'],
                spawnInterval: [1000, 1800],
                targetSizeFactor: [0.07, 0.10],
                speed: 0.7,
                maxTargets: 6,
                lifetime: [2500, 4000],
            },
        ],
        SCORE_BASE: 100,
        TARGET_IMAGES: {
            alien: 'assets/alien.png',
            buzz: 'assets/buzz.png',
        },
        PROJECTILE_SPEED_FACTOR: 0.035,  // multiplied by viewport height
        PROJECTILE_RADIUS: 9,
        GRAVITY_FACTOR: 0.00003,         // multiplied by viewport height
        SLINGSHOT: {
            MAX_PULL: 120,      // max pull distance in px
            MIN_PULL: 15,       // minimum pull to fire
            GRAB_RADIUS: 80,    // how far from center you can grab
        },
        DIALOGUES: {
            roundStart: [
                { who: 'woody', text: 'いくぞ！' },
                { who: 'jessie', text: 'がんばって！' },
            ],
            hit: [
                { who: 'woody', text: 'ナイス！' },
                { who: 'jessie', text: 'やったね！' },
                { who: 'woody', text: 'いいぞ！' },
                { who: 'jessie', text: 'すごい！' },
            ],
            combo: [
                { who: 'woody', text: 'すごいぞ！' },
                { who: 'jessie', text: '最高！！' },
                { who: 'woody', text: '止まらない！' },
                { who: 'jessie', text: 'コンボ！' },
            ],
            miss: [
                { who: 'woody', text: '落ち着いて！' },
                { who: 'jessie', text: 'ドンマイ！' },
                { who: 'woody', text: '大丈夫！' },
            ],
            roundEnd: [
                { who: 'woody', text: '次だ！' },
                { who: 'jessie', text: 'もっといける！' },
            ],
        },
    };

    // ===== AUDIO ENGINE =====
    class AudioEngine {
        constructor() { this.ctx = null; this.enabled = false; }
        init() {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.enabled = true;
            } catch (e) { this.enabled = false; }
        }
        resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
        play(type) {
            if (!this.enabled || !this.ctx) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain); gain.connect(this.ctx.destination);
            switch (type) {
                case 'shoot':
                    osc.type = 'sine'; osc.frequency.setValueAtTime(600, t);
                    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
                    gain.gain.setValueAtTime(0.15, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                    osc.start(t); osc.stop(t + 0.15);
                    break;
                case 'hit':
                    osc.type = 'sine'; osc.frequency.setValueAtTime(880, t);
                    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.1);
                    gain.gain.setValueAtTime(0.2, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    osc.start(t); osc.stop(t + 0.25);
                    break;
                case 'miss':
                    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, t);
                    osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
                    gain.gain.setValueAtTime(0.08, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                    osc.start(t); osc.stop(t + 0.2);
                    break;
                case 'combo':
                    osc.type = 'sine'; osc.frequency.setValueAtTime(660, t);
                    osc.frequency.setValueAtTime(880, t + 0.08);
                    osc.frequency.setValueAtTime(1100, t + 0.16);
                    gain.gain.setValueAtTime(0.15, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    osc.start(t); osc.stop(t + 0.3);
                    break;
                case 'pull':
                    osc.type = 'sine'; osc.frequency.setValueAtTime(300, t);
                    gain.gain.setValueAtTime(0.05, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                    osc.start(t); osc.stop(t + 0.05);
                    break;
                case 'roundStart':
                    osc.type = 'sine';
                    [440, 554, 659, 880].forEach((f, i) => {
                        osc.frequency.setValueAtTime(f, t + i * 0.12);
                    });
                    gain.gain.setValueAtTime(0.15, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
                    osc.start(t); osc.stop(t + 0.6);
                    break;
                case 'gameOver':
                    osc.type = 'sine';
                    [880, 784, 659, 523, 659, 784, 880, 1047].forEach((f, i) => {
                        osc.frequency.setValueAtTime(f, t + i * 0.15);
                    });
                    gain.gain.setValueAtTime(0.15, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
                    osc.start(t); osc.stop(t + 1.3);
                    break;
            }
        }
    }

    // ===== STATE =====
    const state = {
        running: false,
        score: 0,
        hits: 0,
        shots: 0,
        combo: 0,
        maxCombo: 0,
        consecutiveMisses: 0,
        timeLeft: CONFIG.TOTAL_TIME,
        currentRound: 0,
        roundTimeLeft: 0,
        targets: [],
        projectiles: [],
        targetIdCounter: 0,
        gameTimer: null,
        spawnTimer: null,
        rafId: null,
        // Slingshot state
        dragging: false,
        dragStart: { x: 0, y: 0 },
        dragCurrent: { x: 0, y: 0 },
        slingshotCenter: { x: 0, y: 0 },
        ballPos: { x: 0, y: 0 },
        // Speech timers
        speechTimers: { woody: null, jessie: null },
        // Modals
        isLeaderboardOpen: false,
    };

    const dom = {};
    const audio = new AudioEngine();

    // ===== HELPERS =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function showScreen(id) {
        $$('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }

    // ===== INIT =====
    function init() {
        dom.titleScreen = $('#title-screen');
        dom.roundScreen = $('#round-screen');
        dom.gameScreen = $('#game-screen');
        dom.resultScreen = $('#result-screen');
        dom.startBtn = $('#start-btn');
        dom.rankBtn = $('#rank-btn');
        dom.replayBtn = $('#replay-btn');
        dom.targetZone = $('#target-zone');
        dom.projectileLayer = $('#projectile-layer');
        dom.effectsLayer = $('#effects-layer');
        dom.slingshotArea = $('#slingshot-area');
        dom.slingshotCanvas = $('#slingshot-canvas');
        dom.gameWoody = $('#game-woody');
        dom.gameJessie = $('#game-jessie');
        dom.woodySpeech = $('#woody-speech');
        dom.jessieSpeech = $('#jessie-speech');
        dom.hudScore = $('#hud-score');
        dom.hudTimer = $('#hud-timer');
        dom.hudRound = $('#hud-round');
        dom.hudHits = $('#hud-hits');
        dom.hudCombo = $('#hud-combo');
        dom.hudComboContainer = $('#hud-combo-container');
        dom.timerCircle = $('#timer-circle');
        dom.roundNumber = $('#round-number');
        dom.roundTheme = $('#round-theme');
        dom.roundCharacter = $('#round-character');
        dom.resultScore = $('#result-score');
        dom.resultHits = $('#result-hits');
        dom.resultMaxCombo = $('#result-max-combo');
        dom.resultAccuracy = $('#result-accuracy');
        dom.resultRank = $('#result-rank');
        dom.resultMessage = $('#result-message');
        
        // Modals
        dom.leaderboardModal = $('#leaderboard-modal');
        dom.leaderboardList = $('#leaderboard-list');
        dom.closeModal = $('.close-modal');
        dom.nameInputModal = $('#name-input-modal');
        dom.playerNameInput = $('#player-name');
        dom.submitScoreBtn = $('#submit-score-btn');

        generateStars();

        if (dom.startBtn) {
            dom.startBtn.addEventListener('click', startGame);
            dom.startBtn.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); });
        }
        if (dom.rankBtn) {
            dom.rankBtn.addEventListener('click', openLeaderboard);
            dom.rankBtn.addEventListener('touchend', (e) => { e.preventDefault(); openLeaderboard(); });
        }
        if (dom.replayBtn) {
            dom.replayBtn.addEventListener('click', restartGame);
            dom.replayBtn.addEventListener('touchend', (e) => { e.preventDefault(); restartGame(); });
        }
        if (dom.closeModal) {
            dom.closeModal.addEventListener('click', closeLeaderboard);
            dom.closeModal.addEventListener('touchend', (e) => { e.preventDefault(); closeLeaderboard(); });
        }
        if (dom.submitScoreBtn) {
            dom.submitScoreBtn.addEventListener('click', submitScore);
            dom.submitScoreBtn.addEventListener('touchend', (e) => { e.preventDefault(); submitScore(); });
        }

        // Leaderboard init
        if (window.Leaderboard) window.Leaderboard.init();

        // Slingshot touch/mouse events
        dom.slingshotCanvas.addEventListener('touchstart', onDragStart, { passive: false });
        dom.slingshotCanvas.addEventListener('touchmove', onDragMove, { passive: false });
        dom.slingshotCanvas.addEventListener('touchend', onDragEnd, { passive: false });
        dom.slingshotCanvas.addEventListener('mousedown', onDragStart);
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);

        // Setup canvas
        setupCanvas();
        window.addEventListener('resize', setupCanvas);
    }

    function generateStars() {
        const container = $('#title-stars');
        if (!container) return;
        for (let i = 0; i < 60; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 70 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            star.style.width = star.style.height = (2 + Math.random() * 4) + 'px';
            container.appendChild(star);
        }
    }

    // ===== CANVAS SETUP =====
    let canvasCtx = null;
    let canvasW = 0, canvasH = 0;
    const DPR = window.devicePixelRatio || 1;

    function setupCanvas() {
        const canvas = dom.slingshotCanvas;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvasW = rect.width;
        canvasH = rect.height;
        canvas.width = canvasW * DPR;
        canvas.height = canvasH * DPR;
        canvasCtx = canvas.getContext('2d');
        canvasCtx.scale(DPR, DPR);

        // Slingshot center at bottom-center of canvas
        state.slingshotCenter.x = canvasW / 2;
        state.slingshotCenter.y = canvasH * 0.65;
        state.ballPos.x = state.slingshotCenter.x;
        state.ballPos.y = state.slingshotCenter.y;

        drawSlingshot();
    }

    // ===== DRAW SLINGSHOT =====
    function drawSlingshot() {
        if (!canvasCtx) return;
        const ctx = canvasCtx;
        ctx.clearRect(0, 0, canvasW, canvasH);

        const cx = state.slingshotCenter.x;
        const cy = state.slingshotCenter.y;
        const bx = state.ballPos.x;
        const by = state.ballPos.y;

        // Y-frame fork prongs
        const forkW = 28;
        const forkH = 35;
        const baseY = cy + 50;

        // Handle (base)
        ctx.save();
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, baseY + 20);
        ctx.lineTo(cx, cy + 5);
        ctx.stroke();

        // Left prong
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 5);
        ctx.quadraticCurveTo(cx - forkW * 0.3, cy - forkH * 0.3, cx - forkW, cy - forkH);
        ctx.stroke();

        // Right prong
        ctx.beginPath();
        ctx.moveTo(cx, cy + 5);
        ctx.quadraticCurveTo(cx + forkW * 0.3, cy - forkH * 0.3, cx + forkW, cy - forkH);
        ctx.stroke();

        // Prong tips (knobs)
        ctx.fillStyle = '#A0522D';
        ctx.beginPath();
        ctx.arc(cx - forkW, cy - forkH, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + forkW, cy - forkH, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Elastic bands
        ctx.save();
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';

        // Left band
        ctx.beginPath();
        ctx.moveTo(cx - forkW, cy - forkH);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Right band
        ctx.beginPath();
        ctx.moveTo(cx + forkW, cy - forkH);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();

        // Ball (projectile)
        const ballRadius = 12;
        ctx.save();
        const grad = ctx.createRadialGradient(bx - 3, by - 3, 2, bx, by, ballRadius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#ffd166');
        grad.addColorStop(1, '#f77f00');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(255,209,102,0.6)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(bx, by, ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw trajectory preview when dragging
        if (state.dragging) {
            const dx = state.slingshotCenter.x - bx;
            const dy = state.slingshotCenter.y - by;
            const pullDist = Math.sqrt(dx * dx + dy * dy);
            if (pullDist > CONFIG.SLINGSHOT.MIN_PULL) {
                const power = Math.min(pullDist / CONFIG.SLINGSHOT.MAX_PULL, 1);
                const angle = Math.atan2(dy, dx);
                const vpH = window.innerHeight;
                const speed = vpH * CONFIG.PROJECTILE_SPEED_FACTOR * power;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                const gravity = vpH * CONFIG.GRAVITY_FACTOR;

                ctx.save();
                ctx.fillStyle = 'rgba(255,209,102,0.4)';
                for (let i = 1; i <= 8; i++) {
                    const t = i * 5;
                    const px = bx + vx * t;
                    const py = by + vy * t + 0.5 * gravity * t * t;
                    if (py < 0) break;
                    const dotSize = 3 - i * 0.2;
                    ctx.globalAlpha = 1 - i * 0.1;
                    ctx.beginPath();
                    ctx.arc(px, py, Math.max(dotSize, 1), 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();

                // Power indicator
                ctx.save();
                ctx.fillStyle = power > 0.7 ? '#e63946' : power > 0.4 ? '#ffd166' : '#06d6a0';
                ctx.font = 'bold 14px "Fredoka One"';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(power * 100) + '%', bx, by + ballRadius + 18);
                ctx.restore();
            }
        }
    }

    // ===== SLINGSHOT INPUT =====
    function getEventPos(e) {
        const canvas = dom.slingshotCanvas;
        const rect = canvas.getBoundingClientRect();
        if (e.touches) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top,
            };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onDragStart(e) {
        if (!state.running) return;
        e.preventDefault();
        const pos = getEventPos(e);
        const dx = pos.x - state.slingshotCenter.x;
        const dy = pos.y - state.slingshotCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.SLINGSHOT.GRAB_RADIUS) {
            state.dragging = true;
            state.dragStart = { ...pos };
            audio.resume();
        }
    }

    function onDragMove(e) {
        if (!state.dragging) return;
        e.preventDefault();
        const pos = getEventPos(e);
        const cx = state.slingshotCenter.x;
        const cy = state.slingshotCenter.y;
        let dx = pos.x - cx;
        let dy = pos.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxPull = CONFIG.SLINGSHOT.MAX_PULL;

        if (dist > maxPull) {
            dx = (dx / dist) * maxPull;
            dy = (dy / dist) * maxPull;
        }

        state.ballPos.x = cx + dx;
        state.ballPos.y = cy + dy;
        state.dragCurrent = { ...pos };

        drawSlingshot();
    }

    function onDragEnd(e) {
        if (!state.dragging) return;
        e.preventDefault();
        state.dragging = false;

        const cx = state.slingshotCenter.x;
        const cy = state.slingshotCenter.y;
        const bx = state.ballPos.x;
        const by = state.ballPos.y;
        const dx = cx - bx;
        const dy = cy - by;
        const pullDist = Math.sqrt(dx * dx + dy * dy);

        if (pullDist >= CONFIG.SLINGSHOT.MIN_PULL) {
            // Fire!
            const power = Math.min(pullDist / CONFIG.SLINGSHOT.MAX_PULL, 1);
            const angle = Math.atan2(dy, dx);
            // Scale speed to viewport height so ball always reaches target zone
            const vpH = window.innerHeight;
            const speed = vpH * CONFIG.PROJECTILE_SPEED_FACTOR * power;
            fireProjectile(angle, speed);
            state.shots++;
            audio.play('shoot');
        }

        // Snap ball back
        animateSnapBack();
    }

    function animateSnapBack() {
        const cx = state.slingshotCenter.x;
        const cy = state.slingshotCenter.y;
        const startX = state.ballPos.x;
        const startY = state.ballPos.y;
        let t = 0;
        const duration = 150;
        const startTime = performance.now();

        function snap(now) {
            t = Math.min((now - startTime) / duration, 1);
            // Elastic ease-out
            const ease = 1 - Math.pow(1 - t, 3);
            state.ballPos.x = startX + (cx - startX) * ease;
            state.ballPos.y = startY + (cy - startY) * ease;
            drawSlingshot();
            if (t < 1) requestAnimationFrame(snap);
        }
        requestAnimationFrame(snap);
    }

    // ===== PROJECTILE =====
    function fireProjectile(angle, speed) {
        const slingshotRect = dom.slingshotArea.getBoundingClientRect();
        const screenX = slingshotRect.left + state.slingshotCenter.x;
        const screenY = slingshotRect.top + state.slingshotCenter.y;

        const proj = {
            x: screenX,
            y: screenY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: CONFIG.PROJECTILE_RADIUS,
            alive: true,
            trail: [],
        };
        state.projectiles.push(proj);

        // Create DOM element for projectile
        const el = document.createElement('div');
        el.className = 'projectile';
        el.style.left = proj.x + 'px';
        el.style.top = proj.y + 'px';
        el.style.transform = 'translate(-50%, -50%)';
        dom.projectileLayer.appendChild(el);
        proj.el = el;
    }

    // ===== GAME LOOP =====
    function startGameLoop() {
        cancelAnimationFrame(state.rafId);
        let lastTime = performance.now();

        function loop(now) {
            if (!state.running) return;
            const dt = (now - lastTime) / 16.667; // normalized to 60fps
            lastTime = now;

            const targetZoneRect = dom.targetZone.getBoundingClientRect();

            // Update targets (side-to-side sway)
            for (let i = state.targets.length - 1; i >= 0; i--) {
                const t = state.targets[i];
                if (t.dead) continue;

                const age = now - t.bornAt;
                if (age > t.lifetime) {
                    t.el.style.opacity = '0';
                    t.el.style.transform = 'scale(0.5)';
                    t.dead = true;
                    setTimeout(() => { if (t.el.parentNode) t.el.remove(); }, 300);
                    state.targets.splice(i, 1);
                    continue;
                }

                // Fade in
                if (age < 400) {
                    const fadeProgress = age / 400;
                    t.el.style.opacity = fadeProgress;
                    t.el.style.transform = `scale(${0.4 + 0.6 * fadeProgress})`;
                } else {
                    t.el.style.opacity = '1';
                    t.el.style.transform = 'scale(1)';
                }

                // Move (gentle sway within target zone)
                t.x += t.vx * dt;
                t.y += t.vy * dt;

                // Bounce within target zone bounds (relative to target-zone)
                const zoneW = dom.targetZone.clientWidth;
                const zoneH = dom.targetZone.clientHeight;
                if (t.x < 5) { t.x = 5; t.vx = Math.abs(t.vx); }
                if (t.x > zoneW - t.size - 5) { t.x = zoneW - t.size - 5; t.vx = -Math.abs(t.vx); }
                if (t.y < 5) { t.y = 5; t.vy = Math.abs(t.vy); }
                if (t.y > zoneH - t.size - 5) { t.y = zoneH - t.size - 5; t.vy = -Math.abs(t.vy); }

                const wobble = Math.sin(now * 0.002 + t.id) * 2;
                t.el.style.left = t.x + 'px';
                t.el.style.top = (t.y + wobble) + 'px';
            }

            // Update projectiles
            for (let i = state.projectiles.length - 1; i >= 0; i--) {
                const p = state.projectiles[i];
                if (!p.alive) continue;

                p.x += p.vx * dt;
                p.y += p.vy * dt;
                const gravity = window.innerHeight * CONFIG.GRAVITY_FACTOR;
                p.vy += gravity * dt; // subtle gravity scaled to viewport
                
                // Trail
                if (Math.random() < 0.5) {
                    const trail = document.createElement('div');
                    trail.className = 'trail-dot';
                    trail.style.left = p.x + 'px';
                    trail.style.top = p.y + 'px';
                    trail.style.transform = 'translate(-50%, -50%)';
                    dom.projectileLayer.appendChild(trail);
                    setTimeout(() => trail.remove(), 200);
                }

                p.el.style.left = p.x + 'px';
                p.el.style.top = p.y + 'px';

                // Check collision with targets
                let hitAny = false;
                for (let j = state.targets.length - 1; j >= 0; j--) {
                    const t = state.targets[j];
                    if (t.dead) continue;

                    // Get target position in screen coords
                    const tRect = t.el.getBoundingClientRect();
                    const tCenterX = tRect.left + tRect.width / 2;
                    const tCenterY = tRect.top + tRect.height / 2;
                    const hitRadius = tRect.width / 2 + p.radius + 5; // generous

                    const dx = p.x - tCenterX;
                    const dy = p.y - tCenterY;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < hitRadius * hitRadius) {
                        // HIT!
                        handleHit(t, tCenterX, tCenterY);
                        hitAny = true;
                        break;
                    }
                }

                if (hitAny) {
                    p.alive = false;
                    p.el.remove();
                    state.projectiles.splice(i, 1);
                    continue;
                }

                // Out of screen
                if (p.y < -50 || p.x < -50 || p.x > window.innerWidth + 50 || p.y > window.innerHeight + 50) {
                    p.alive = false;
                    p.el.remove();
                    state.projectiles.splice(i, 1);
                    handleMiss(p.x, 10);
                }
            }

            // Redraw slingshot
            drawSlingshot();

            state.rafId = requestAnimationFrame(loop);
        }
        state.rafId = requestAnimationFrame(loop);
    }

    // ===== TARGET SPAWNING =====
    function startSpawning() {
        clearTimeout(state.spawnTimer);
        scheduleNextSpawn();
    }

    function scheduleNextSpawn() {
        if (!state.running) return;
        const round = CONFIG.ROUNDS[state.currentRound];
        const [minInt, maxInt] = round.spawnInterval;
        const delay = minInt + Math.random() * (maxInt - minInt);
        state.spawnTimer = setTimeout(() => {
            spawnTarget();
            scheduleNextSpawn();
        }, delay);
    }

    function spawnTarget() {
        if (!state.running) return;
        const round = CONFIG.ROUNDS[state.currentRound];
        if (state.targets.length >= round.maxTargets) return;

        const charTypes = round.targets;
        const charType = charTypes[Math.floor(Math.random() * charTypes.length)];
        const imgSrc = CONFIG.TARGET_IMAGES[charType];

        const [minFac, maxFac] = round.targetSizeFactor;
        const fac = minFac + Math.random() * (maxFac - minFac);
        // Use min(vw, vh) for scaling
        const vMin = Math.min(window.innerWidth, window.innerHeight);
        const size = vMin * fac;
        
        // Ensure somewhat usable size
        const finalSize = Math.max(size, 40); // min 40px

        const zoneW = dom.targetZone.clientWidth;
        const zoneH = dom.targetZone.clientHeight;

        const x = 10 + Math.random() * (zoneW - finalSize - 20);
        const y = 10 + Math.random() * (zoneH - finalSize - 20);

        // Random velocity for sway
        const speed = round.speed;
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * speed * (0.3 + Math.random() * 0.7);
        const vy = Math.sin(angle) * speed * (0.3 + Math.random() * 0.7);

        const [minLife, maxLife] = round.lifetime;
        const lifetime = minLife + Math.random() * (maxLife - minLife);

        const id = state.targetIdCounter++;
        const el = document.createElement('div');
        el.className = 'target';
        el.dataset.id = id;
        el.dataset.type = charType;
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.opacity = '0';

        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = charType;
        el.appendChild(img);

        dom.targetZone.appendChild(el);
        const targetObj = { id, el, x, y, vx, vy, size, bornAt: performance.now(), lifetime, type: charType, dead: false };
        state.targets.push(targetObj);
    }

    function removeAllTargets() {
        state.targets.forEach(t => { if (t.el.parentNode) t.el.remove(); });
        state.targets = [];
    }

    function removeAllProjectiles() {
        state.projectiles.forEach(p => { if (p.el && p.el.parentNode) p.el.remove(); });
        state.projectiles = [];
    }

    // ===== HIT / MISS =====
    function handleHit(targetObj, x, y) {
        if (targetObj.dead) return;

        state.combo++;
        state.consecutiveMisses = 0;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
        const comboMultiplier = Math.min(state.combo, 10);

        const points = CONFIG.SCORE_BASE * comboMultiplier;
        state.score += points;
        state.hits++;

        targetObj.dead = true;
        targetObj.el.classList.add('hit');
        setTimeout(() => { if (targetObj.el.parentNode) targetObj.el.remove(); }, 500);
        const idx = state.targets.indexOf(targetObj);
        if (idx !== -1) state.targets.splice(idx, 1);

        // Effects
        showScorePopup(x, y, points, comboMultiplier);
        createStarBurst(x, y);

        // Audio
        if (state.combo >= 3) {
            audio.play('combo');
            showDialogue('combo');
        } else {
            audio.play('hit');
            showDialogue('hit');
        }

        // Update HUD
        updateHUD();

        // Combo display
        if (state.combo >= 2) {
            dom.hudComboContainer.style.display = 'flex';
            dom.hudCombo.textContent = `×${state.combo}`;
            dom.hudComboContainer.style.animation = 'none';
            dom.hudComboContainer.offsetHeight;
            dom.hudComboContainer.style.animation = 'comboFlash 0.3s ease-out';
        }
    }

    function handleMiss(x, y) {
        state.combo = 0;
        state.consecutiveMisses++;
        dom.hudComboContainer.style.display = 'none';
        audio.play('miss');

        if (state.consecutiveMisses >= 3) {
            showDialogue('miss');
            state.consecutiveMisses = 0;
        }

        // Miss visual at top of screen
        const marker = document.createElement('div');
        marker.className = 'miss-marker';
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
        dom.effectsLayer.appendChild(marker);
        setTimeout(() => marker.remove(), 500);
    }

    // ===== EFFECTS =====
    function showScorePopup(x, y, points, combo) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = `+${points}`;
        if (combo >= 3) popup.style.fontSize = '34px';
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        popup.style.transform = 'translate(-50%, -50%)';
        dom.effectsLayer.appendChild(popup);
        setTimeout(() => popup.remove(), 1000);
    }

    function createStarBurst(x, y) {
        const emojis = ['⭐', '✨', '💫', '🌟'];
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('div');
            star.className = 'star-particle';
            star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            star.style.left = x + 'px';
            star.style.top = y + 'px';
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 50;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;
            star.style.transition = 'all 0.6s ease-out';
            star.style.transform = 'translate(-50%, -50%)';
            dom.effectsLayer.appendChild(star);
            requestAnimationFrame(() => {
                star.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`;
                star.style.opacity = '0';
            });
            setTimeout(() => star.remove(), 700);
        }
    }

    // ===== CHARACTER DIALOGUE =====
    function showDialogue(type) {
        const lines = CONFIG.DIALOGUES[type];
        if (!lines || !lines.length) return;
        const line = lines[Math.floor(Math.random() * lines.length)];

        const speechEl = line.who === 'woody' ? dom.woodySpeech : dom.jessieSpeech;
        speechEl.textContent = line.text;
        speechEl.classList.add('show');

        // Clear previous timer
        clearTimeout(state.speechTimers[line.who]);
        state.speechTimers[line.who] = setTimeout(() => {
            speechEl.classList.remove('show');
        }, 1800);
    }

    // ===== HUD =====
    function updateHUD() {
        dom.hudScore.textContent = state.score;
        dom.hudHits.textContent = state.hits;
        dom.hudRound.textContent = state.currentRound + 1;

        const totalTime = CONFIG.TOTAL_TIME;
        dom.hudTimer.textContent = Math.ceil(state.timeLeft);

        const progress = state.timeLeft / totalTime;
        const circumference = 2 * Math.PI * 45;
        dom.timerCircle.style.strokeDashoffset = circumference * (1 - progress);

        if (progress < 0.2) {
            dom.timerCircle.classList.add('danger');
            dom.timerCircle.classList.remove('warning');
        } else if (progress < 0.4) {
            dom.timerCircle.classList.add('warning');
            dom.timerCircle.classList.remove('danger');
        } else {
            dom.timerCircle.classList.remove('warning', 'danger');
        }
    }

    // ===== GAME FLOW =====
    function startGame() {
        audio.init();
        audio.resume();

        state.score = 0;
        state.hits = 0;
        state.shots = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.consecutiveMisses = 0;
        state.timeLeft = CONFIG.TOTAL_TIME;
        state.currentRound = 0;
        state.targetIdCounter = 0;
        state.targets = [];
        state.projectiles = [];
        dom.hudComboContainer.style.display = 'none';

        showRoundIntro();
    }

    function restartGame() {
        clearTimers();
        removeAllTargets();
        removeAllProjectiles();

        // Clear effects
        dom.effectsLayer.innerHTML = '';
        dom.projectileLayer.innerHTML = '';

        startGame();
    }

    function showRoundIntro() {
        const round = CONFIG.ROUNDS[state.currentRound];
        dom.roundNumber.textContent = round.name;
        dom.roundTheme.textContent = round.theme;
        dom.roundCharacter.querySelector('img').src = round.charImg;

        state.roundTimeLeft = round.duration;
        updateHUD();

        showScreen('round-screen');
        audio.play('roundStart');

        setTimeout(() => {
            showScreen('game-screen');
            setupCanvas();
            startRound();
        }, 2000);
    }

    function startRound() {
        state.running = true;
        showDialogue('roundStart');
        startGameLoop();
        startSpawning();

        // Game timer — 1 sec intervals
        clearInterval(state.gameTimer);
        state.gameTimer = setInterval(() => {
            if (!state.running) return;
            state.timeLeft -= 1;
            state.roundTimeLeft -= 1;
            updateHUD();

            if (state.timeLeft <= 0) {
                endGame();
            } else if (state.roundTimeLeft <= 0) {
                nextRound();
            }
        }, 1000);
    }

    function nextRound() {
        state.running = false;
        clearTimers();
        removeAllTargets();
        removeAllProjectiles();
        dom.projectileLayer.innerHTML = '';
        state.combo = 0;
        dom.hudComboContainer.style.display = 'none';

        showDialogue('roundEnd');

        state.currentRound++;
        if (state.currentRound >= CONFIG.ROUNDS.length) {
            endGame();
            return;
        }

        setTimeout(() => showRoundIntro(), 500);
    }

    function endGame() {
        state.running = false;
        clearTimers();
        removeAllTargets();
        removeAllProjectiles();
        dom.projectileLayer.innerHTML = '';

        audio.play('gameOver');

        const accuracy = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0;
        dom.resultScore.textContent = state.score;
        dom.resultHits.textContent = state.hits;
        dom.resultMaxCombo.textContent = state.maxCombo;
        dom.resultAccuracy.textContent = accuracy + '%';

        // Rank
        let rank, message;
        if (state.score >= 5000) { rank = '⭐⭐⭐'; message = '伝説のシューター！'; }
        else if (state.score >= 3000) { rank = '⭐⭐'; message = 'すばらしい！'; }
        else if (state.score >= 1500) { rank = '⭐'; message = 'よくできました！'; }
        else { rank = '🎯'; message = 'もっと練習しよう！'; }

        dom.resultRank.textContent = rank;
        dom.resultMessage.textContent = message;

        showScreen('result-screen');

        // Check for high score input
        if (state.score > 0) {
            setTimeout(() => {
                showNameInput();
            }, 1000);
        }
    }

    // ===== LEADERBOARD LOGIC =====
    async function openLeaderboard() {
        dom.leaderboardModal.classList.add('active');
        state.isLeaderboardOpen = true;
        
        if (dom.leaderboardList) {
            dom.leaderboardList.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
            
            if (window.Leaderboard) {
                const scores = await window.Leaderboard.getTopScores(20);
                renderLeaderboard(scores);
            } else {
                dom.leaderboardList.innerHTML = '<div style="padding:20px; text-align:center;">Leaderboard unavailable</div>';
            }
        }
    }

    function closeLeaderboard() {
        dom.leaderboardModal.classList.remove('active');
        state.isLeaderboardOpen = false;
    }

    function renderLeaderboard(scores) {
        if (!dom.leaderboardList) return;
        dom.leaderboardList.innerHTML = '';
        
        if (scores.length === 0) {
            dom.leaderboardList.innerHTML = '<div style="padding:20px; text-align:center;">No scores yet!</div>';
            return;
        }

        scores.forEach((s, i) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <span>${i + 1}. ${s.name}</span>
                <span>${s.score}</span>
            `;
            dom.leaderboardList.appendChild(item);
        });
    }

    function showNameInput() {
        dom.nameInputModal.classList.add('active');
        dom.playerNameInput.focus();
    }

    function submitScore() {
        const name = dom.playerNameInput.value.trim() || 'NoName';
        if (window.Leaderboard) {
            window.Leaderboard.saveScore(name, state.score);
        }
        dom.nameInputModal.classList.remove('active');
        dom.playerNameInput.value = '';
        
        // Show updated leaderboard
        openLeaderboard();
    }

    function clearTimers() {
        clearInterval(state.gameTimer);
        clearTimeout(state.spawnTimer);
        cancelAnimationFrame(state.rafId);
        state.gameTimer = null;
        state.spawnTimer = null;
    }

    // ===== BOOT =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
