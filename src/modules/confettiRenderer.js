let confettiActive = false;
let confettiInterval;

export function startConfetti() {
    if (confettiActive) return;
    confettiActive = true;

    confettiInterval = setInterval(() => {
        const confetto = document.createElement('div');
        confetto.textContent = '🎉';
        confetto.style.position = 'fixed';
        confetto.style.left = Math.random() * 100 + '%';
        confetto.style.top = '-5%';
        confetto.style.fontSize = '2rem';
        confetto.style.opacity = '0.9';
        document.body.appendChild(confetto);

        // animate down
        let y = 0;
        const fall = setInterval(() => {
            y += 2;
            confetto.style.top = y + '%';
            if (y > 110) {
                clearInterval(fall);
                confetto.remove();
            }
        }, 50);
    }, 200);
}

export function stopConfetti() {
    confettiActive = false;
    clearInterval(confettiInterval);
}
