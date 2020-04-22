/**
 * mp3.js
 * 
 * @fileoverview A teapot rendered within a Skybox using WebGL
 * @author Roger Ngo
 * rngo2@illinois.edu
 * 
 * March, 2020
 */

/**
 * Constant Definitions
 */
const ModelType = {
    TEAPOT: 'teapot',
    CUBE: 'cube'
};
const Direction = {
    POSITIVE: 'positive',
    NEGATIVE: 'negative',
    NONE: 'none'
};
const Axis = {
    X: 'x',
    Y: 'y',
    Z: 'z',
    NONE: 'none'
};
const ShadingModel = {
    PHONG: 'phong',
    REFLECTIVE: 'reflective',
    REFRACTIVE: 'refractive'
};

/**
 * The AppState is basically a JS object holding random variables and 
 * state so that we can make our life easier in terms of moving things 
 * around in the screen, making references to the shaders, and controlling
 * UI.
 */
const AppState = {
    images: {
        directory: './Sweden'
    },
    shadingModel: ShadingModel.PHONG,
    canvas: null,
    screenSize: {
        width: 1280,
        height: 720
    },
    models: {
        cube: {
            type: ModelType.CUBE,
            positions: [],
            normals: [],
            texture: null
        },
        teapot: {
            location: './assets/teapot_0.obj',
            type: ModelType.TEAPOT,
            positions: [],
            normals: [],
            texture: null
        }
    },
    programs: {
        cube: {
            program:  null,
            vars: {},
            images: {
                negX: 'neg-x',
                negY: 'neg-y',
                negZ: 'neg-z',
                posX: 'pos-x',
                posY: 'pos-y',
                posZ: 'pos-z'
            }
        },
        teapot: {
            program: null,
            vars: {},
            pointLight: glMatrix.vec4.fromValues(1, 1, 1, 0),
            flags: {
                stopAnimation: false,
                rotate: {
                    axis: Axis.NONE,
                    x: 0,
                    y: 0,
                    delta: 0
                }
            },
            scale: 0.2,
            translate: -0.2
        },
        teapotReflective: {
            program: null,
            vars: {}
        },
        teapotRefractive: {
            program: null,
            vars: {}
        },
        global: {
            viewMatrix: glMatrix.mat4.create(),
            worldMatrix: glMatrix.mat4.create(),
            projectionMatrix: glMatrix.mat4.create(),
            eyePoint: glMatrix.vec3.fromValues(0, 0, 2),
            flags: {
                stopAnimation: false,
                rotate: {
                    direction: Direction.NONE,
                    x: 0,
                    y: 0
                }
            }
        }
    }
};

