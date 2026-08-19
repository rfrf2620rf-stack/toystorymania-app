/* ==============================
   レックスのダイナソーダーツ (Dart Toss) ミニゲーム
   ============================== */

(function () {
    'use strict';

    const CONFIG = {
        TOTAL_DARTS: 10,
        MAX_PULL: 100,
        MIN_PULL: 15,
        POWER_AT_BULLSEYE: 0.75, // pull power (0..1) that lands exactly on board center
        FLIGHT_MS: 400,
        BOARD_X_PCT: 0.5,
        BOARD_Y_PCT: 0.30,
        BOARD_SIZE_PCT: 0.33, // fraction of min(field.w, field.h) used as board diameter
        LAUNCH_X_PCT: 0.5,
        LAUNCH_Y_PCT: 0.88,
        MOVE_AFTER_DARTS: 5, // board starts moving once this many darts have been thrown
        BOARD_MOVE_SPEED: 0.09, // px/ms
        ZONES: [
            { r: 0.10, points: 500, bullseye: true },
            { r: 0.24, points: 300 },
            { r: 0.46, points: 150 },
            { r: 0.70, points: 80 },
            { r: 1.00, points: 30 },
        ],
    };

    const state = {
        running: false,
        busy: false,
        score: 0,
        bullseyes: 0,
        dartsLeft: CONFIG.TOTAL_DARTS,
        dragging: false,
        launchPos: { x: 0, y: 0 },
        boardCenter: { x: 0, y: 0 },
        boardRadius: 0,
        boardBounds: { xMin: 0, xMax: 0 },
        boardMoving: false,
        boardDir: 1,
        calibDist: 0,
        dartPull: { x: 0, y: 0 },
        rafId: null,
        lastFrameTime: 0,
    };

    const dom = {};
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function showScreen(id) {
        $$('.screen').forEach((s) => s.classList.remove('active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }

    function getEventPos(e) {
        const t = e.touches && e.touches.length ? e.touches[0] : e;
        const rect = dom.field.getBoundingClientRect();
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function init() {
        dom.dartBtn = $('#dart-btn');
        dom.backBtn = $('#dart-back-btn');
        dom.field = $('#dart-field');
        dom.board = $('#dartboard');
        dom.flightLayer = $('#dart-flight-layer');
        dom.launcher = $('#dart-launcher');
        dom.dartToy = $('#dart-toy');
        dom.scoreEl = $('#dart-score');
        dom.countEl = $('#dart-count');
        dom.resultScore = $('#dart-result-score');
        dom.resultBulls = $('#dart-result-bulls');
        dom.resultRank = $('#dart-result-rank');
        dom.resultMessage = $('#dart-result-message');
        dom.replayBtn = $('#dart-replay-btn');
        dom.titleBtn = $('#dart-title-btn');

        if (!dom.dartBtn) return; // markup not present

        dom.dartBtn.addEventListener('click', startDarts);
        dom.dartBtn.addEventListener('touchend', (e) => { e.preventDefault(); startDarts(); });

        dom.backBtn.addEventListener('click', quitToTitle);
        dom.backBtn.addEventListener('touchend', (e) => { e.preventDefault(); quitToTitle(); });

        dom.replayBtn.addEventListener('click', startDarts);
        dom.replayBtn.addEventListener('touchend', (e) => { e.preventDefault(); startDarts(); });

        dom.titleBtn.addEventListener('click', () => { stopLoop(); showScreen('title-screen'); });
        dom.titleBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopLoop(); showScreen('title-screen'); });

        dom.dartToy.addEventListener('touchstart', onDragStart, { passive: false });
        dom.dartToy.addEventListener('touchmove', onDragMove, { passive: false });
        dom.dartToy.addEventListener('touchend', onDragEnd, { passive: false });
        dom.dartToy.addEventListener('mousedown', onDragStart);
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);

        window.addEventListener('resize', layoutField);
    }

    function quitToTitle() {
        state.running = false;
        stopLoop();
        showScreen('title-screen');
    }

    function layoutField() {
        const rect = dom.field.getBoundingClientRect();

        state.launchPos = { x: rect.width * CONFIG.LAUNCH_X_PCT, y: rect.height * CONFIG.LAUNCH_Y_PCT };
        dom.launcher.style.left = state.launchPos.x + 'px';
        dom.launcher.style.top = state.launchPos.y + 'px';

        const minSide = Math.min(rect.width, rect.height);
        state.boardRadius = (minSide * CONFIG.BOARD_SIZE_PCT) / 2;
        state.boardBounds = {
            xMin: state.boardRadius + 10,
            xMax: rect.width - state.boardRadius - 10,
        };

        const boardX = state.boardMoving
            ? Math.max(state.boardBounds.xMin, Math.min(state.boardBounds.xMax, state.boardCenter.x))
            : rect.width * CONFIG.BOARD_X_PCT;
        state.boardCenter = { x: boardX, y: rect.height * CONFIG.BOARD_Y_PCT };

        dom.board.style.left = state.boardCenter.x + 'px';
        dom.board.style.top = state.boardCenter.y + 'px';
        dom.board.style.width = state.boardRadius * 2 + 'px';
        dom.board.style.height = state.boardRadius * 2 + 'px';

        const distToBoard = Math.hypot(
            state.boardCenter.x - state.launchPos.x,
            state.boardCenter.y - state.launchPos.y
        );
        state.calibDist = distToBoard / CONFIG.POWER_AT_BULLSEYE;
    }

    function activateBoardMovement() {
        state.boardMoving = true;
        state.boardDir = Math.random() < 0.5 ? 1 : -1;

        const toast = document.createElement('div');
        toast.className = 'dart-toast';
        toast.textContent = '的が動き出した！';
        dom.field.appendChild(toast);
        setTimeout(() => toast.remove(), 1600);

        dom.board.classList.add('board-moving');

        stopLoop();
        state.lastFrameTime = 0;
        state.rafId = requestAnimationFrame(boardLoop);
    }

    function boardLoop(now) {
        if (!state.running || !state.boardMoving) return;
        if (!state.lastFrameTime) state.lastFrameTime = now;
        const dt = now - state.lastFrameTime;
        state.lastFrameTime = now;

        state.boardCenter.x += state.boardDir * CONFIG.BOARD_MOVE_SPEED * dt;
        if (state.boardCenter.x <= state.boardBounds.xMin) {
            state.boardCenter.x = state.boardBounds.xMin;
            state.boardDir = 1;
        } else if (state.boardCenter.x >= state.boardBounds.xMax) {
            state.boardCenter.x = state.boardBounds.xMax;
            state.boardDir = -1;
        }
        dom.board.style.left = state.boardCenter.x + 'px';

        state.rafId = requestAnimationFrame(boardLoop);
    }

    function stopLoop() {
        if (state.rafId) cancelAnimationFrame(state.rafId);
        state.rafId = null;
        state.lastFrameTime = 0;
    }

    function startDarts() {
        state.running = true;
        state.busy = false;
        state.score = 0;
        state.bullseyes = 0;
        state.dartsLeft = CONFIG.TOTAL_DARTS;
        state.boardMoving = false;
        state.boardDir = 1;
        stopLoop();
        dom.board.classList.remove('board-moving');
        dom.flightLayer.innerHTML = '';
        resetDartToy();
        updateHUD();
        showScreen('darts-screen');
        requestAnimationFrame(layoutField);
    }

    function updateHUD() {
        dom.scoreEl.textContent = state.score;
        dom.countEl.textContent = state.dartsLeft;
    }

    function resetDartToy() {
        dom.dartToy.style.transform = 'translate(-50%, -50%)';
        dom.dartToy.style.opacity = '1';
        state.dartPull = { x: 0, y: 0 };
    }

    function onDragStart(e) {
        if (!state.running || state.busy || state.dartsLeft <= 0) return;
        e.preventDefault();
        state.dragging = true;
    }

    function onDragMove(e) {
        if (!state.dragging) return;
        e.preventDefault();
        const pos = getEventPos(e);
        let dx = pos.x - state.launchPos.x;
        let dy = pos.y - state.launchPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > CONFIG.MAX_PULL) {
            dx = (dx / dist) * CONFIG.MAX_PULL;
            dy = (dy / dist) * CONFIG.MAX_PULL;
        }
        state.dartPull = { x: dx, y: dy };
        dom.dartToy.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    function onDragEnd(e) {
        if (!state.dragging) return;
        e.preventDefault();
        state.dragging = false;

        const { x: dx, y: dy } = state.dartPull;
        const pullDist = Math.sqrt(dx * dx + dy * dy);

        if (pullDist < CONFIG.MIN_PULL) {
            resetDartToy();
            return;
        }

        const power = Math.min(pullDist / CONFIG.MAX_PULL, 1);
        const angle = Math.atan2(-dy, -dx); // opposite of pull direction
        const throwDist = power * state.calibDist;

        const rect = dom.field.getBoundingClientRect();
        let landX = state.launchPos.x + Math.cos(angle) * throwDist;
        let landY = state.launchPos.y + Math.sin(angle) * throwDist;
        landX = Math.max(10, Math.min(rect.width - 10, landX));
        landY = Math.max(rect.height * 0.04, Math.min(state.launchPos.y - 10, landY));

        throwDart({ x: landX, y: landY });
    }

    function throwDart(landing) {
        state.busy = true;
        state.dartsLeft -= 1;
        updateHUD();
        dom.dartToy.style.opacity = '0';

        if (!state.boardMoving && CONFIG.TOTAL_DARTS - state.dartsLeft >= CONFIG.MOVE_AFTER_DARTS) {
            activateBoardMovement();
        }

        const flying = document.createElement('div');
        flying.className = 'flying-dart';
        flying.style.left = state.launchPos.x + 'px';
        flying.style.top = state.launchPos.y + 'px';
        flying.style.transform = 'translate(-50%, -50%)';
        dom.flightLayer.appendChild(flying);

        // Force reflow so the transition below is picked up
        // eslint-disable-next-line no-unused-expressions
        flying.offsetHeight;

        flying.style.transition = `transform ${CONFIG.FLIGHT_MS}ms cubic-bezier(.2,.7,.3,1)`;
        flying.style.transform = `translate(-50%, -50%) translate(${landing.x - state.launchPos.x}px, ${landing.y - state.launchPos.y}px)`;

        setTimeout(() => resolveThrow(flying, landing), CONFIG.FLIGHT_MS);
    }

    function resolveThrow(flying, landing) {
        const distFromCenter = Math.hypot(landing.x - state.boardCenter.x, landing.y - state.boardCenter.y);
        const normalized = distFromCenter / state.boardRadius;

        const zone = CONFIG.ZONES.find((z) => normalized <= z.r);

        if (zone) {
            state.score += zone.points;
            if (zone.bullseye) state.bullseyes += 1;
            flying.classList.add('dart-hit');
            dom.board.classList.add('board-hit');
            setTimeout(() => dom.board.classList.remove('board-hit'), 400);
        } else {
            flying.classList.add('dart-miss');
        }

        updateHUD();
        setTimeout(() => flying.remove(), 900);

        if (state.dartsLeft <= 0) {
            setTimeout(endDarts, 500);
        } else {
            resetDartToy();
            state.busy = false;
        }
    }

    function endDarts() {
        state.running = false;
        state.busy = false;
        stopLoop();

        dom.resultScore.textContent = state.score;
        dom.resultBulls.textContent = `${state.bullseyes} / ${CONFIG.TOTAL_DARTS}`;

        let rank, message;
        if (state.score >= 3000) { rank = '⭐⭐⭐'; message = 'ダーツマスター！'; }
        else if (state.score >= 1800) { rank = '⭐⭐'; message = 'すばらしい！'; }
        else if (state.score >= 800) { rank = '⭐'; message = 'よくできました！'; }
        else { rank = '🎯'; message = 'もっと練習しよう！'; }

        dom.resultRank.textContent = rank;
        dom.resultMessage.textContent = message;

        showScreen('darts-result-screen');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
