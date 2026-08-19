/* ==============================
   輪投げ (Ring Toss) ミニゲーム
   ============================== */

(function () {
    'use strict';

    const CONFIG = {
        TOTAL_RINGS: 10,
        MAX_PULL: 100,
        MIN_PULL: 15,
        MAX_THROW_FACTOR: 0.78, // fraction of field height reachable at full power
        FLIGHT_MS: 450,
        PEGS: [
            { img: 'assets/hamm.png', xPct: 0.26, yPct: 0.15, sizePct: 0.12, points: 500 },
            { img: 'assets/alien.png', xPct: 0.74, yPct: 0.15, sizePct: 0.12, points: 500 },
            { img: 'assets/buzz.png', xPct: 0.18, yPct: 0.40, sizePct: 0.16, points: 300 },
            { img: 'assets/jessie.png', xPct: 0.82, yPct: 0.40, sizePct: 0.16, points: 300 },
            { img: 'assets/woody.png', xPct: 0.50, yPct: 0.60, sizePct: 0.22, points: 100 },
        ],
    };

    const state = {
        running: false,
        busy: false,
        score: 0,
        hits: 0,
        ringsLeft: CONFIG.TOTAL_RINGS,
        dragging: false,
        launchPos: { x: 0, y: 0 },
        ringPull: { x: 0, y: 0 },
        pegsLayout: [],
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
        dom.ringBtn = $('#ring-btn');
        dom.backBtn = $('#ring-back-btn');
        dom.field = $('#ring-field');
        dom.pegLayer = $('#peg-layer');
        dom.flightLayer = $('#ring-flight-layer');
        dom.launcher = $('#ring-launcher');
        dom.ringToy = $('#ring-toy');
        dom.scoreEl = $('#ring-score');
        dom.countEl = $('#ring-count');
        dom.resultScore = $('#ring-result-score');
        dom.resultHits = $('#ring-result-hits');
        dom.resultRank = $('#ring-result-rank');
        dom.resultMessage = $('#ring-result-message');
        dom.replayBtn = $('#ring-replay-btn');
        dom.titleBtn = $('#ring-title-btn');

        if (!dom.ringBtn) return; // markup not present

        dom.ringBtn.addEventListener('click', startRingToss);
        dom.ringBtn.addEventListener('touchend', (e) => { e.preventDefault(); startRingToss(); });

        dom.backBtn.addEventListener('click', quitToTitle);
        dom.backBtn.addEventListener('touchend', (e) => { e.preventDefault(); quitToTitle(); });

        dom.replayBtn.addEventListener('click', startRingToss);
        dom.replayBtn.addEventListener('touchend', (e) => { e.preventDefault(); startRingToss(); });

        dom.titleBtn.addEventListener('click', () => showScreen('title-screen'));
        dom.titleBtn.addEventListener('touchend', (e) => { e.preventDefault(); showScreen('title-screen'); });

        dom.ringToy.addEventListener('touchstart', onDragStart, { passive: false });
        dom.ringToy.addEventListener('touchmove', onDragMove, { passive: false });
        dom.ringToy.addEventListener('touchend', onDragEnd, { passive: false });
        dom.ringToy.addEventListener('mousedown', onDragStart);
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);

        window.addEventListener('resize', layoutField);
    }

    function quitToTitle() {
        state.running = false;
        showScreen('title-screen');
    }

    function layoutField() {
        const rect = dom.field.getBoundingClientRect();
        state.launchPos = { x: rect.width * 0.5, y: rect.height * 0.86 };
        dom.launcher.style.left = state.launchPos.x + 'px';
        dom.launcher.style.top = state.launchPos.y + 'px';

        const minSide = Math.min(rect.width, rect.height);
        state.pegsLayout = CONFIG.PEGS.map((peg) => {
            const size = minSide * peg.sizePct;
            return {
                ...peg,
                x: rect.width * peg.xPct,
                y: rect.height * peg.yPct,
                size,
                radius: size * 0.62,
            };
        });

        renderPegs();
    }

    function renderPegs() {
        dom.pegLayer.innerHTML = '';
        state.pegsLayout.forEach((peg, i) => {
            const el = document.createElement('div');
            el.className = 'peg';
            el.style.left = peg.x + 'px';
            el.style.top = peg.y + 'px';
            el.style.width = peg.size + 'px';
            el.style.height = peg.size + 'px';
            el.dataset.index = i;
            el.innerHTML = `
                <img src="${peg.img}" alt="" class="peg-img" />
                <span class="peg-points">${peg.points}</span>
            `;
            dom.pegLayer.appendChild(el);
        });
    }

    function startRingToss() {
        state.running = true;
        state.busy = false;
        state.score = 0;
        state.hits = 0;
        state.ringsLeft = CONFIG.TOTAL_RINGS;
        dom.flightLayer.innerHTML = '';
        resetRingToy();
        updateHUD();
        showScreen('ringtoss-screen');
        // Field must be visible to measure its size correctly
        requestAnimationFrame(layoutField);
    }

    function updateHUD() {
        dom.scoreEl.textContent = state.score;
        dom.countEl.textContent = state.ringsLeft;
    }

    function resetRingToy() {
        dom.ringToy.style.transform = 'translate(-50%, -50%)';
        dom.ringToy.style.opacity = '1';
        state.ringPull = { x: 0, y: 0 };
    }

    function onDragStart(e) {
        if (!state.running || state.busy || state.ringsLeft <= 0) return;
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
        state.ringPull = { x: dx, y: dy };
        dom.ringToy.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    function onDragEnd(e) {
        if (!state.dragging) return;
        e.preventDefault();
        state.dragging = false;

        const { x: dx, y: dy } = state.ringPull;
        const pullDist = Math.sqrt(dx * dx + dy * dy);

        if (pullDist < CONFIG.MIN_PULL) {
            resetRingToy();
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

        throwRing({ x: landX, y: landY }, power);
    }

    function throwRing(landing, power) {
        state.busy = true;
        state.ringsLeft -= 1;
        updateHUD();
        dom.ringToy.style.opacity = '0';

        const flying = document.createElement('div');
        flying.className = 'flying-ring';
        flying.style.left = state.launchPos.x + 'px';
        flying.style.top = state.launchPos.y + 'px';
        flying.style.transform = 'translate(-50%, -50%)';
        dom.flightLayer.appendChild(flying);

        // Force reflow so the transition below is picked up
        // eslint-disable-next-line no-unused-expressions
        flying.offsetHeight;

        const endScale = Math.max(0.45, 1 - (state.launchPos.y - landing.y) / state.launchPos.y * 0.7);
        flying.style.transition = `transform ${CONFIG.FLIGHT_MS}ms cubic-bezier(.2,.7,.3,1)`;
        flying.style.transform = `translate(-50%, -50%) translate(${landing.x - state.launchPos.x}px, ${landing.y - state.launchPos.y}px) scale(${endScale})`;

        setTimeout(() => resolveThrow(flying, landing, power), CONFIG.FLIGHT_MS);
    }

    function resolveThrow(flying, landing, power) {
        let bestPeg = null;
        let bestDist = Infinity;
        state.pegsLayout.forEach((peg) => {
            const dist = Math.hypot(landing.x - peg.x, landing.y - peg.y);
            if (dist <= peg.radius && dist < bestDist) {
                bestDist = dist;
                bestPeg = peg;
            }
        });

        if (bestPeg) {
            state.score += bestPeg.points;
            state.hits += 1;
            flying.style.transition = 'transform 0.2s ease-out';
            flying.style.transform = `translate(-50%, -50%) translate(${bestPeg.x - state.launchPos.x}px, ${bestPeg.y - state.launchPos.y}px) scale(${Math.max(0.5, bestPeg.size / 140)})`;
            flying.classList.add('ring-hit');
            const pegEl = dom.pegLayer.children[state.pegsLayout.indexOf(bestPeg)];
            if (pegEl) {
                pegEl.classList.add('peg-hit');
                setTimeout(() => pegEl.classList.remove('peg-hit'), 500);
            }
        } else {
            flying.classList.add('ring-miss');
        }

        updateHUD();
        setTimeout(() => flying.remove(), 700);

        if (state.ringsLeft <= 0) {
            setTimeout(endRingToss, 500);
        } else {
            resetRingToy();
            state.busy = false;
        }
    }

    function endRingToss() {
        state.running = false;
        state.busy = false;

        dom.resultScore.textContent = state.score;
        dom.resultHits.textContent = `${state.hits} / ${CONFIG.TOTAL_RINGS}`;

        let rank, message;
        if (state.score >= 3000) { rank = '⭐⭐⭐'; message = 'リングマスター！'; }
        else if (state.score >= 1800) { rank = '⭐⭐'; message = 'すばらしい！'; }
        else if (state.score >= 800) { rank = '⭐'; message = 'よくできました！'; }
        else { rank = '💍'; message = 'もっと練習しよう！'; }

        dom.resultRank.textContent = rank;
        dom.resultMessage.textContent = message;

        showScreen('ringtoss-result-screen');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
