const RAD2DEG = 180 / Math.PI;

export function matrixToEuler(matrix) {
    const m = matrix.data || matrix;
    const r00 = m[0], r01 = m[4], r02 = m[8];
    const r10 = m[1], r11 = m[5], r12 = m[9];
    const r20 = m[2], r21 = m[6], r22 = m[10];

    const sy = Math.sqrt(r00 * r00 + r10 * r10);
    const singular = sy < 1e-6;
    let x, y, z;
    if (!singular) {
        x = Math.atan2(r21, r22);      // pitch
        y = Math.atan2(-r20, sy);      // yaw
        z = Math.atan2(r10, r00);      // roll
    } else {
        x = Math.atan2(-r12, r11);
        y = Math.atan2(-r20, sy);
        z = 0;
    }
    return { yaw: y * RAD2DEG, pitch: x * RAD2DEG, roll: z * RAD2DEG };
}
