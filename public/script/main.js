const vertexShaderSource = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUV;

void main() {
    // Convert aPosition from [-1,1] to [0,1] range for texture‐style UVs
    vUV = aPosition * 0.5 + 0.5;
    vUV.y = 1.0 - vUV.y;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;



const fragmentShaderSource2 = `#version 300 es

precision mediump float;

uniform float uTime;
in vec2 vUV;

out vec4 fragColor;
uniform vec2 u_resolution;

vec4 mod289(vec4 x)
{
    return x - floor(x * (1.0/289.0)) * 289.0;
}


vec4 permute(vec4 x)
{
    return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
    return 1.79284281400159 - 0.8537347095314 * r;
}

vec2 fade(vec2 t) {
    return t*t*t*(t*(t*6.0-15.0) + 10.0);
}



float perlinnoise(vec2 p)
{
   //Reference: https://stegu.github.io/webgl-noise/webdemo/
    //https://mzucker.github.io/html/perlin-noise-math-faq.html
    //https://www.youtube.com/watch?v=DxUY42r_6Cg&t=342s
}


void main()
{
    float x = gl_FragCoord.x;
    float y = gl_FragCoord.y;
    float noiseVal = noise(vec2(x * 21.0, y * 15.0));
    vec3 color = vec3(noiseVal);
    fragColor = vec4(color, 1.0);

}`;

const fragmentShaderSource = `#version 300 es
precision mediump float;
in vec2 vUV;
out vec4 fragColor;




void main() {
    // Render a simple gradient: red = U, green = V, blue = 0.5
    fragColor = vec4(vUV.x, vUV.y, 0.5, 1.0);
}`;

function shadersMain()
{
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');

    const program = gl.createProgram();

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    gl.attachShader(program, vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource2);
    gl.compileShader(fragmentShader);
    gl.attachShader(program, fragmentShader);


    gl.linkProgram(program);

    if(!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        console.log(gl.getShaderInfoLog(vertexShader));
        console.log(gl.getShaderInfoLog(fragmentShader));
        console.log(gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);

    const timeLocation = gl.getUniformLocation(program, "uTime");
    const aPositionLoc = gl.getAttribLocation(program, 'aPosition');
    const aPointSizeLoc = gl.getAttribLocation(program, 'aPointSize');
    const resLocation = gl.getUniformLocation(program, "u_resolution");


    // Create a buffer to put three 2d clip space points in
    var positionBuffer = gl.createBuffer();

    quadVAO = createFullscreenQuad(gl);


    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    requestAnimationFrame(render);

    function render(uTime)
    {

        resizeCanvas(gl.canvas);
        gl.viewport(0,0, gl.canvas.width, gl.canvas.height);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform1f(timeLocation, uTime / 1000.0);
        gl.uniform2f(resLocation, gl.canvas.width, gl.canvas.height);

        gl.bindVertexArray(quadVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindVertexArray(null);
        gl.useProgram(null);

        requestAnimationFrame(render);

    }



    function resizeCanvas(canvas) {
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
        if(needResize)
        {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }

        return needResize;
    }

    function createFullscreenQuad(gl)
    {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const verts =  new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
        return vao;
    }
}

shadersMain();

dragElement(document.getElementById("projectContent"));
dragElement(document.getElementById("project-description"));

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) {
        // if present, the header is where you move the DIV from:
        document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
        // otherwise, move the DIV from anywhere inside the DIV:
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e)
    {
        e = e || window.event;
        e.preventDefault();

        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;

        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();

        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";

    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }

}


