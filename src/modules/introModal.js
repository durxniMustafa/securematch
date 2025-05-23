export function initIntroModal() {
    const modal = document.getElementById('gestureModal');
    if (!modal) return;

    const closeBtn = document.getElementById('gestureModalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    modal.style.display = 'flex';
}