const Shaders = {
    CubeModel: {
        vertex: `
attribute vec4 a_position;

varying vec4 v_position;

void main() {
    v_position = a_position;
    gl_Position = a_position;
    gl_Position.z = 1.0;
    gl_Position.w = 1.0;
}
`,
        fragment: `
precision highp float;

uniform samplerCube u_skybox;
uniform mat4 u_viewDirectionProjectionInverse;

varying vec4 v_position;

void main() {
    vec4 t = u_viewDirectionProjectionInverse * v_position;
    gl_FragColor = textureCube(u_skybox, normalize(t.xyz / t.w));
}
        `
    },
    TeapotModel: {
        vertex: `
// The attributes
attribute vec4 a_position;
attribute vec4 a_normal;

// The world matrix
uniform mat4 u_world;

// The perspective projection matrix
uniform mat4 u_projection;

// The camera matrix
uniform mat4 u_view;

uniform mat4 u_normalMat;

varying vec4 v_worldPosition;
varying vec4 v_worldNormal;
varying vec4 v_color;

void main() {
    gl_Position = u_projection * u_view * u_world * a_position;

    // To pass to the fragment
    v_worldNormal = u_normalMat * a_normal;
    v_worldPosition = u_normalMat * a_position;

    // Light Position
    vec4 lightPos = vec4(1.0, 1.0, 1.0, 1.0);

    // Ambient Color
    vec4 ambientColor = vec4(0.3, 0.0, 0.0, 1.0);

    // Diffuse Color
    vec4 diffuseColor = vec4(0.72, 0.1, 0.1, 1.0);

    // Specular Color
    vec4 specColor = vec4(0.3, 0.3, 0.3, 1.0);

    vec4 lightDirection = normalize(lightPos - a_normal);
    vec4 reflectDirection = reflect(lightDirection, v_worldNormal);
    vec4 viewDirection = normalize(-a_position);

    float lambertian = max(dot(lightDirection, v_worldNormal), 0.0);
    float specular = 0.0;

    if(lambertian > 0.0) {
        float specAngle = max(dot(reflectDirection, viewDirection), 0.0);
        specular = pow(specAngle, 3.3);
    }

    // Ambient
    //v_color = vec4(ambientColor);
    
    // Diffuse
    // v_color = vec4(lambertian*diffuseColor);
    
    // Specular
    //v_color = vec4(specular*specColor);

    // Phong
    v_color = vec4(ambientColor + lambertian*diffuseColor + specular*specColor);
}
`,
        fragment: `
precision highp float;

// The position of the camera
uniform vec4 u_worldCameraPosition;

varying vec4 v_color;

void main() {
    gl_FragColor = v_color;
}
`
    },
    TeapotReflectionModel: {
        vertex: `
attribute vec4 a_position;
attribute vec4 a_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform mat4 u_normalMat;

varying vec4 v_worldPosition;
varying vec4 v_worldNormal;

void main() {
    // Multiply the position by the matrix.
    gl_Position = u_projection * u_view * u_world * a_position;

    // Send the view position to the fragment shader
    v_worldPosition = u_world * a_position;

    // Orient the normals and pass to the fragment shader
    v_worldNormal = u_world * a_normal;
}
`,
        fragment: `
precision highp float;

// Passed in from the vertex shader.
varying vec4 v_worldPosition;
varying vec4 v_worldNormal;

// The texture.
uniform samplerCube u_texture;

// The position of the camera
uniform vec4 u_worldCameraPosition;

void main() {
    vec4 worldNormal = normalize(v_worldNormal);
    vec4 eyeToSurfaceDir = normalize(v_worldPosition - u_worldCameraPosition);
    vec4 direction = reflect(eyeToSurfaceDir, v_worldNormal);

    gl_FragColor = textureCube(u_texture, direction.xyz);
}        
`
    },
    TeapotRefractionModel: {
        vertex: `
attribute vec4 a_position;
attribute vec4 a_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform mat4 u_normalMat;

varying vec4 v_worldPosition;
varying vec4 v_worldNormal;

void main() {
    // Multiply the position by the matrix.
    gl_Position = u_projection * u_view * u_world * a_position;

    // Send the view position to the fragment shader
    v_worldPosition = u_world * a_position;

    // Orient the normals and pass to the fragment shader
    v_worldNormal = u_world * a_normal;
}
        `,
        fragment: `
precision highp float;

// Passed in from the vertex shader.
varying vec4 v_worldPosition;
varying vec4 v_worldNormal;

// The texture.
uniform samplerCube u_texture;

// The position of the camera
uniform vec4 u_worldCameraPosition;

void main() {
    vec4 worldNormal = normalize(v_worldNormal);
    vec4 eyeToSurfaceDir = normalize(v_worldPosition - u_worldCameraPosition);
    vec4 direction = refract(eyeToSurfaceDir, v_worldNormal, 0.65);

    gl_FragColor = textureCube(u_texture, direction.xyz);
}
        `
    }
};

// Global variables
var gl;
var glCompiler;
var logger = new Logger();

main();

/**
 * Main function - the entry point to the app.
 */
function main() {
    window.logger = logger;

    fetch(`${AppState.models.teapot.location}`)
    .then(response => {
        if (response.status !== 200) {
            throw new Error('Bad request while retrieving object file.');
        }
        logger.log(`${response.status}, Received response from the server at ${AppState.models.teapot.location}.`);
        return response.text()
    })
    .then(t => { 
        gl = buildGlContext(AppState);
        glCompiler = new GlCompiler(gl, logger);

        buildPrograms(t, render);
    })
    .catch(e => {
        logger.error(e, e);
    });
}

/**
 * Renders a frame of the scene
 * @param {number} time 
 */
