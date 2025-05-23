let container;

export function showQR(link) {
    container = document.getElementById('qrContainer');
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `
    <h2 class="text-center text-xl mb-2">Scanne &amp; chatte weiter</h2>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}" alt="QR Code" />
    <p class="text-center text-sm mt-1">${link}</p>
  `;
}

export function hideQR() {
    container = document.getElementById('qrContainer');
    if (!container) return;
    container.classList.add('hidden');
    container.innerHTML = '';
}
