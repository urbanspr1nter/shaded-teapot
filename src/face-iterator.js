/**
 * face-iterator.js
 * 
 * @fileoverview A simple utility that will take a raw text file
 * representing a WaveFront obj file, and parse it into a data structure
 * that returns an interator of vertices.
 * 
 * Limitations:
 *  - Right now it only accepts an obj containing simple list of v, and f 
 *    elements.
 *  - Comments beginning with # are skipped
 *  - Groups are also not supported
 * 
 * @author Roger Ngo
 * rngo2@illinois.edu
 * 
 * March, 2020
 */

 /**
  * Creates a FaceIterator object given the raw OBJ text, and a
  * provided logger instance.
  * @param {string} rawObject 
  * @param {Logger} logger 
  * @returns {FaceIterator}
  */
function createFaceIterator(rawObject, logger) {
    if (!logger)
        logger = console;

    if (!glMatrix) {
        logger.error('You do not have glMatrix included!');
        return;
    }

    const vertices = [];
    const faces = [];

    const lines = rawObject.split('\n');
    
    for(let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if(line.indexOf('#') === 0 || line.indexOf('g') == 0) {
            logger.log('Skipping line', line);
            continue;
        }

        if(line.indexOf('v') === 0) {
            const vertexArray = line
                .replace('v', '')
                .trim()
                .split(' ')
                .map(f => Number(f));

            vertices.push(vertexArray);
        } else if(line.indexOf('f') === 0) {
            const faceIndexArray = line
                .replace('f', '')
                .trim().split(' ')
                .map(i => Math.trunc(i));

            faces.push(faceIndexArray);
        }
    }

    return new FaceIterator(faces, vertices, logger);
}

/**
 * Constructor for the FaceIterator object.
 * @param {number[]} faceArray 
 * @param {number[]} vertices 
 * @param {Logger} logger 
 */
function FaceIterator(faceArray, vertices, logger) {
    if (!glMatrix) {
        console.error('You do not have glMatrix included!');
        return;
    }

    this.logger = logger || console;
    this.faces = faceArray;
    this.vertices = vertices;
    this.faceIndex = 0;
}

/**
 * Restarts the iterator with resetting the index pointer
 * back to 0.
 */
FaceIterator.prototype.restart = function() {
    this.faceIndex = 0;
}

/**
 * Gets the total number of vertices in the obj.
 */
FaceIterator.prototype.totalVertices = function() {
    return this.vertices.length;
}

/**
 * Gets a vertex at an index in the obj.
 */
FaceIterator.prototype.getVertex = function(index) {
    return this.vertices[index - 1];
}

/**
 * Detects whether there is a triangle to consume
 */
FaceIterator.prototype.hasNext = function() {
    if (this.faceIndex === this.faces.length)
        return false;

    return true;
}

/**
 * Returns a simple data structure representing a triangle face.
 * {
 *  v1: first vertex,
 *  v2: second vertex,
 *  v3: third vertex,
 *  indices: object which contains a mapping of the vertex to its
*            index within the obj file.
 * }
 */
FaceIterator.prototype.next = function() {
    const indices = this.faces[this.faceIndex];

    const result = {
        v1: glMatrix.vec3.fromValues(...this.getVertex(indices[0])),
        v2: glMatrix.vec3.fromValues(...this.getVertex(indices[1])),
        v3: glMatrix.vec3.fromValues(...this.getVertex(indices[2])),
        indices: {
            v1: indices[0],
            v2: indices[1],
            v3: indices[2]
        }
    };

    this.faceIndex++;

    return result;
}
