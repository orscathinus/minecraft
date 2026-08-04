export function perspectiveMatrix(fieldOfViewRadians, aspect, near, far) {
    if (![fieldOfViewRadians, aspect, near, far].every(Number.isFinite)) throw new TypeError("Perspective values must be finite");
    if (fieldOfViewRadians <= 0 || fieldOfViewRadians >= Math.PI) throw new RangeError("fieldOfViewRadians must be between 0 and PI");
    if (aspect <= 0 || near <= 0 || far <= near) throw new RangeError("Invalid perspective clipping values");
    const f = 1 / Math.tan(fieldOfViewRadians / 2);
    const inverseDepth = 1 / (near - far);
    const result = new Float32Array(16);
    result[0] = f / aspect;
    result[5] = f;
    result[10] = (far + near) * inverseDepth;
    result[11] = -1;
    result[14] = 2 * far * near * inverseDepth;
    return result;
}

export function lookAtMatrix(eye, center, up = [0, 1, 0]) {
    validateVector(eye, "eye"); validateVector(center, "center"); validateVector(up, "up");
    const forward = normalize([center[0]-eye[0], center[1]-eye[1], center[2]-eye[2]]);
    const side = normalize(cross(forward, up));
    const correctedUp = cross(side, forward);
    const result = new Float32Array(16);
    result[0]=side[0]; result[1]=correctedUp[0]; result[2]=-forward[0];
    result[4]=side[1]; result[5]=correctedUp[1]; result[6]=-forward[1];
    result[8]=side[2]; result[9]=correctedUp[2]; result[10]=-forward[2];
    result[12]=-dot(side,eye); result[13]=-dot(correctedUp,eye); result[14]=dot(forward,eye); result[15]=1;
    return result;
}
export function addVectors(a,b){ return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; }
export function scaleVector(v,s){ return [v[0]*s,v[1]*s,v[2]*s]; }
export function normalize(v){ const length=Math.hypot(v[0],v[1],v[2]); if(!(length>0)) throw new RangeError("Cannot normalize a zero-length vector"); return [v[0]/length,v[1]/length,v[2]/length]; }
export function cross(a,b){ return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
export function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function validateVector(v,name){ if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)) throw new TypeError(`${name} must contain three finite numbers`); }