function render(time) {
    time *= 0.001;

    ///////////////////////////////////////////////////////////////////////////
    // Teapot
    ///////////////////////////////////////////////////////////////////////////
    
    gl.depthFunc(gl.LESS);

    // Use the teapot program for the corresponding active shading
    useTeapotProgram();

    const teapotVars = teapotRef();

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(AppState.models.teapot.positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(teapotVars.vars.a_position);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(teapotVars.vars.a_position, 3, gl.FLOAT, false, 0, 0);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(AppState.models.teapot.normals), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(teapotVars.vars.a_normal);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

    gl.vertexAttribPointer(teapotVars.vars.a_normal, 3, gl.FLOAT, false, 0, 0);

    // Set the matrices relevant to the teapot.
    setTeapotMatrices(time);

    // Render the teapot
    gl.drawArrays(gl.TRIANGLES, 0, AppState.models.teapot.positions.length / 3);

    ///////////////////////////////////////////////////////////////////////////
    // Skybox
    ///////////////////////////////////////////////////////////////////////////

    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(AppState.programs.cube.program);

    // Set the position buffer 
    const sbPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sbPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(AppState.models.cube.positions), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(AppState.programs.cube.vars.a_position);
    gl.bindBuffer(gl.ARRAY_BUFFER, sbPositionBuffer);

    // Set for 2 components at a time for the quad
    gl.vertexAttribPointer(AppState.programs.cube.vars.a_position, 2, gl.FLOAT, false, 0, 0);

    setSkyboxMatrices();

    gl.uniform1i(AppState.programs.cube.vars.u_skybox, 0);

    // Render the skybox
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

/**
 * Sets the matrices for the Skybox
 */
function setSkyboxMatrices() {
    const viewMatrix = glMatrix.mat4.create();
    glMatrix.mat4.copy(viewMatrix, AppState.programs.global.viewMatrix);

    viewMatrix[12] = 0;
    viewMatrix[13] = 0;
    viewMatrix[14] = 0;

    const viewDirectionProjectMatrix = glMatrix.mat4.create();
    glMatrix.mat4.multiply(viewDirectionProjectMatrix, AppState.programs.global.projectionMatrix, viewMatrix);
    glMatrix.mat4.invert(viewDirectionProjectMatrix, viewDirectionProjectMatrix);
    gl.uniformMatrix4fv(AppState.programs.cube.vars.u_viewDirectionProjectionInverse, false, viewDirectionProjectMatrix);
}

/**
 * Sets the matrices for the teapot to be rendered into the scene
 * @param {number} time 
 */
function setTeapotMatrices(time) {
    const teapotVars = teapotRef();

    // Perspective matrix
    glMatrix.mat4.perspective(
        AppState.programs.global.projectionMatrix,
        Math.PI / 4,
        AppState.screenSize.width / AppState.screenSize.height,
        1.0,
        2000.0
    );

    gl.uniformMatrix4fv(teapotVars.vars.u_projection, false, AppState.programs.global.projectionMatrix);

    // Set the view matrix
    AppState.programs.global.viewMatrix = glMatrix.mat4.create();   
    const viewPoint = glMatrix.vec3.fromValues(0, 0, 0);
    const upVector = glMatrix.vec3.fromValues(0, 1, 0); 
    glMatrix.mat4.targetTo(AppState.programs.global.viewMatrix, AppState.programs.global.eyePoint, viewPoint, upVector);
    glMatrix.mat4.invert(AppState.programs.global.viewMatrix, AppState.programs.global.viewMatrix);

    gl.uniformMatrix4fv(teapotVars.vars.u_view, false, AppState.programs.global.viewMatrix);

    // World matrix
    // Set the rotation of the teapot based on the current rotation
    AppState.programs.global.worldMatrix = glMatrix.mat4.create();
    glMatrix.mat4.rotateX(
        AppState.programs.global.worldMatrix,
        AppState.programs.global.worldMatrix,
        glMatrix.glMatrix.toRadian(AppState.programs.teapot.flags.rotate.x)
    );
    glMatrix.mat4.rotateY(
        AppState.programs.global.worldMatrix,
        AppState.programs.global.worldMatrix,
        glMatrix.glMatrix.toRadian(AppState.programs.teapot.flags.rotate.y)
    );

    gl.uniformMatrix4fv(teapotVars.vars.u_world, false, AppState.programs.global.worldMatrix);

    // Update Normals
    updateNormals();

     // Set the camera position, or the light point depending on the shading model we have decided to use
     // for the teapot.
    if (AppState.shadingModel === ShadingModel.REFLECTIVE || AppState.shadingModel === ShadingModel.REFRACTIVE) {
        gl.uniform1i(teapotVars.vars.u_texture, 0);
        gl.uniform4fv(teapotVars.vars.u_worldCameraPosition, [...AppState.programs.global.eyePoint, 1.0]);
    } else {
        // Point Light
        const pointLight = glMatrix.vec4.create();
        glMatrix.vec3.normalize(pointLight, AppState.programs.teapot.pointLight)
        gl.uniform4fv(teapotVars.vars.u_lightWorldPosition, pointLight);
    }
}

/**
 * Build both the teapot, and skybox shader programs.
 * 
 * This function will then call the rendering callback method once it is done with
 * setup and initialization.
 * @param {string} rawObject 
 * @param {function} renderCallback callback function to render the scene 
 */
function buildPrograms(rawObject, renderCallback) {
    buildTeapotRefractiveProgram(rawObject);
    buildTeapotReflectiveProgram(rawObject);
    buildTeapotProgram(rawObject);
    buildSkyboxProgram(renderCallback);

    function buildTeapotRefractiveProgram(rawObject) {
        // Build the program
        const teapotRefractiveVertexShader = glCompiler.createShader(gl.VERTEX_SHADER, Shaders.TeapotRefractionModel.vertex);
        const teapotRefractiveFragmentShader = glCompiler.createShader(gl.FRAGMENT_SHADER, Shaders.TeapotRefractionModel.fragment);
        const teapotRefractiveProgram = glCompiler.createProgram(teapotRefractiveVertexShader, teapotRefractiveFragmentShader);

        // Use the program we have compiled
        gl.useProgram(teapotRefractiveProgram);
        AppState.programs.teapotRefractive.program = teapotRefractiveProgram;

        buildPositions(rawObject);
        buildPerVertexNormals(rawObject);

        // The reference addresses to attributes, uniforms, and varyings within the compiled shaders
        AppState.programs.teapotRefractive.vars = {
            u_texture: gl.getUniformLocation(teapotRefractiveProgram, 'u_texture'),
            u_worldCameraPosition: gl.getUniformLocation(teapotRefractiveProgram, 'u_worldCameraPosition'),
            u_normalMat: gl.getUniformLocation(teapotRefractiveProgram, 'u_normalMat'),
            a_position: gl.getAttribLocation(teapotRefractiveProgram, 'a_position'),
            a_normal: gl.getAttribLocation(teapotRefractiveProgram, 'a_normal'),
            u_projection: gl.getUniformLocation(teapotRefractiveProgram, 'u_projection'),
            u_view: gl.getUniformLocation(teapotRefractiveProgram, 'u_view'),
            u_world: gl.getUniformLocation(teapotRefractiveProgram, 'u_world')
        };

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

        loadCubeImages(gl, texture, () => {
            //gl.uniform1i(AppState.programs.teapotReflective.vars.u_texture, texture);
            renderCallback();
        });
    }

    function buildTeapotReflectiveProgram(rawObject) {
        // Build the program
        const teapotReflectiveVertexShader = glCompiler.createShader(gl.VERTEX_SHADER, Shaders.TeapotReflectionModel.vertex);
        const teapotReflectiveFragmentShader = glCompiler.createShader(gl.FRAGMENT_SHADER, Shaders.TeapotReflectionModel.fragment);
        const teapotReflectiveProgram = glCompiler.createProgram(teapotReflectiveVertexShader, teapotReflectiveFragmentShader);

        // Use the program we have compiled
        gl.useProgram(teapotReflectiveProgram);
        AppState.programs.teapotReflective.program = teapotReflectiveProgram;

        buildPositions(rawObject);
        buildPerVertexNormals(rawObject);

        // The reference addresses to attributes, uniforms, and varyings within the compiled shaders
        AppState.programs.teapotReflective.vars = {
            u_texture: gl.getUniformLocation(teapotReflectiveProgram, 'u_texture'),
            u_worldCameraPosition: gl.getUniformLocation(teapotReflectiveProgram, 'u_worldCameraPosition'),
            u_normalMat: gl.getUniformLocation(teapotReflectiveProgram, 'u_normalMat'),
            a_position: gl.getAttribLocation(teapotReflectiveProgram, 'a_position'),
            a_normal: gl.getAttribLocation(teapotReflectiveProgram, 'a_normal'),
            u_projection: gl.getUniformLocation(teapotReflectiveProgram, 'u_projection'),
            u_view: gl.getUniformLocation(teapotReflectiveProgram, 'u_view'),
            u_world: gl.getUniformLocation(teapotReflectiveProgram, 'u_world')
        };

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

        loadCubeImages(gl, texture, () => {
            //gl.uniform1i(AppState.programs.teapotReflective.vars.u_texture, texture);
            renderCallback();
        });
    }

    function buildTeapotProgram(rawObject) {
        // Build the program
        const teapotVertexShader = glCompiler.createShader(gl.VERTEX_SHADER, Shaders.TeapotModel.vertex);
        const teapotFragmentShader = glCompiler.createShader(gl.FRAGMENT_SHADER, Shaders.TeapotModel.fragment);
        const teapotProgram = glCompiler.createProgram(teapotVertexShader, teapotFragmentShader);
    
        // Use program we have compiled.
        gl.useProgram(teapotProgram);
        AppState.programs.teapot.program = teapotProgram;
    
        // Compute all the positions, and normals offline to be sent to the
        // attributes in the GPU.
        buildPositions(rawObject);
        buildPerVertexNormals(rawObject);
    
        // The reference addresses to attributes, uniforms, and varyings within the compiled shaders
        AppState.programs.teapot.vars = {
            a_position: gl.getAttribLocation(teapotProgram, 'a_position'),
            a_normal: gl.getAttribLocation(teapotProgram, 'a_normal'),
            u_world: gl.getUniformLocation(teapotProgram, 'u_world'),
            u_normalMat: gl.getUniformLocation(teapotProgram, 'u_normalMat'),
            u_projection: gl.getUniformLocation(teapotProgram, 'u_projection'),
            u_view: gl.getUniformLocation(teapotProgram, 'u_view')        
        };
    }
    
    function buildSkyboxProgram(renderCallback) {
        // Build the program
        const cubeVertexShader = glCompiler.createShader(gl.VERTEX_SHADER, Shaders.CubeModel.vertex);
        const cubeFragmentShader = glCompiler.createShader(gl.FRAGMENT_SHADER, Shaders.CubeModel.fragment);
        const cubeProgram = glCompiler.createProgram(cubeVertexShader, cubeFragmentShader);
    
        gl.useProgram(cubeProgram);
        AppState.programs.cube.program = cubeProgram;
    
        setQuadPositions();
    
        // The reference addresses to attributes, uniforms, and varyings within the compiled shaders
        AppState.programs.cube.vars = {
            a_position: gl.getAttribLocation(cubeProgram, 'a_position'),
            u_skybox: gl.getUniformLocation(cubeProgram, 'u_skybox'),
            u_viewDirectionProjectionInverse: gl.getUniformLocation(cubeProgram, 'u_viewDirectionProjectionInverse')
        };
    
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    
        loadCubeImages(gl, texture, renderCallback);
    }
}

/**
 * Retrieves the teapot context based on the shading model
 */
function teapotRef() {
    switch (AppState.shadingModel) {
        case ShadingModel.PHONG:
            return AppState.programs.teapot;
        case ShadingModel.REFLECTIVE:
            return AppState.programs.teapotReflective;
        case ShadingModel.REFRACTIVE:
            return AppState.programs.teapotRefractive;
    }
}

/**
 * Switches the shader programs based on the shading of the teapot
 */
function useTeapotProgram() {
    switch (AppState.shadingModel) {
        case ShadingModel.PHONG:
            gl.useProgram(AppState.programs.teapot.program);
            break;
        case ShadingModel.REFLECTIVE:
            gl.useProgram(AppState.programs.teapotReflective.program);
            break;
        case ShadingModel.REFRACTIVE:
            gl.useProgram(AppState.programs.teapotRefractive.program);
            break;
    }
}

 /**
  * Builds a gl context to be used globally across the application
  * @param {object} AppState 
  * @returns {WebGL2RenderingContext}
  */
function buildGlContext(AppState) {
    // Retrieve the canvas, and set up the configured width, and height
    // Per HTML5 spec, we do not want to configure the canvas size through CSS
    // as that leads to the stretching of the rendered image. Instead the size
    // of the canvas must be explicitly defined at the HTML attribute level,
    // or can be configured through a call.
    canvas = document.getElementById(AppState.models.teapot.type);
    canvas.width = AppState.screenSize.width;
    canvas.height = AppState.screenSize.height;

    // Set the canvas within the AppState.
    AppState.canvas = canvas;

    // If the browser does not support WebGL, we will throw an error, and
    // stop execution.
    const gl = canvas.getContext('webgl');
    if (!gl)
        throw new Error('WebGL is not supported by this browser');

    // Enable WebGL to cull back facing triangles
    gl.enable(gl.CULL_FACE);

    // Back facing triangles can still be be drawn over front facing ones,
    // depending on the angle, so enable DEPTH_TEST for a z-Buffer
    gl.enable(gl.DEPTH_TEST);

    // Set up the gl viewport, and configure how things will be
    // rendered.
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    return gl;
}

/**
 * The function to modify the normal matrix in the vertex shader for whenever we need to update
 * the normals.
 * 
 * n' = (M^-1)^T * n
 */
function updateNormals() {
    const teapotVars = teapotRef();
    const transformationMatrix = AppState.programs.global.worldMatrix;

    // Invert our current transformation matrix
    const inverseMatrix = glMatrix.mat4.create();
    glMatrix.mat4.invert(inverseMatrix, transformationMatrix);

    // Transpose it
    const transposedMatrix = glMatrix.mat4.create();
    glMatrix.mat4.transpose(transposedMatrix, inverseMatrix);

    // set the normal matrix in the vertex shader
    gl.uniformMatrix4fv(teapotVars.vars.u_normalMat, false, transposedMatrix);
}

/**
 * Computes a normal given vertices of the current triangle
 * @param {Float32Array} v1
 * @param {Float32Array} v2
 * @param {Float32Array} v3
 */
function computeFaceNormal(v1, v2, v3) {
    const normal = glMatrix.vec3.create();

    const first = glMatrix.vec3.create();
    const second = glMatrix.vec3.create();

    glMatrix.vec3.subtract(first, v2, v1);
    glMatrix.vec3.subtract(second, v3, v1);

    glMatrix.vec3.cross(normal, first, second);
    glMatrix.vec3.normalize(normal, normal);

    return normal;
}

/**
 * Generates the per vertex normals from the raw OBJ file.
 * 
 * The results will be stored in AppState
 * @param {String} rawObject 
 */
function buildPerVertexNormals(rawObject) {
    const triangleIterator = createFaceIterator(rawObject, logger);
    const normalized = [];
    const vertexNormals = [];
    for(let  i = 0; i < triangleIterator.totalVertices(); i++) {
        vertexNormals[i] = glMatrix.vec3.create();
    }

    while(triangleIterator.hasNext()) {
        const triangle = triangleIterator.next();
        const normal = computeFaceNormal(triangle.v1, triangle.v2, triangle.v3);

        vertexNormals[triangle.indices.v1 - 1] =
            glMatrix.vec3.add(vertexNormals[triangle.indices.v1 - 1], vertexNormals[triangle.indices.v1 - 1], normal);
        vertexNormals[triangle.indices.v2 - 1] =
            glMatrix.vec3.add(vertexNormals[triangle.indices.v2 - 1], vertexNormals[triangle.indices.v2 - 1], normal);
        vertexNormals[triangle.indices.v3 - 1] =
            glMatrix.vec3.add(vertexNormals[triangle.indices.v3 - 1], vertexNormals[triangle.indices.v3 - 1], normal);
    }

    triangleIterator.restart();
    while(triangleIterator.hasNext()) {
        const triangle = triangleIterator.next();

        glMatrix.vec3.normalize(vertexNormals[triangle.indices.v1 - 1] , vertexNormals[triangle.indices.v1 - 1] );
        glMatrix.vec3.normalize(vertexNormals[triangle.indices.v2 - 1] , vertexNormals[triangle.indices.v2 - 1] );
        glMatrix.vec3.normalize(vertexNormals[triangle.indices.v3 - 1] , vertexNormals[triangle.indices.v3 - 1] );

        normalized.push(
            ...vertexNormals[triangle.indices.v1 - 1],
            ...vertexNormals[triangle.indices.v2 - 1],
            ...vertexNormals[triangle.indices.v3 - 1]
        );
    }

    AppState.models.teapot.normals = normalized;
}

/**
 * Offline preprocessing to build the buffer of positional points in (x, y, z) 3 component vector format, 
 * and the corresponding normalized vectors.
 * 
 * The results will be stored in the AppState.models.{modelName}.positions, and AppState.models.{modelName}.positions
 * respectively.
 * @param {string} rawObject 
 */
function buildPositions(rawObject) {
    const positions = [];

    // Build the triangles.
    const triangleIterator = createFaceIterator(rawObject, logger);
    const triangles = [];    

    while(triangleIterator.hasNext()) {
        triangles.push(triangleIterator.next());
    }
    triangles.forEach(t => {
        positions.push(...t.v1);
        positions.push(...t.v2);
        positions.push(...t.v3);
    });

    // Scale and translate each point down, so that we don't have to do this later.
    AppState.models.teapot.positions = positions
        .map(p => p * AppState.programs.teapot.scale);

    // Translate down to the scene
    for(let i = 1; i < AppState.models.teapot.positions.length - 1; i += 3)
        AppState.models.teapot.positions[i] += AppState.programs.teapot.translate;
}

/**
 * Builds the quad meshes required by the Skybox
 */
function setQuadPositions() {
    const positions = [
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1,  1
    ];

    AppState.models.cube.positions = positions;
}

/**
 * Loads the texture images for use in the cube map.
 * 
 * @param {WebGLRenderingContext} gl 
 * @param {WebGLTexture} texture 
 * @param {() => void} cb
 * @returns {Promise<any[]>}
 */
function loadCubeImages(gl, texture, cb) {
    const images = {
        Sf: {
            folder: './Sf',
            extension: 'jpg'
        },
        London: {
            folder: './London',
            extension: 'png'
        },
        Sweden: {
            folder: './Sweden',
            extension: 'jpg'
        }
    };

    const currentFolder = AppState.images.directory.replace('./', '');
    const cubeImages = [
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            url: `${images[currentFolder].folder}/${AppState.programs.cube.images.posX}.${images[currentFolder].extension}`
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            url: `${images[currentFolder].folder}/${AppState.programs.cube.images.negX}.${images[currentFolder].extension}`
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            url: `${images[currentFolder].folder}/${AppState.programs.cube.images.posY}.${images[currentFolder].extension}`
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            url: `${images[currentFolder].folder}/${AppState.programs.cube.images.negY}.${images[currentFolder].extension}`
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            url: `${images[currentFolder].folder}/${AppState.programs.cube.images.posZ}.${images[currentFolder].extension}`
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            url: `${images[currentFolder].folder}/${AppState.programs.cube.images.negZ}.${images[currentFolder].extension}`
        }
    ];

    const promises = cubeImages.map(el => {
        return new Promise((resolve) => {
            const {target, url} = el;
    
            // Upload the canvas to the cubemap face.
            const level = 0;
            const internalFormat = gl.RGBA;
            const width = 512;
            const height = 512;
            const format = gl.RGBA;
            const type = gl.UNSIGNED_BYTE;

            gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);
    
            const image = new Image();
            image.src = url;
            image.addEventListener('load', function() {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                gl.texImage2D(target, level, internalFormat, format, type, image);
                gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

                return resolve();
            });
        });
    });

    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    return Promise.all(promises).then(() => {
        document.getElementById('loading-message').classList.add('hidden');
        cb()
    });
}

