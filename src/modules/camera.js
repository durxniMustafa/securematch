export async function initCamera(width = 1280, height = 720) {
    const wrap = document.createElement('div');
    wrap.className = 'camera-wrap';
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-block';
    wrap.style.opacity = '0';
    wrap.style.transition = 'opacity 1s ease-in-out';

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';

    let stream;
    let videoTrack;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width, height, facingMode: 'user' },
            audio: false,
        });
        video.srcObject = stream;
        [videoTrack] = stream.getVideoTracks();
    } catch (err) {
        console.error('Error accessing camera:', err);
        const toastEl = document.getElementById('toast');
        if (toastEl) {
            toastEl.textContent = 'Demo mode: using sample video.';
            toastEl.style.display = 'block';
            setTimeout(() => { toastEl.style.display = 'none'; }, 3000);
        } else {
            alert('Camera unavailable. Demo mode enabled.');
        }
        video.src = '/sample.mp4';
        video.loop = true;
    }

    await video.play();

    // fade video in when first frame arrives
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        video.requestVideoFrameCallback(() => { wrap.style.opacity = 1; });
    } else {
        setTimeout(() => { wrap.style.opacity = 1; }, 500);
    }

    wrap.append(video, canvas);
    document.body.append(wrap);

    return { video, canvas, videoTrack };
}
