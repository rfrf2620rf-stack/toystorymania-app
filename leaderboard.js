/* ==============================
   Toy Story Mania! - Leaderboard Module
   Uses Firebase Firestore for real-time ranking
   ============================== */

window.Leaderboard = (function() {
    'use strict';

    // ===== FIREBASE CONFIG =====
    // TODO: Replace with your actual Firebase project configuration
    // 1. Go to https://console.firebase.google.com/
    // 2. Create a project
    // 3. Add a web app
    // 4. Copy the config object below
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    let db = null;
    let enabled = false;

    // ===== INIT =====
    function init() {
        if (firebaseConfig.apiKey === "YOUR_API_KEY") {
            console.warn("Firebase config is missing. Leaderboard will be disabled.");
            return;
        }

        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            enabled = true;
            console.log("Firebase initialized");
        } catch (e) {
            console.error("Firebase init failed:", e);
            enabled = false;
        }
    }

    // ===== API =====
    async function saveScore(name, score) {
        if (!enabled) {
            // Local fallback
            saveLocal(name, score);
            return;
        }

        try {
            await db.collection("scores").add({
                name: name,
                score: score,
                date: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Score saved to Firestore");
        } catch (e) {
            console.error("Error adding document: ", e);
            saveLocal(name, score);
        }
    }

    async function getTopScores(limit = 10) {
        if (!enabled) {
            return getLocalTopScores(limit);
        }

        try {
            const q = db.collection("scores")
                .orderBy("score", "desc")
                .limit(limit);
            
            const querySnapshot = await q.get();
            const scores = [];
            querySnapshot.forEach((doc) => {
                scores.push(doc.data());
            });
            return scores;
        } catch (e) {
            console.error("Error getting documents: ", e);
            return getLocalTopScores(limit);
        }
    }

    // ===== LOCAL FALLBACK =====
    function saveLocal(name, score) {
        const scores = getLocalTopScores(100);
        scores.push({ name, score, date: new Date().toISOString() });
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem('toystory_mania_scores', JSON.stringify(scores.slice(0, 50)));
    }

    function getLocalTopScores(limit) {
        const str = localStorage.getItem('toystory_mania_scores');
        const scores = str ? JSON.parse(str) : [];
        return scores.slice(0, limit);
    }

    return {
        init,
        saveScore,
        getTopScores
    };
})();