/**
 * Updates the flags based on user input. The function will call render to update the canvas, and
 * then invoke requestAnimationFrame(updateFlags) again to animate.
 * @param {number} time 
 */
function updateFlags(time) {
    if(AppState.programs.global.flags.stopAnimation) {
        return;
    }

    if (AppState.programs.teapot.flags.rotate.axis === Axis.Y) {
        AppState.programs.teapot.flags.rotate.y = (AppState.programs.teapot.flags.rotate.y + 5) % 360;
    } else if(AppState.programs.teapot.flags.rotate.axis === Axis.X) {
        AppState.programs.teapot.flags.rotate.x = (AppState.programs.teapot.flags.rotate.x + 5) % 360;
    }

    if (AppState.programs.global.flags.rotate.direction === Direction.POSITIVE) {
        AppState.programs.global.eyePoint = [
            Math.cos(AppState.programs.teapot.flags.rotate.delta) * 2,
            0,
            Math.sin(AppState.programs.teapot.flags.rotate.delta) * 2
        ];
    } else if (AppState.programs.global.flags.rotate.direction === Direction.NEGATIVE) {
        AppState.programs.global.eyePoint = [
            Math.cos(-AppState.programs.teapot.flags.rotate.delta) * 2,
            0,
            Math.sin(-AppState.programs.teapot.flags.rotate.delta) * 2
        ];
    }

    AppState.programs.teapot.flags.rotate.delta += 0.01;

    render(time);

    requestAnimationFrame(updateFlags);
}

