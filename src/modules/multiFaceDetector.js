import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

let detector = null;

export async function loadDetector() {
    if (detector) return detector;
    const fileset = await FilesetResolver.forVisionTasks('/wasm');
    detector = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
            modelAssetPath: '/models/face_landmarker.task'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFacialTransformationMatrixes: true
    });
    return detector;
}

export function detectFaces(det, video) {
    const res = det.detectForVideo(video, Date.now());
    return res || { faceLandmarks: [], facialTransformationMatrixes: [] };
}
