export const gestureConfig = {
    bufferMs: 700,
    lostTimeoutMs: 1000,
    smoothFactor: 0.3,
    minVis: 0.25,
    // thresholds
    pVel: 0.30,
    yVel: 0.25,
    pitchAmp: 0.10,
    yawAmp: 0.06,
    nodWindowMs: 600,
    shakeWindowMs: 700,
    guardYaw: 0.30,
    guardPitch: 0.30,
    refractoryMs: 1000,
    velHoldFrames: 3,
    MAX_VEL: 2.0,
    baselineBlendK: 0.02,
};
