export async function initCamera(width = 640, height = 480) {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width, height, facingMode: 'user' },
        audio: false,
    });

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
    await video.play();

    // fade video in
    setTimeout(() => { wrap.style.opacity = 1; }, 500);

    wrap.append(video, canvas);
    document.body.append(wrap);

    return { video, canvas };
}
