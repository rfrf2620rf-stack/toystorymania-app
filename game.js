/* ==============================
   トイ・ストーリー・マニア! Game Engine
   Targets move via JS requestAnimationFrame
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
                spawnInterval: [1200, 2000],
                targetSize: [100, 140],
                speed: 0.6,
                maxTargets: 4,
                lifetime: [2500, 4000],
            },
            {
                name: 'ROUND 2',
                theme: 'バズを撃て！',
                charImg: 'assets/buzz.png',
                duration: 20,
                targets: ['buzz'],
                spawnInterval: [900, 1600],
                targetSize: [80, 120],
                speed: 1.0,
                maxTargets: 5,
                lifetime: [2000, 3500],
            },
            {
                name: 'ROUND 3',
                theme: '全員まとめて撃て！',
                charImg: 'assets/alien.png',
                duration: 20,
                targets: ['alien', 'buzz'],
                spawnInterval: [600, 1200],
                targetSize: [70, 110],
                speed: 1.4,
                maxTargets: 6,
                lifetime: [1800, 3000],
            },
        ],
        SCORE_BASE: 100,
        TARGET_IMAGES: {
            alien: 'assets/alien.png',
            buzz: 'assets/buzz.png',
        },
    };

    // ===== AUDIO ENGINE (Web Audio API) =====
    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.initialized = false;
        }
        init() {
            if (this.initialized) return;
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.initialized = true;
            } catch (e) {
                console.warn('Audio not available');
            }
        }
        play(type) {
            if (!this.ctx) return;
            switch (type) {
                case 'hit': this._playHit(); break;
                case 'miss': this._playMiss(); break;
                case 'combo': this._playCombo(); break;
                case 'round': this._playRound(); break;
                case 'start': this._playStart(); break;
                case 'end': this._playEnd(); break;
                case 'tick': this._playTick(); break;
            }
        }
        _playHit() {
            const o = this._osc(800, 'sine', 0.15);
            o.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
            this._schedule(o, 0.15);
        }
        _playMiss() {
            const o = this._osc(300, 'triangle', 0.08);
            o.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.2);
            this._schedule(o, 0.2);
        }
        _playCombo() {
            [600, 800, 1000, 1200].forEach((f, i) => {
                const o = this._osc(f, 'sine', 0.1);
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.06);
                g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.06 + 0.15);
                o.disconnect();
                o.connect(g).connect(this.ctx.destination);
                o.start(this.ctx.currentTime + i * 0.06);
                o.stop(this.ctx.currentTime + i * 0.06 + 0.15);
            });
        }
        _playRound() {
            [523, 659, 784, 1047].forEach((f, i) => {
                const o = this._osc(f, 'square', 0.08);
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.08, this.ctx.currentTime + i * 0.12);
                g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.12 + 0.3);
                o.disconnect();
                o.connect(g).connect(this.ctx.destination);
                o.start(this.ctx.currentTime + i * 0.12);
                o.stop(this.ctx.currentTime + i * 0.12 + 0.3);
            });
        }
        _playStart() {
            [262, 330, 392, 523, 659, 784].forEach((f, i) => {
                const o = this._osc(f, 'sine', 0.1);
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.08);
                g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.08 + 0.25);
                o.disconnect();
                o.connect(g).connect(this.ctx.destination);
                o.start(this.ctx.currentTime + i * 0.08);
                o.stop(this.ctx.currentTime + i * 0.08 + 0.25);
            });
        }
        _playEnd() {
            [784, 659, 523, 392, 330, 262].forEach((f, i) => {
                const o = this._osc(f, 'sine', 0.1);
                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.15);
                g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.15 + 0.4);
                o.disconnect();
                o.connect(g).connect(this.ctx.destination);
                o.start(this.ctx.currentTime + i * 0.15);
                o.stop(this.ctx.currentTime + i * 0.15 + 0.4);
            });
        }
        _playTick() {
            const o = this._osc(1000, 'sine', 0.04);
            this._schedule(o, 0.05);
        }
        _osc(freq, type, vol) {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = type;
            o.frequency.value = freq;
            g.gain.value = vol;
            o.connect(g).connect(this.ctx.destination);
            return o;
        }
        _schedule(o, dur) {
            o.start();
            o.stop(this.ctx.currentTime + dur);
        }
    }

    // ===== GAME STATE =====
    const state = {
        score: 0,
        hits: 0,
        misses: 0,
        combo: 0,
        maxCombo: 0,
        currentRound: 0,
        timeLeft: CONFIG.TOTAL_TIME,
        roundTimeLeft: 0,
        targets: [],           // { id, el, x, y, vx, vy, size, bornAt, lifetime, type }
        targetIdCounter: 0,
        spawnTimer: null,
        gameTimer: null,
        rafId: null,
        running: false,
    };

    // ===== DOM REFS =====
    const $ = (sel) => document.querySelector(sel);
    const dom = {};
    const audio = new AudioEngine();

    // ===== INIT =====
    function init() {
        dom.titleScreen = $('#title-screen');
        dom.roundScreen = $('#round-screen');
        dom.gameScreen = $('#game-screen');
        dom.resultScreen = $('#result-screen');
        dom.startBtn = $('#start-btn');
        dom.replayBtn = $('#replay-btn');
        dom.arena = $('#game-arena');
        dom.effectsLayer = $('#effects-layer');
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

        generateStars();

        dom.startBtn.addEventListener('click', startGame);
        dom.startBtn.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); });
        dom.replayBtn.addEventListener('click', restartGame);
        dom.replayBtn.addEventListener('touchend', (e) => { e.preventDefault(); restartGame(); });

        // Attach click to game-screen so it catches all clicks in the game area
        dom.gameScreen.addEventListener('click', onArenaClick);
        dom.gameScreen.addEventListener('touchstart', onArenaTouch, { passive: false });
    }

    function generateStars() {
        const container = $('#title-stars');
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 60 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            star.style.width = star.style.height = (2 + Math.random() * 4) + 'px';
            container.appendChild(star);
        }
    }

    // ===== SCREEN MANAGEMENT =====
    function showScreen(name) {
        document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
        const screen = $(`#${name}-screen`);
        if (screen) screen.classList.add('active');
    }

    // ===== GAME START =====
    function startGame() {
        audio.init();
        audio.play('start');
        resetState();
        showScreen('game');
        startRound(0);
    }
    function restartGame() {
        audio.init();
        audio.play('start');
        resetState();
        showScreen('game');
        startRound(0);
    }

    function resetState() {
        state.score = 0;
        state.hits = 0;
        state.misses = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.currentRound = 0;
        state.timeLeft = CONFIG.TOTAL_TIME;
        state.targets = [];
        state.targetIdCounter = 0;
        state.running = false;
        clearTimers();
        dom.arena.innerHTML = '';
        dom.effectsLayer.innerHTML = '';
        updateHUD();
    }

    // ===== ROUND MANAGEMENT =====
    function startRound(roundIndex) {
        if (roundIndex >= CONFIG.ROUNDS.length) {
            endGame();
            return;
        }
        state.currentRound = roundIndex;
        const round = CONFIG.ROUNDS[roundIndex];
        state.roundTimeLeft = round.duration;

        dom.roundNumber.textContent = round.name;
        dom.roundTheme.textContent = round.theme;
        dom.roundCharacter.innerHTML = `<img src="${round.charImg}" alt="" class="round-char-img">`;
        showScreen('round');
        audio.play('round');

        setTimeout(() => {
            showScreen('game');
            dom.hudRound.textContent = roundIndex + 1;
            state.running = true;
            startSpawning();
            startTimer();
            startGameLoop();
        }, 2000);
    }

    function nextRound() {
        state.running = false;
        clearTimers();
        removeAllTargets();
        startRound(state.currentRound + 1);
    }

    // ===== TIMER =====
    function startTimer() {
        clearInterval(state.gameTimer);
        state.gameTimer = setInterval(() => {
            if (!state.running) return;
            state.timeLeft--;
            state.roundTimeLeft--;
            updateTimerHUD();

            if (state.timeLeft <= 10) audio.play('tick');

            if (state.timeLeft <= 0) {
                endGame();
            } else if (state.roundTimeLeft <= 0) {
                nextRound();
            }
        }, 1000);
    }

    function updateTimerHUD() {
        dom.hudTimer.textContent = state.timeLeft;
        const progress = state.timeLeft / CONFIG.TOTAL_TIME;
        const dashOffset = 283 * (1 - progress);
        dom.timerCircle.style.strokeDashoffset = dashOffset;

        dom.timerCircle.classList.remove('warning', 'danger');
        if (state.timeLeft <= 10) {
            dom.timerCircle.classList.add('danger');
        } else if (state.timeLeft <= 20) {
            dom.timerCircle.classList.add('warning');
        }
    }

    // ===== GAME LOOP — moves targets via JS =====
    function startGameLoop() {
        cancelAnimationFrame(state.rafId);
        let lastTime = performance.now();

        function loop(now) {
            if (!state.running) return;
            const dt = (now - lastTime) / 1000; // seconds
            lastTime = now;

            const arenaW = dom.arena.clientWidth;
            const arenaH = dom.arena.clientHeight;

            // Update each target position
            for (let i = state.targets.length - 1; i >= 0; i--) {
                const t = state.targets[i];
                if (t.dead) continue;

                // Age check
                const age = now - t.bornAt;
                if (age > t.lifetime) {
                    // Fade out
                    t.el.style.opacity = '0';
                    t.el.style.transform = 'scale(0.5)';
                    t.dead = true;
                    setTimeout(() => { if (t.el.parentNode) t.el.remove(); }, 300);
                    state.targets.splice(i, 1);
                    continue;
                }

                // Fade in during first 300ms
                if (age < 300) {
                    const fadeProgress = age / 300;
                    t.el.style.opacity = fadeProgress;
                    t.el.style.transform = `scale(${0.3 + 0.7 * fadeProgress})`;
                } else {
                    t.el.style.opacity = '1';
                    t.el.style.transform = 'scale(1)';
                }

                // Fade out during last 500ms
                const timeLeft = t.lifetime - age;
                if (timeLeft < 500) {
                    const fadeOut = timeLeft / 500;
                    t.el.style.opacity = fadeOut;
                }

                // Move
                t.x += t.vx * dt * 60;
                t.y += t.vy * dt * 60;

                // Bounce off walls
                if (t.x < 10) { t.x = 10; t.vx = Math.abs(t.vx); }
                if (t.x > arenaW - t.size - 10) { t.x = arenaW - t.size - 10; t.vx = -Math.abs(t.vx); }
                if (t.y < 60) { t.y = 60; t.vy = Math.abs(t.vy); }
                if (t.y > arenaH - t.size - 10) { t.y = arenaH - t.size - 10; t.vy = -Math.abs(t.vy); }

                // Apply a gentle wobble
                const wobble = Math.sin(now * 0.003 + t.id) * 3;

                t.el.style.left = t.x + 'px';
                t.el.style.top = (t.y + wobble) + 'px';
            }

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
            if (!state.running) return;
            spawnTarget();
            scheduleNextSpawn();
        }, delay);
    }

    function spawnTarget() {
        const round = CONFIG.ROUNDS[state.currentRound];
        const activeCount = state.targets.filter(t => !t.dead).length;
        if (activeCount >= round.maxTargets) return;

        const charType = round.targets[Math.floor(Math.random() * round.targets.length)];
        const imgSrc = CONFIG.TARGET_IMAGES[charType];
        const [minSize, maxSize] = round.targetSize;
        const size = minSize + Math.random() * (maxSize - minSize);

        const arenaW = dom.arena.clientWidth;
        const arenaH = dom.arena.clientHeight;
        const x = 40 + Math.random() * (arenaW - size - 80);
        const y = 80 + Math.random() * (arenaH - size - 140);

        // Random velocity
        const speed = round.speed;
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * speed * (0.5 + Math.random() * 0.5);
        const vy = Math.sin(angle) * speed * (0.5 + Math.random() * 0.5);

        // Lifetime
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
        el.style.transition = 'opacity 0.3s, transform 0.3s';
        el.style.zIndex = '10';

        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = charType;
        el.appendChild(img);

        dom.arena.appendChild(el);
        const targetObj = { id, el, x, y, vx, vy, size, bornAt: performance.now(), lifetime, type: charType, dead: false };
        state.targets.push(targetObj);

        // Direct click handler on the target for reliable hit detection
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.running || targetObj.dead) return;
            handleHit(targetObj, e.clientX, e.clientY);
        });
        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!state.running || targetObj.dead) return;
            const touch = e.changedTouches[0];
            handleHit(targetObj, touch.clientX, touch.clientY);
        }, { passive: false });
    }

    function removeAllTargets() {
        state.targets.forEach((t) => {
            if (t.el.parentNode) t.el.remove();
        });
        state.targets = [];
    }

    // ===== INPUT HANDLING =====
    function onArenaTouch(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            processClick(touch.clientX, touch.clientY);
        }
    }

    function onArenaClick(e) {
        processClick(e.clientX, e.clientY);
    }

    function processClick(clientX, clientY) {
        if (!state.running) return;

        showCrosshairFlash(clientX, clientY);

        // Check if hit any target — use current rendered position
        let hitTarget = null;
        for (let i = state.targets.length - 1; i >= 0; i--) {
            const t = state.targets[i];
            if (t.dead) continue;
            const rect = t.el.getBoundingClientRect();
            const padding = 15; // generous hitbox
            if (
                clientX >= rect.left - padding &&
                clientX <= rect.right + padding &&
                clientY >= rect.top - padding &&
                clientY <= rect.bottom + padding
            ) {
                hitTarget = t;
                break;
            }
        }

        if (hitTarget) {
            handleHit(hitTarget, clientX, clientY);
        } else {
            handleMiss(clientX, clientY);
        }
    }

    function handleHit(targetObj, x, y) {
        // Guard against double-hit from multiple event paths
        if (targetObj.dead) return;
        
        // Combo
        state.combo++;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
        const comboMultiplier = Math.min(state.combo, 10);

        // Score
        const points = CONFIG.SCORE_BASE * comboMultiplier;
        state.score += points;
        state.hits++;

        // Visual hit effect on target
        targetObj.dead = true;
        targetObj.el.classList.add('hit');
        setTimeout(() => { if (targetObj.el.parentNode) targetObj.el.remove(); }, 400);
        // Remove from array
        const idx = state.targets.indexOf(targetObj);
        if (idx !== -1) state.targets.splice(idx, 1);

        // Effects
        showScorePopup(x, y, points, comboMultiplier);
        showStarBurst(x, y);

        // Audio
        if (state.combo >= 3 && state.combo % 3 === 0) {
            audio.play('combo');
        } else {
            audio.play('hit');
        }

        updateHUD();
    }

    function handleMiss(x, y) {
        state.combo = 0;
        state.misses++;
        showMissMarker(x, y);
        audio.play('miss');
        updateHUD();
    }

    // ===== HUD UPDATE =====
    function updateHUD() {
        dom.hudScore.textContent = state.score.toLocaleString();
        dom.hudHits.textContent = state.hits;

        if (state.combo >= 2) {
            dom.hudComboContainer.style.display = 'flex';
            dom.hudCombo.textContent = `×${state.combo}`;
            dom.hudComboContainer.style.animation = 'none';
            dom.hudComboContainer.offsetHeight;
            dom.hudComboContainer.style.animation = '';
        } else {
            dom.hudComboContainer.style.display = 'none';
        }
    }

    // ===== EFFECTS =====
    function showScorePopup(x, y, points, multiplier) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = `+${points}`;
        if (multiplier >= 3) {
            popup.style.color = '#FF6B35';
            popup.style.fontSize = '36px';
        }
        if (multiplier >= 5) {
            popup.style.color = '#FF0000';
            popup.style.fontSize = '42px';
        }
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        dom.effectsLayer.appendChild(popup);
        setTimeout(() => popup.remove(), 1000);
    }

    function showStarBurst(x, y) {
        const stars = ['⭐', '✨', '💫', '🌟', '⚡'];
        for (let i = 0; i < 6; i++) {
            const star = document.createElement('div');
            star.className = 'star-particle';
            star.textContent = stars[Math.floor(Math.random() * stars.length)];
            const angle = (Math.PI * 2 * i) / 6;
            const dist = 40 + Math.random() * 40;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            star.style.left = x + 'px';
            star.style.top = y + 'px';
            star.animate(
                [
                    { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
                    { transform: `translate(${dx}px, ${dy}px) scale(0.3) rotate(${180 + Math.random() * 180}deg)`, opacity: 0 },
                ],
                { duration: 800, easing: 'ease-out', fill: 'forwards' }
            );
            dom.effectsLayer.appendChild(star);
            setTimeout(() => star.remove(), 800);
        }
    }

    function showMissMarker(x, y) {
        const miss = document.createElement('div');
        miss.className = 'miss-marker';
        miss.style.left = x + 'px';
        miss.style.top = y + 'px';
        dom.effectsLayer.appendChild(miss);
        setTimeout(() => miss.remove(), 500);
    }

    function showCrosshairFlash(x, y) {
        const ch = document.createElement('div');
        ch.className = 'crosshair-flash';
        ch.style.left = x + 'px';
        ch.style.top = y + 'px';
        ch.animate(
            [
                { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
                { opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' },
            ],
            { duration: 300, easing: 'ease-out', fill: 'forwards' }
        );
        dom.effectsLayer.appendChild(ch);
        setTimeout(() => ch.remove(), 300);
    }

    // ===== GAME END =====
    function endGame() {
        state.running = false;
        clearTimers();
        cancelAnimationFrame(state.rafId);
        audio.play('end');

        setTimeout(() => {
            showResults();
            showScreen('result');
        }, 800);
    }

    function showResults() {
        const totalShots = state.hits + state.misses;
        const accuracy = totalShots > 0 ? Math.round((state.hits / totalShots) * 100) : 0;

        dom.resultScore.textContent = state.score.toLocaleString();
        dom.resultHits.textContent = state.hits;
        dom.resultMaxCombo.textContent = `×${state.maxCombo}`;
        dom.resultAccuracy.textContent = accuracy + '%';

        let rank, message;
        if (state.score >= 10000) {
            rank = '🏆🌟🏆';
            message = 'すごすぎる！マスターシューター！';
        } else if (state.score >= 7000) {
            rank = '⭐⭐⭐';
            message = 'すばらしい！スーパーシューター！';
        } else if (state.score >= 4000) {
            rank = '⭐⭐';
            message = 'いいね！もっとがんばろう！';
        } else if (state.score >= 2000) {
            rank = '⭐';
            message = 'ナイスチャレンジ！';
        } else {
            rank = '🎯';
            message = 'つぎはもっとがんばろう！';
        }
        dom.resultRank.textContent = rank;
        dom.resultMessage.textContent = message;

        animateCountUp(dom.resultScore, 0, state.score, 1500);
    }

    function animateCountUp(el, from, to, duration) {
        const startTime = performance.now();
        function frame(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + (to - from) * eased);
            el.textContent = current.toLocaleString();
            if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    // ===== UTILITY =====
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
