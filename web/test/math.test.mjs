import test from "node:test";
import assert from "node:assert/strict";
import { lookAtMatrix, perspectiveMatrix } from "../math.mjs";

test("wider aspect ratios reduce horizontal projection scale",()=>{
    const square=perspectiveMatrix(Math.PI/3,1,0.05,256);
    const wide=perspectiveMatrix(Math.PI/3,16/9,0.05,256);
    assert.ok(wide[0]<square[0]); assert.equal(wide[5],square[5]); assert.equal(wide[11],-1);
});

test("look-at matrix for a camera at positive Z faces the origin",()=>{
    const view=lookAtMatrix([0,0,5],[0,0,0]);
    assert.ok(Math.abs(view[12])<1e-7); assert.ok(Math.abs(view[13])<1e-7);
    assert.equal(view[14],-5); assert.equal(view[15],1);
});
