import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let handDetector = null;

export async function loadHandDetector() {
    if (handDetector) return handDetector;
    const fileset = await FilesetResolver.forVisionTasks('/wasm');
    handDetector = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
            modelAssetPath: '/models/hand_landmarker.task',
        },
        runningMode: 'VIDEO',
        numHands: 2
    });
    return handDetector;
}

export function detectHands(det, video) {
    const res = det.detectForVideo(video, Date.now());
    return (res && res.handLandmarks) ? res.handLandmarks : [];
}
