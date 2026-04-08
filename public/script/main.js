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

uniform vec4[4] bayer4;

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

    vec4 Pi = floor(p.xyxy) + vec4(0.0,0.0,1.0,1.0);
    vec4 Pf = fract(p.xyxy) - vec4(0.0,0.0,1.0,1.0);
    Pi = mod289(Pi);
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;

    vec4 i = permute(permute(ix) + iy);
    vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0;
    vec4 gy = abs(gx) - 0.5;
    vec4 tx = floor(gx + 0.5);
    gx = gx - tx;

    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);

    vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));

    float n00 = norm.x * dot(g00, vec2(fx.x, fy.x ));
    float n01 = norm.y * dot(g01, vec2(fx.z , fy.z ));
    float n10 = norm.z * dot(g10, vec2(fx.y, fy.y ));
    float n11 = norm.w * dot(g11, vec2(fx.w , fy.w  ));

    vec2 fade_xy = fade(Pf.xy);
    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);

    float wave = (1.0/8.0) * (sin(sqrt(10.0) * sin((0.1) * uTime) + cos(uTime))) + 0.5;
    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return wave * 3.5 * n_xy;
}

float color(vec2 xy) { return perlinnoise(1.5*xy); }

float getBayer4(int x, int y)
{
    return float(bayer4[x % 4][y % 4]) * (1.0f / 16.0f);
}

vec3 posterize( vec3 color, int levels)
{
    return (floor(color * float(levels - 1) + 0.5)) / float(levels-1);
}

void main()
{
    //downscaling
    int downscaleVal = 4;
    vec2 resolution = u_resolution / float(downscaleVal);



    //Perlin Noise functions
    vec2 p = (gl_FragCoord.xy/u_resolution.y) * 2.0 - 1.0;
    vec3 xyz = vec3(p, 0.0);
    float n = color(xyz.xy * 4.0);
    vec3 finalColor = vec3(0.5 + 0.5 * vec3(n,n,n));


    //Dithering

    vec3 thresh = vec3(1.0/8.0);
    int x = int(gl_FragCoord.x * resolution.x);
    int y = int(gl_FragCoord.y * resolution.y);
    float factor = getBayer4(x, y);
    float lumiVar = 0.1;
    finalColor = posterize(finalColor,16);
    vec3 attempt = finalColor + (factor * thresh);

    fragColor = vec4(attempt, 1.0);
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


    const bayer4 = new Float32Array([
        0, 8, 2, 10,
        12, 4, 14, 6,
        3, 11, 1, 9,
        15, 7, 13, 5
    ]);

    const bayer4Location = gl.getUniformLocation(program, "bayer4");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const aPositionLoc = gl.getAttribLocation(program, 'aPosition');
    const aPointSizeLoc = gl.getAttribLocation(program, 'aPointSize');
    const resLocation = gl.getUniformLocation(program, "u_resolution");

    gl.uniform4fv(bayer4Location, bayer4);
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


