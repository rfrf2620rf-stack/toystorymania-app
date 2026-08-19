/* ==============================
   ハムの皿投げ (Plate Toss) ミニゲーム
   動くお皿を狙って豆袋を投げる
   ============================== */

(function () {
    'use strict';

    const CONFIG = {
        TOTAL_THROWS: 10,
        MAX_PULL: 100,
        MIN_PULL: 15,
        MAX_THROW_FACTOR: 0.78, // fraction of field height reachable at full power
        FLIGHT_MS: 400,
        LAUNCH_X_PCT: 0.5,
        LAUNCH_Y_PCT: 0.88,
        MARGIN_PCT: 0.14, // horizontal margin the plates bounce within
        LANES: [
            { yPct: 0.18, points: 400, speed: 0.18, sizePct: 0.10 }, // px/ms
            { yPct: 0.40, points: 200, speed: 0.12, sizePct: 0.14 },
            { yPct: 0.62, points: 80, speed: 0.07, sizePct: 0.19 },
        ],
    };

    const state = {
        running: false,
        busy: false,
        score: 0,
        hits: 0,
        throwsLeft: CONFIG.TOTAL_THROWS,
        dragging: false,
        launchPos: { x: 0, y: 0 },
        plateThrow: { x: 0, y: 0 },
        lanes: [], // { cfg, x, dir, y, radius, el }
        lastFrameTime: 0,
        rafId: null,
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
        dom.plateBtn = $('#plate-btn');
        dom.backBtn = $('#plate-back-btn');
        dom.field = $('#plate-field');
        dom.laneLayer = $('#lane-layer');
        dom.flightLayer = $('#plate-flight-layer');
        dom.launcher = $('#plate-launcher');
        dom.plateToy = $('#plate-toy');
        dom.scoreEl = $('#plate-score');
        dom.countEl = $('#plate-count');
        dom.resultScore = $('#plate-result-score');
        dom.resultHits = $('#plate-result-hits');
        dom.resultRank = $('#plate-result-rank');
        dom.resultMessage = $('#plate-result-message');
        dom.replayBtn = $('#plate-replay-btn');
        dom.titleBtn = $('#plate-title-btn');

        if (!dom.plateBtn) return; // markup not present

        dom.plateBtn.addEventListener('click', startPlates);
        dom.plateBtn.addEventListener('touchend', (e) => { e.preventDefault(); startPlates(); });

        dom.backBtn.addEventListener('click', quitToTitle);
        dom.backBtn.addEventListener('touchend', (e) => { e.preventDefault(); quitToTitle(); });

        dom.replayBtn.addEventListener('click', startPlates);
        dom.replayBtn.addEventListener('touchend', (e) => { e.preventDefault(); startPlates(); });

        dom.titleBtn.addEventListener('click', () => { stopLoop(); showScreen('title-screen'); });
        dom.titleBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopLoop(); showScreen('title-screen'); });

        dom.plateToy.addEventListener('touchstart', onDragStart, { passive: false });
        dom.plateToy.addEventListener('touchmove', onDragMove, { passive: false });
        dom.plateToy.addEventListener('touchend', onDragEnd, { passive: false });
        dom.plateToy.addEventListener('mousedown', onDragStart);
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
        const xMin = rect.width * CONFIG.MARGIN_PCT;
        const xMax = rect.width * (1 - CONFIG.MARGIN_PCT);

        state.lanes = CONFIG.LANES.map((cfg, i) => {
            const size = minSide * cfg.sizePct;
            const existing = state.lanes[i];
            return {
                cfg,
                y: rect.height * cfg.yPct,
                size,
                radius: size * 0.55,
                xMin,
                xMax,
                x: existing ? Math.min(Math.max(existing.x, xMin), xMax) : xMin + (xMax - xMin) * (0.3 + i * 0.2),
                dir: existing ? existing.dir : (i % 2 === 0 ? 1 : -1),
            };
        });

        renderLanes();
    }

    function renderLanes() {
        dom.laneLayer.innerHTML = '';
        state.lanes.forEach((lane, i) => {
            const el = document.createElement('div');
            el.className = 'lane-plate';
            el.style.width = lane.size + 'px';
            el.style.height = lane.size + 'px';
            el.style.top = lane.y + 'px';
            el.innerHTML = '<span class="lane-plate-points">' + lane.cfg.points + '</span>';
            dom.laneLayer.appendChild(el);
            lane.el = el;
        });
        positionLanes();
    }

    function positionLanes() {
        state.lanes.forEach((lane) => {
            if (lane.el) lane.el.style.left = lane.x + 'px';
        });
    }

    function stepLanes(dtMs) {
        state.lanes.forEach((lane) => {
            lane.x += lane.dir * lane.cfg.speed * dtMs;
            if (lane.x <= lane.xMin) { lane.x = lane.xMin; lane.dir = 1; }
            else if (lane.x >= lane.xMax) { lane.x = lane.xMax; lane.dir = -1; }
        });
        positionLanes();
    }

    function loop(now) {
        if (!state.running) return;
        if (!state.lastFrameTime) state.lastFrameTime = now;
        const dt = now - state.lastFrameTime;
        state.lastFrameTime = now;
        stepLanes(dt);
        state.rafId = requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (state.rafId) cancelAnimationFrame(state.rafId);
        state.rafId = null;
        state.lastFrameTime = 0;
    }

    function startPlates() {
        state.running = true;
        state.busy = false;
        state.score = 0;
        state.hits = 0;
        state.throwsLeft = CONFIG.TOTAL_THROWS;
        dom.flightLayer.innerHTML = '';
        resetPlateToy();
        updateHUD();
        showScreen('plates-screen');
        requestAnimationFrame(() => {
            layoutField();
            stopLoop();
            state.lastFrameTime = 0;
            state.rafId = requestAnimationFrame(loop);
        });
    }

    function updateHUD() {
        dom.scoreEl.textContent = state.score;
        dom.countEl.textContent = state.throwsLeft;
    }

    function resetPlateToy() {
        dom.plateToy.style.transform = 'translate(-50%, -50%)';
        dom.plateToy.style.opacity = '1';
        state.plateThrow = { x: 0, y: 0 };
    }

    function onDragStart(e) {
        if (!state.running || state.busy || state.throwsLeft <= 0) return;
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
        state.plateThrow = { x: dx, y: dy };
        dom.plateToy.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    function onDragEnd(e) {
        if (!state.dragging) return;
        e.preventDefault();
        state.dragging = false;

        const { x: dx, y: dy } = state.plateThrow;
        const pullDist = Math.sqrt(dx * dx + dy * dy);

        if (pullDist < CONFIG.MIN_PULL) {
            resetPlateToy();
            return;
        }

        const power = Math.min(pullDist / CONFIG.MAX_PULL, 1);
        const angle = Math.atan2(-dy, -dx); // opposite of pull direction
        const rect = dom.field.getBoundingClientRect();
        const throwDist = power * rect.height * CONFIG.MAX_THROW_FACTOR;

        let landX = state.launchPos.x + Math.cos(angle) * throwDist;
        let landY = state.launchPos.y + Math.sin(angle) * throwDist;
        landX = Math.max(10, Math.min(rect.width - 10, landX));
        landY = Math.max(rect.height * 0.06, Math.min(state.launchPos.y - 10, landY));

        throwPlateBall({ x: landX, y: landY });
    }

    function throwPlateBall(landing) {
        state.busy = true;
        state.throwsLeft -= 1;
        updateHUD();
        dom.plateToy.style.opacity = '0';

        const flying = document.createElement('div');
        flying.className = 'flying-bean';
        flying.style.left = state.launchPos.x + 'px';
        flying.style.top = state.launchPos.y + 'px';
        flying.style.transform = 'translate(-50%, -50%)';
        dom.flightLayer.appendChild(flying);

        // Force reflow so the transition below is picked up
        // eslint-disable-next-line no-unused-expressions
        flying.offsetHeight;

        flying.style.transition = `transform ${CONFIG.FLIGHT_MS}ms cubic-bezier(.3,.6,.3,1)`;
        flying.style.transform = `translate(-50%, -50%) translate(${landing.x - state.launchPos.x}px, ${landing.y - state.launchPos.y}px)`;

        setTimeout(() => resolveThrow(flying, landing), CONFIG.FLIGHT_MS);
    }

    function resolveThrow(flying, landing) {
        let bestLane = null;
        let bestDist = Infinity;
        state.lanes.forEach((lane) => {
            // lane.x already reflects the real time elapsed during the flight
            // (the animation loop keeps running the whole time), so it IS the
            // plate's actual position now -- no further prediction needed.
            const dist = Math.hypot(landing.x - lane.x, landing.y - lane.y);
            if (dist <= lane.radius && dist < bestDist) {
                bestDist = dist;
                bestLane = lane;
            }
        });

        if (bestLane) {
            state.score += bestLane.cfg.points;
            state.hits += 1;
            flying.classList.add('bean-hit');
            if (bestLane.el) {
                bestLane.el.classList.add('plate-hit');
                setTimeout(() => bestLane.el && bestLane.el.classList.remove('plate-hit'), 500);
            }
        } else {
            flying.classList.add('bean-miss');
        }

        updateHUD();
        setTimeout(() => flying.remove(), 700);

        if (state.throwsLeft <= 0) {
            setTimeout(endPlates, 500);
        } else {
            resetPlateToy();
            state.busy = false;
        }
    }

    function endPlates() {
        state.running = false;
        state.busy = false;
        stopLoop();

        dom.resultScore.textContent = state.score;
        dom.resultHits.textContent = `${state.hits} / ${CONFIG.TOTAL_THROWS}`;

        let rank, message;
        if (state.score >= 3000) { rank = '⭐⭐⭐'; message = 'お皿マスター！'; }
        else if (state.score >= 1800) { rank = '⭐⭐'; message = 'すばらしい！'; }
        else if (state.score >= 800) { rank = '⭐'; message = 'よくできました！'; }
        else { rank = '🍽️'; message = 'もっと練習しよう！'; }

        dom.resultRank.textContent = rank;
        dom.resultMessage.textContent = message;

        showScreen('plates-result-screen');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
