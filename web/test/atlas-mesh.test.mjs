import test from "node:test";
import assert from "node:assert/strict";
import { ATLAS_TILES, createAtlasPixels, getTileUv } from "../atlas.mjs";
import { CUBE_FACE_NORMALS, VERTEX_FLOATS, createVoxelMesh } from "../mesh.mjs";

function position(vertices,index){ const offset=index*VERTEX_FLOATS; return [vertices[offset],vertices[offset+1],vertices[offset+2]]; }
function subtract(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
function cross(a,b){ return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }

test("atlas tiles use inset non-overlapping coordinates",()=>{
    const grass=getTileUv(ATLAS_TILES.grass), rock=getTileUv(ATLAS_TILES.rock);
    assert.ok(grass.u0>0&&grass.u1<0.5); assert.ok(rock.u0>0.5&&rock.u1<1);
    assert.equal(grass.v0,rock.v0); assert.equal(grass.v1,rock.v1);
});

test("original atlas contains opaque distinct tiles",()=>{
    const pixels=createAtlasPixels();
    assert.equal(pixels.length,32*16*4); assert.equal(pixels[3],255); assert.equal(pixels[16*4+3],255);
    assert.notDeepEqual([...pixels.slice(0,3)],[...pixels.slice(16*4,16*4+3)]);
});

test("one cube produces 24 vertices and 36 valid indices",()=>{
    const mesh=createVoxelMesh([{x:0,y:0,z:0,tileIndex:ATLAS_TILES.grass}]);
    assert.equal(mesh.vertexCount,24); assert.equal(mesh.indexCount,36);
    assert.ok([...mesh.indices].every(index=>index>=0&&index<mesh.vertexCount));
});

test("all cube faces have counter-clockwise outward winding",()=>{
    const mesh=createVoxelMesh([{x:0,y:0,z:0,tileIndex:ATLAS_TILES.grass}]);
    for(let face=0;face<6;face+=1){
        const offset=face*6;
        const a=position(mesh.vertices,mesh.indices[offset]), b=position(mesh.vertices,mesh.indices[offset+1]), c=position(mesh.vertices,mesh.indices[offset+2]);
        assert.ok(dot(cross(subtract(b,a),subtract(c,a)),CUBE_FACE_NORMALS[face])>0);
    }
});

test("two cubes are aggregated into one reusable mesh",()=>{
    const mesh=createVoxelMesh([{x:-1.2,y:0,z:0,tileIndex:ATLAS_TILES.grass},{x:0.2,y:0,z:0,tileIndex:ATLAS_TILES.rock}]);
    assert.equal(mesh.vertexCount,48); assert.equal(mesh.indexCount,72); assert.ok(mesh.indices instanceof Uint16Array);
});
