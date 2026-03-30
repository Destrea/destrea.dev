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

vec4 color1 = vec4(0.0,0.0,0.0,1.0);
vec4 color2 = vec4(0.0,0.0,0.0,1.0);
vec4 color3 = vec4(0.0,0.0,0.0,1.0);
vec4 color4 = vec4(0.0,0.0,0.0,1.0);

const float PIXEL_SIZE = 4.0; // Size of each pixel in the Bayer matrix
const float CELL_PIXEL_SIZE = 8.0 * PIXEL_SIZE; // 8x8 Bayer matrix

uniform float[2] arraytest;

//float bayer2vals[4] = float[4](0,2,3,1);


float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2. + a.y * a.y * .75);
}

#define Bayer4(a) (Bayer2(0.5 * (a)) * 0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(0.5 * (a)) * 0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.
#define FBM_SCALE       4.0


float hash11(float n) { return fract(sin(n)*43758.5453); }

float vnoise(vec3 p)
{
    vec3 ip = floor(p);
    vec3 fp = fract(p);

    float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
    float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
    float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
    float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
    float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
    float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
    float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
    float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));

    vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);   // smootherstep

    float x00 = mix(n000, n100, w.x);
    float x10 = mix(n010, n110, w.x);
    float x01 = mix(n001, n101, w.x);
    float x11 = mix(n011, n111, w.x);

    float y0  = mix(x00, x10, w.y);
    float y1  = mix(x01, x11, w.y);

    return mix(y0, y1, w.z) * 2.0 - 1.0;         // [-1,1]
}

float fbm2(vec2 uv, float t)
{
    vec3 p   = vec3(uv * FBM_SCALE, t);
    float amp  = 1.;
    float freq = 1.;
    float sum  = 1.;

    for (int i = 0; i < FBM_OCTAVES; ++i)
    {
        sum  += amp * vnoise(p * freq);
        freq *= FBM_LACUNARITY;
        amp  *= FBM_GAIN;
    }

    return sum * 0.5 + 0.5;   // [0,1]
}

void main()
{
    float resolutionX = gl_FragCoord.x * (1.0/vUV.x);
    float resolutionY = gl_FragCoord.y * (1.0/vUV.y);

    vec2 uResolution = vec2(resolutionX,resolutionY);
    float pixelSize = PIXEL_SIZE;
    float aspectRatio = uResolution.x / uResolution.y;
    vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;


    vec2 pixelId = floor(fragCoord / pixelSize); // integer Bayer cell
    vec2 pixelUV = fract(fragCoord / pixelSize);

    float cellPixelSize =  8. * pixelSize; // 8x8 Bayer matrix
    vec2 cellId = floor(fragCoord / cellPixelSize); // integer Bayer cell

    vec2 cellCoord = cellId * cellPixelSize;

    vec2 uv = ((cellCoord / (uResolution) )) * vec2(aspectRatio, 1.0);

    float feed = fbm2(uv, uTime * 0.1);

    float brightness = -.65;
    float contrast = .5;
    feed = feed * contrast + brightness; // Apply contrast and brightness adjustments

    float bayerValue = Bayer8(fragCoord / pixelSize) - .5;

    float bw = step(0.5, feed + bayerValue);

    fragColor = vec4(vec3(bw), 1.0);
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


