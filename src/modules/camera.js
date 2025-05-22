export async function initCamera(width = 1280, height = 720) {
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width, height, facingMode: 'user' },
            audio: false,
        });
    } catch (err) {
        alert('Camera access denied or unavailable. Please enable the camera and reload.');
        throw err;
    }

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-block';
    wrap.style.opacity = '0';
    wrap.style.transition = 'opacity 1s';

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';

    video.srcObject = stream;
    const [videoTrack] = stream.getVideoTracks();
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
