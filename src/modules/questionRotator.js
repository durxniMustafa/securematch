import { set, get } from '../store.js';
import { showQR, hideQR } from './qrGenerator.js';
import { stopVoteMeter } from './voteTally.js';

let questions = [];

let currentIndex = 0;
let timerHandle;

export async function startQuestionCycle() {
    try {
        const res = await fetch('questions.json');
        questions = await res.json();
    } catch (err) {
        console.error('Failed to load questions.json', err);
        questions = [
            "Is cybersecurity everyone's responsibility?",
            "Do you lock your laptop whenever you walk away?",
            "Would you nod to indicate 'yes' right now?",
        ];
    }

    if (!questions.length) return;
    // Start the first question
    showQuestion(questions[currentIndex]);
}

function showQuestion(question) {
    set({
        mode: 'idle',
        question,
        deadline: Date.now() + 8_000,
        tally: { yes: 0, no: 0 },
    });

    updateQuestionUI(question);
    startCountdown(8);
}

// Simple countdown in seconds
function startCountdown(seconds) {
    const clockEl = document.getElementById('clock');
    const ring = document.getElementById('timerRing');
    clockEl.classList.remove('hidden');
    if (ring) {
        ring.style.animation = 'none';
        // force reflow
        ring.getBoundingClientRect();
        ring.style.animation = `countdown ${seconds}s linear forwards`;
    }

    clearInterval(timerHandle);
    timerHandle = setInterval(() => {
        const remaining = Math.floor((get().deadline - Date.now()) / 1000);
        if (remaining <= 0) {
            clearInterval(timerHandle);
            // time’s up → show QR, freeze bars
            set({ mode: 'qr' });
            freezeUI();
            // after some time, load next question
            setTimeout(nextQuestion, 5000);
        } else {
            clockEl.textContent = `${remaining}s`;
        }
    }, 250);
}

function freezeUI() {
    // Hide countdown
    const clockEl = document.getElementById('clock');
    clockEl.classList.add('hidden');
    const card = document.getElementById('questionCard');
    if (card) card.classList.add('hidden');
    // Show QR code
    showQR('https://example.com/discussion');  // or some dynamic link
    // Possibly stop vote meter or freeze it
    // In this example, let's keep it displayed but not destroyed
    // If you wanted to hide it, you could do:
    // stopVoteMeter();
}

function nextQuestion() {
    hideQR();
    // cycle to next question
    currentIndex = (currentIndex + 1) % questions.length;
    showQuestion(questions[currentIndex]);
}

function updateQuestionUI(q) {
    const qEl = document.getElementById('q');
    const card = document.getElementById('questionCard');
    qEl.textContent = q;
    qEl.classList.remove('hidden');
    if (card) card.classList.remove('hidden');
}
