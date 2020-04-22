/**
 * gl-compiler.js
 * 
 * Simple shader compiler for webgl.
 * 
 * Roger Ngo
 * March, 2020
 * 
 * rngo2@illinois.edu
 */

class GlCompiler {
    constructor(gl, logger) {
        this.gl = gl;
        this.logger = logger || window.logger || console;
    }

    /**
     * Compiles the webgl shader.
     * 
     * @param {number} type 
     * @param {string} source
     * @returns {WebGLShader}
     */
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
    
        const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
    
        if (success)
            return shader;
    
        this.logger.log(this.gl.getShaderInfoLog(shader));
        this.gl.deleteShader(shader);
    }

    /**
     * Links the shaders to a single WebGLProgram.
     * 
     * @param {WebGLShader} vertexShader 
     * @param {WebGLShader} fragmentShader
     * @returns {WebGLProgram}
     */
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
    
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
    
        const success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
    
        if (success)
            return program;
    
        this.logger.log(this.gl.getProgramInfoLog(program));
        this.gl.deleteProgram(program);
    }
}
