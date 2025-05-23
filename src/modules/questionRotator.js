import { set, get } from '../store.js';
import { showQR, hideQR } from './qrGenerator.js';
import { stopVoteMeter } from './voteTally.js';

const QUESTION_TIME_MS = 60_000;  // 1 minute per question
const QR_TIME_MS = 60_000;        // 1 minute for the QR screen

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
        deadline: Date.now() + QUESTION_TIME_MS,
        tally: { yes: 0, no: 0 },
    });

    updateQuestionUI(question);
    startCountdown(QUESTION_TIME_MS / 1000, showQrPhase, true);
}

// Simple countdown in seconds
function startCountdown(seconds, onDone, showRing = true) {
    const clockEl = document.getElementById('clock');
    const ring = document.getElementById('timerRing');
    clockEl.classList.remove('hidden');
    if (ring) {
        ring.style.animation = 'none';
        // force reflow
        ring.getBoundingClientRect();
        if (showRing) {
            ring.style.animation = `countdown ${seconds}s linear forwards`;
        }
    }

    clearInterval(timerHandle);
    timerHandle = setInterval(() => {
        const remaining = Math.floor((get().deadline - Date.now()) / 1000);
        if (remaining <= 0) {
            clearInterval(timerHandle);
            if (typeof onDone === 'function') onDone();
        } else {
            clockEl.textContent = `${remaining}s`;
        }
    }, 250);
}

function showQrPhase() {
    set({ mode: 'qr', deadline: Date.now() + QR_TIME_MS });
    freezeUI();
    startCountdown(QR_TIME_MS / 1000, nextQuestion, false);
}

function freezeUI() {
    // Hide question card and timer ring
    const ring = document.getElementById('timerRing');
    if (ring) ring.style.animation = 'none';
    const card = document.getElementById('questionCard');
    if (card) card.classList.add('hidden');

    // Show QR and countdown text
    const clockEl = document.getElementById('clock');
    clockEl.classList.remove('hidden');
    showQR('https://example.com/discussion');
    // Optionally stop vote meter etc.
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