/**
 * Teapot and Skybox Control Event Listeners
 * 
 * - We want to attach these at the very end so that we are guaranteed that the DOM elements will exist.
 * - Each button here will kick off a call to requestAnimationFrame(updateFlags) which will be recursively called until the 
 *   event to stop is detected. Usually with these buttons, it will be when the user releases the mouse button.
 * - Using raf here helps in that we will try to always stick to 60fps, or whatever the browser can render to get close to that.
 */

/**
 * Skybox
 */
document.getElementById('btn-skybox-rotate-y-neg').addEventListener('mousedown', function() {
    AppState.programs.global.flags.rotate.direction = Direction.NEGATIVE;
    AppState.programs.global.flags.stopAnimation = false;
    requestAnimationFrame(updateFlags);
});
document.getElementById('btn-skybox-rotate-y-neg').addEventListener('mouseup', function() {
    AppState.programs.global.flags.rotate.direction = Direction.NONE;
    AppState.programs.global.flags.stopAnimation = true;
    requestAnimationFrame(updateFlags);
});
document.getElementById('btn-skybox-rotate-y-pos').addEventListener('mousedown', function() {
    AppState.programs.global.flags.rotate.direction = Direction.POSITIVE;
    AppState.programs.global.flags.stopAnimation = false;
    requestAnimationFrame(updateFlags);
});
document.getElementById('btn-skybox-rotate-y-pos').addEventListener('mouseup', function() {
    AppState.programs.global.flags.rotate.direction = Direction.NONE;
    AppState.programs.global.flags.stopAnimation = true;
    requestAnimationFrame(updateFlags);
});

