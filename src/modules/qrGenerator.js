let container;

export function showQR(link) {
    container = document.getElementById('qrContainer');
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `
    <p class="text-center">Scan to discuss further:</p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}" alt="QR Code" />
  `;
}

export function hideQR() {
    container = document.getElementById('qrContainer');
    if (!container) return;
    container.classList.add('hidden');
    container.innerHTML = '';
}
