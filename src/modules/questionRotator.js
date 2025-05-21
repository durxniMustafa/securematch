import { set, get } from '../store.js';
import { showQR, hideQR } from './qrGenerator.js';
import { stopVoteMeter } from './voteTally.js';

const questions = [
    "Is cybersecurity everyone's responsibility?",
    "Do you lock your laptop whenever you walk away?",
    "Would you nod to indicate 'yes' right now?",
];

let currentIndex = 0;
let timerHandle;

export function startQuestionCycle() {
    // Start the first question
    showQuestion(questions[currentIndex]);
}

function showQuestion(question) {
    set({
        mode: 'idle',
        question,
        deadline: Date.now() + 60_000,  // 60s
        tally: { yes: 0, no: 0 },
    });

    updateQuestionUI(question);
    startCountdown(60);
}

// Simple countdown in seconds
function startCountdown(seconds) {
    const clockEl = document.getElementById('clock');
    clockEl.classList.remove('hidden');

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
            clockEl.textContent = `Time Left: ${remaining}s`;
        }
    }, 250);
}

function freezeUI() {
    // Hide countdown
    const clockEl = document.getElementById('clock');
    clockEl.classList.add('hidden');
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
    qEl.textContent = q;
    qEl.classList.remove('hidden');
}