/**
 * Teapot
 */
document.getElementById('btn-rotate-x').addEventListener('mousedown', function() {
    AppState.programs.teapot.flags.rotate.axis = Axis.X;
    AppState.programs.global.flags.stopAnimation = false;
    requestAnimationFrame(updateFlags);
});
document.getElementById('btn-rotate-x').addEventListener('mouseup', function() {
    AppState.programs.teapot.flags.rotate.axis = Axis.NONE;
    AppState.programs.global.flags.stopAnimation = true;
    requestAnimationFrame(updateFlags);
});
document.getElementById('btn-rotate-y').addEventListener('mousedown', function() {
    AppState.programs.teapot.flags.rotate.axis = Axis.Y;
    AppState.programs.global.flags.stopAnimation = false;
    requestAnimationFrame(updateFlags);
});
document.getElementById('btn-rotate-y').addEventListener('mouseup', function() {
    AppState.programs.teapot.flags.rotate.axis = Axis.NONE;
    AppState.programs.global.flags.stopAnimation = true;
    requestAnimationFrame(updateFlags);
});

/**
 * Sets the shading model for the teapot
 */
document.getElementById('btn-set-shading').addEventListener('click', function() {
    const select = document.getElementById('select-shading');

    AppState.shadingModel = select.options[select.options.selectedIndex].value;
    
    main();
});

/**
 * Sets the Skybox setting
 */
document.getElementById('select-skybox').addEventListener('change', function() {
    const select = document.getElementById('select-skybox');

    AppState.images.directory = select.options[select.options.selectedIndex].value;

    document.getElementById('loading-message').classList.remove('hidden');

    main();
});


/**
 * Event handlers to set the resolution of the canvas
 */
document.getElementById('input-width').addEventListener('change', function() {
    const newWidth = parseInt(document.getElementById('input-width').value);

    if (Number.isNaN(newWidth))
        return;

    AppState.screenSize.width = newWidth;

    main();
});
document.getElementById('input-height').addEventListener('change', function() {
    const newHeight = parseInt(document.getElementById('input-height').value);

    if (Number.isNaN(newHeight))
        return;

    AppState.screenSize.height = newHeight;
    
    main();
});

document.getElementById('btn-screenshot').addEventListener('click', function() {
    render(Date.now());
    AppState.canvas.toBlob((blob) => {
        const a = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = 'screen.png'
        a.click();
    });

});