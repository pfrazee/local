define(function() {
    // polyfill requestAnimationFrame
    if ( !window.requestAnimationFrame ) {
        window.requestAnimationFrame = ( function() {
            return window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame || // comment out if FF4 is slow (it caps framerate at ~30fps: https://bugzilla.mozilla.org/show_bug.cgi?id=630127)
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {
                    window.setTimeout( callback, 1000 / 60 );
                };
        } )();
    }

    // Background GL
    // =============
    // stolen, poorly, from http://minimal.be/lab/fluGL/index80000.html
    // just wanted to see if this would work
    var Module = function(config) {
        this.canvas_elem = null;
        this.gl = null;
        this.vertices = this.velocities = null;
        this.cw = this.ch = 0;
        this.numLines = 30000;
    };

    // Resource Meta
    // =============
    Module.prototype.resources = {
        '/': {
            desc:'Background GL: get fancy with it.',
            _get:'Starts the effect.',
            _delete:'Stops the effect.'
        }
    };

    // Route Handlers
    // ==============
    Module.prototype.routes = [
        { cb:"start", uri:"^/?$", method:'get' },
        { cb:"stop", uri:"^/?$", method:'delete' },
    ];
    Module.prototype.start = function() {
        // make sure the canvas exists
        if (!this.canvas_elem) {
            this.canvas_elem = document.createElement('canvas');
            this.canvas_elem.style.position = 'absolute';
            this.canvas_elem.style['z-index'] = '-1';
            document.body.insertBefore(this.canvas_elem, document.getElementById('lshui-toplayer').nextSibling);
        }
        // get the webgl context
        this.gl = this.canvas_elem.getContext('experimental-webgl');
        if (!this.gl) { return { code:500, reason:'no webgl context available' }; }
        // setup the viewport
        this.cw = this.canvas_elem.width = window.innerWidth;
        this.ch = this.canvas_elem.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas_elem.width, this.canvas_elem.height);
        // set up the shader programs
        __compileVertexShader.call(this);
        __compileFragmentShader.call(this);
        __loadShaders.call(this);
        // set up the rendering environment
        __setupGLEnv.call(this);
        __fillVertexBuffer.call(this);
        __setupMatrices.call(this);
        // being rendering
        __render.call(this);
        return { code:204 };
    };
    Module.prototype.stop = function() {
        if (this.gl) {
            this.gl.deleteProgram(this.gl.program);
            delete this.gl;
            this.gl = null;
        }
        if (this.canvas_elem) {
            document.body.removeChild(this.canvas_elem);
            delete this.canvas_elem;
            this.canvas_elem = null;
        }
        return { code:204 };
    };

    // Private Helpers
    // ===============
    // prep vertex shader
    var __compileVertexShader = function() {
        this.vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(this.vertexShader, [
            'attribute vec3 vertexPosition;',
            'uniform mat4 modelViewMatrix;',
            'uniform mat4 perspectiveMatrix;',
            'void main(void) {',
                'gl_Position = perspectiveMatrix * modelViewMatrix * vec4(vertexPosition, 1.0);',
            '}'
        ].join(''));
        this.gl.compileShader(this.vertexShader);
        if(!this.gl.getShaderParameter(this.vertexShader, this.gl.COMPILE_STATUS)) {
            this.gl.deleteShader(this.vertexShader);
            throw { code:500, reason:"couldn't compile the vertex shader" };
        }
    };

    // prep fragment shader
    var __compileFragmentShader = function() {
        this.fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(this.fragmentShader, [
            "#ifdef GL_ES\r\n",
            "precision highp float;\r\n",
            "#endif\r\n",
            'void main(void) {',
                'gl_FragColor = vec4(0.24, 0.31, 0.18, 0.07);',
            '}'
        ].join(''));
        this.gl.compileShader(this.fragmentShader);
        if(!this.gl.getShaderParameter(this.fragmentShader, this.gl.COMPILE_STATUS)) {
            this.gl.deleteShader(this.fragmentShader);
            throw { code:500, reason:"couldn't compile the fragment shader" };
        }
    };

    // pull shaders into gl memory
    var __loadShaders = function() {
        // Create a shader program. 
        this.gl.program = this.gl.createProgram();
        this.gl.attachShader(this.gl.program, this.vertexShader);
        this.gl.attachShader(this.gl.program, this.fragmentShader);
        this.gl.linkProgram(this.gl.program);
        if (!this.gl.getProgramParameter(this.gl.program, this.gl.LINK_STATUS)) {
            this.gl.deleteProgram(this.gl.program);
            this.gl.deleteProgram(this.vertexShader);
            this.gl.deleteProgram(this.fragmentShader);
            throw { code:500, reason:"unable to initialise shaders" };
        }
        // Install the program as part of the current rendering state
        this.gl.useProgram(this.gl.program);
        // Get the vertexPosition attribute from the linked shader program
        var vertexPosition = this.gl.getAttribLocation(this.gl.program, "vertexPosition");
        // Enable the vertexPosition vertex attribute array
        this.gl.enableVertexAttribArray(vertexPosition);
    };

    // blending, clearing settings
    var __setupGLEnv = function() {
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clearDepth(1.0);
        this.gl.enable(this.gl.BLEND);
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    };

    // creates the verticles
    var __fillVertexBuffer = function() {
        // First create a vertex buffer in which we can store our data.
        var vertexBuffer = this.gl.createBuffer();
        // Bind the buffer object to the ARRAY_BUFFER target.
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        // Specify the vertex positions (x, y, z)
        this.vertices = [];
        this.ratio = this.cw / this.ch;
        this.velocities = [];
        for ( var i=0; i<this.numLines; i++ )
        {
            this.vertices.push( 0, 0, 1.83 );//(Math.random() * 2 - 1)*ratio, Math.random() * 2 - 1, 1.83 );
            this.velocities.push( (Math.random() * 2 - 1)*.05, (Math.random() * 2 - 1)*.05, .93 + Math.random()*.02 );
        }
        this.vertices = new Float32Array( this.vertices );
        this.velocities = new Float32Array( this.velocities );
        // Creates a new data store for the vertices array which is bound to the ARRAY_BUFFER.
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.DYNAMIC_DRAW);
    };

    // builds and sets the mv and perspective matrices
    var __setupMatrices = function() {
        // Define the viewing frustum parameters
        var fieldOfView = 30.0;
        var aspectRatio = this.canvas_elem.width / this.canvas_elem.height;
        var nearPlane = 1.0;
        var farPlane = 10000.0;
        var top = nearPlane * Math.tan(fieldOfView * Math.PI / 360.0);
        var bottom = -top;
        var right = top * aspectRatio;
        var left = -right;

        // Create the perspective matrix.
        var a = (right + left) / (right - left);
        var b = (top + bottom) / (top - bottom);
        var c = (farPlane + nearPlane) / (farPlane - nearPlane);
        var d = (2 * farPlane * nearPlane) / (farPlane - nearPlane);
        var x = (2 * nearPlane) / (right - left);
        var y = (2 * nearPlane) / (top - bottom);
        var perspectiveMatrix = [
            x, 0, a, 0,
            0, y, b, 0,
            0, 0, c, d,
            0, 0, -1, 0
        ];
        
        // Create the modelview matrix
        var modelViewMatrix = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
        // Get the vertex position attribute location from the shader program
        var vertexPosAttribLocation = this.gl.getAttribLocation(this.gl.program, "vertexPosition");
        // Specify the location and format of the vertex position attribute
        this.gl.vertexAttribPointer(vertexPosAttribLocation, 3.0, this.gl.FLOAT, false, 0, 0);
        // Get the location of the "modelViewMatrix" uniform variable from the shader program
        var uModelViewMatrix = this.gl.getUniformLocation(this.gl.program, "modelViewMatrix");
        // Get the location of the "perspectiveMatrix" uniform variable from the shader program
        var uPerspectiveMatrix = this.gl.getUniformLocation(this.gl.program, "perspectiveMatrix");
        // Set the values
        this.gl.uniformMatrix4fv(uModelViewMatrix, false, new Float32Array(perspectiveMatrix));
        this.gl.uniformMatrix4fv(uPerspectiveMatrix, false, new Float32Array(modelViewMatrix));
    };

    // renders the geometry
    var i=0;
    var __drawScene = function() {
        if (!this.gl) { return; }
        var i, n = this.vertices.length, p, bp;
        for( i = 0; i < this.numLines; i+=2 ) {
            bp = i*3;
            // copy old positions
            this.vertices[bp] = this.vertices[bp+3];
            this.vertices[bp+1] = this.vertices[bp+4];
            
            // inertia
            this.velocities[bp] *= this.velocities[bp+2];
            this.velocities[bp+1] *= this.velocities[bp+2];
            
            // horizontal
            p = this.vertices[bp+3];
            p += this.velocities[bp];
            if ( p < -this.ratio ) {
                p = -this.ratio;
                this.velocities[bp] = Math.abs(this.velocities[bp]);
            } else if ( p > this.ratio ) {
                p = this.ratio;
                this.velocities[bp] = -Math.abs(this.velocities[bp]);
            }
            this.vertices[bp+3] = p;
            
            // vertical
            p = this.vertices[bp+4];
            p += this.velocities[bp+1];
            if ( p < -1 ) {
                p = -1;
                this.velocities[bp+1] = Math.abs(this.velocities[bp+1]);
            } else if ( p > 1 ) {
                p = 1;
                this.velocities[bp+1] = -Math.abs(this.velocities[bp+1]);
                
            }
            this.vertices[bp+4] = p;
            
            // gravity point
            var touchX = 0.0, touchY = 0.0;
            i++;
            var dx = touchX - this.vertices[bp],
            dy = touchY - this.vertices[bp+1],
            d = Math.sqrt(dx * dx + dy * dy);
            if ( d < 2 )
            {
                if ( d < .03 )
                {
                    this.vertices[bp+3] = (Math.random() * 2 - 1)*this.ratio;
                    this.vertices[bp+4] = Math.random() * 2 - 1;
                    this.velocities[bp] = 0;
                    this.velocities[bp+1] = 0;
                } else {
                    dx /= d;
                    dy /= d;
                    d = ( 2 - d ) / 2;
                    d *= d;
                    this.velocities[bp] += dx * d * .01;
                    this.velocities[bp+1] += dy * d * .01;
                }
            }
        }
        this.gl.lineWidth(2.6);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.DYNAMIC_DRAW);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.drawArrays( this.gl.LINES, 0, this.numLines );
        this.gl.flush();
    };

    var __render = function() {
        var self = this;
        requestAnimationFrame(function() { if (self.gl) { __render.call(self); }});
        __drawScene.call(self);
    };
    
    return Module;

});