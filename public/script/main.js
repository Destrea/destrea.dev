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

precision highp float;

uniform float uTime;
in vec2 vUV;

out vec4 fragColor;
uniform vec2 u_resolution;
uniform vec4[4] bayer4;

uniform float intensity;
uniform float wavespeed;

int bayer8[64] = int[64](0, 32, 8, 40, 2, 34, 10, 42,
                                     48, 16, 56, 24, 50, 18, 58, 26,
                                     12, 44,  4, 36, 14, 46,  6, 38,
                                     60, 28, 52, 20, 62, 30, 54, 22,
                                     3, 35, 11, 43,  1, 33,  9, 41,
                                     51, 19, 59, 27, 49, 17, 57, 25,
                                     15, 47,  7, 39, 13, 45,  5, 37,
                                     63, 31, 55, 23, 61, 29, 53, 21);

const vec3 color0 = vec3(0.06274509803921569,0.3254901960784314,0.5647058823529412);
const vec3 color1 = vec3(0.10588235294117647,0.5843137254901961,0.5529411764705883);
const vec3 color2 = vec3(0.3686274509803922,0.7137254901960784,0.6784313725490196);
const vec3 color3 = vec3(0.8470588235294118,00.8627450980392157,0.7058823529411765);
const vec3 color4 = vec3(0.996078431372549,0.6588235294117647,0.37254901960784315);
const vec3 color5 = vec3(0.8862745098039215,0.3803921568627451,0.34901960784313724);
const vec3 color6 = vec3(0.8862745098039215,0.10980392156862745,0.3803921568627451);
const vec3 color7 = vec3(0.2196078431372549,0.08627450980392157,0.19215686274509805);

vec3 palette[8] = vec3[8](color0, color1,color2,color3,color4,color5,color6,color7);

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

    float wave = ( (1.0/4.0) * sin(sqrt(10.0) * sin((wavespeed/50.0) * uTime) + cos(uTime))) + 1.0;
    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return wave * (intensity/20.0) * n_xy;
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


vec3 closestColor(vec3 palette[8], vec3 attempt, int maxLumi)
{
    float shortest = pow((palette[maxLumi].r - attempt.r),2.0) + pow((palette[maxLumi].g - attempt.g),2.0) + pow((palette[maxLumi].b - attempt.b),2.0);
    vec3 closestColor = palette[maxLumi];

    for(int i = 0; i < 8; i++)
    {
        float dist = pow((palette[i].r - attempt.r),2.0) + pow((palette[i].g - attempt.g),2.0) + pow((palette[i].b - attempt.b),2.0);
        //float3 paletteColor = float3(palette[i].r, palette[i].g, palette[i].b);
        //float dist = colorCompare(paletteColor, attempt);
        if(dist <= shortest)
        {
            shortest = dist;
            closestColor = palette[i];
        }
    }
    return closestColor;
}



float luminance(vec3 color)
{
    float lum = dot(vec3(0.2126, 0.7152, 0.0722), color.rgb);
    return lum;
}

void main()
{
    //downscaling
    int downscaleVal = 16;

    //Cool horizontal glitch effect
    /*
    float resolutionX = float(int( 4.0 * round(u_resolution.x / float(downscaleVal))));
    float resolutionY = u_resolution.y / float(downscaleVal);
    vec2 resolution = vec2(resolutionX, resolutionY);
    */

    //This downscales the resolution to
    float resolutionX = float(int( float(downscaleVal) * round(u_resolution.x / float(downscaleVal)))) - 2.0;
    float resolutionY = float(int( float(downscaleVal) * round(u_resolution.xy/ float(downscaleVal)))) - 2.0;
    //vec2 resolution = vec2(u_resolution.x, u_resolution.y);
    vec2 resolution = vec2(resolutionX, resolutionY);

    float aspectRatio = resolution.x / resolution.y;

    //vec2 resolution = u_resolution;
    //Perlin Noise functions
    vec2 p = (gl_FragCoord.xy/resolution.xy) * 2.0 - 1.0;
    vec3 xyz = vec3(p, 0.0);
    float n = color(xyz.xy * 4.0);
    vec3 finalColor = vec3(0.5 + 0.5 * vec3(n,n,n));

    //Dithering

    vec3 thresh = vec3(1.0/8.0);
    int x = int(gl_FragCoord.x) * 2;
    int y = int(gl_FragCoord.y) * 2;
    float factor = getBayer4(x % 4, y % 4);
    //float factor = float(bayer8[y * 8 + x]) / 64.0;

    finalColor = posterize(finalColor,16);

    vec3 attempt = finalColor + (factor) + 0.2;
    vec3 pColor = vec3(0.0,0.0,0.0);

    //pColor = closestColor(palette, attempt, 6);

    if(attempt.r >= (7.0 * 0.125))
    {
        pColor = color0;
    }
    else if(attempt.r >= (6.0 * 0.125))
    {
         pColor = color1;
    }
    else if(attempt.r >= (5.0 * 0.125))
    {
         pColor = color2;
    }
    else if(attempt.r >= (4.0 * 0.125))
    {
         pColor = color3;
    }
    else if(attempt.r >= (3.0 * 0.125))
    {
         pColor = color4;
    }
    else if(attempt.r >= (2.0 * 0.125))
    {
         pColor = color5;
    }
    else if(attempt.r >= (1.0 * 0.125))
    {
         pColor = color6;
    }
    else
    {
        pColor = color7;
    }

    fragColor = vec4(pColor, 1.0);
}`;


//Shaders settings javascript
{
var intensitySlider = document.getElementById("intensity");


var intVal = document.getElementById("intVal");
intVal.innerHTML = intensitySlider.value;

var intensityValue = intensitySlider.value;

intensitySlider.oninput = function() {
    intVal.innerHTML = this.value;
    intensityValue = this.value;
}


var speedSlider = document.getElementById("speed");

var spdVal = document.getElementById("spdVal");
spdVal.innerHTML = speedSlider.value;

var speedValue = speedSlider.value;

speedSlider.oninput = function() {
    spdVal.innerHTML = this.value;
    speedValue = this.value;
}

}

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

    //Settings hooks
    const intensityLoc = gl.getUniformLocation(program, "intensity");
    const speedLoc = gl.getUniformLocation(program, "wavespeed");
    //Regular uniforms
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
        gl.uniform2f(resLocation, canvas.clientWidth, canvas.clientHeight);

        //Settings uniforms
        gl.uniform1f(intensityLoc, intensityValue);
        gl.uniform1f(speedLoc,  speedValue);

        gl.bindVertexArray(quadVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindVertexArray(null);
        gl.useProgram(null);

        requestAnimationFrame(render);

    }

    var debugText = document.getElementById("debug");

    var widthDebug = document.getElementById("devWidth");
    var heightDebug = document.getElementById("devHeight");

    widthDebug.innerHTML = canvas.clientWidth;

    heightDebug.innerHTML = canvas.clientHeight;

    function resizeCanvas(canvas) {
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        widthDebug.innerHTML = canvas.clientWidth;
        heightDebug.innerHTML = canvas.clientHeight;

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
dragElement(document.getElementById("aboutMe"));
dragElement(document.getElementById("project-settings"));
dragElement(document.getElementById("projectsList"));
dragElement(document.getElementById("navigationWindow"));

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "taskbar")) {
        // if present, the header is where you move the DIV from:
        document.getElementById(elmnt.id + "taskbar").onmousedown = dragMouseDown;
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
        elmnt.style.top = clamp((elmnt.offsetTop - pos2), 5, (window.innerHeight - 5 - elmnt.offsetHeight)) + "px";
        elmnt.style.left = clamp((elmnt.offsetLeft - pos1), 70, (window.innerWidth - 5 - elmnt.offsetWidth)) + "px";
        foregroundWindow(elmnt);
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }

    function clamp (value, min, max) {
        return Math.max(min, Math.min(value, max));
    }



}


function foregroundWindow(elmnt)
{
    var getSiblings = function (elem) {
        var descendants = elem.parentNode.children;
        return Array.prototype.filter.call(descendants, function (sibling) {
            return sibling !== elem;
        });
    };

    elmnt.style.zIndex = "9";
    var siblings = getSiblings(elmnt);
    for(let i = 0; i < siblings.length; i++)
    {
        if(siblings[i].style.zIndex == "9")
            siblings[i].style.zIndex = "8";
    }


}


var isMenuOpen = false;

function toggleMenu()
{
    let menubtn = document.getElementById("menuBtn")
    isMenuOpen = !isMenuOpen;
    if(isMenuOpen)
    {
        menubtn.innerHTML = "«";
        document.getElementById("menuButtons").style.display = "flex";
    }
    else
    {
        menubtn.innerHTML = "»";
        document.getElementById("menuButtons").style.display = "none";
    }
}

function openWindow(value)
{
    if(value == "Settings" )
    {
        let elmnt =  document.getElementById("project-settings");
        elmnt.style.display = "flex";
        foregroundWindow(elmnt);
    }
    else if(value == "About")
    {
        let elmnt =  document.getElementById("aboutMe");
        elmnt.style.display = "flex";
        foregroundWindow(elmnt);
    }
    else if(value == "Projects")
    {
        let elmnt =  document.getElementById("projectsList");
        elmnt.style.display = "flex";
        foregroundWindow(elmnt);
    }
}


//Project/window loading

function loadProject(value)
{
    let content = document.getElementById("projectContent");
    foregroundWindow(content);
    content.style.display = "flex";
    if(value == 1)
    {
        changeImage("public/images/3D.png");
        document.getElementById("projectName").innerHTML = "Project 1";
    }

    if(value == 2)
    {
        changeImage("public/images/Stars.png");
        document.getElementById("projectName").innerHTML = "Project 2";
    }

    if(value == 3)
    {
        changeImage("public/images/shader1.png");
        document.getElementById("projectName").innerHTML = "Project 3";
    }
}

function changeImage(a)
{
    document.getElementById("contentImg").src = a;
}



function closeWindow(elem)
{
    if(elem.parentNode.parentNode.id == "navigationWindow")
    {
        document.cookie = "tutorialSeen=true";
        console.log(document.cookie);
    }
    elem.parentNode.parentNode.style.display = "none";
}

function cookieLoading()
{
    let loadedCookie = document.cookie;
    console.log(loadedCookie.modalClosed)
    if(!loadedCookie.includes("modalClosed=true"))
    {
        document.getElementById("modalWin").style.display = "flex";
    }
    if(!loadedCookie.includes("tutorialSeen=true"))
    {
        document.getElementById("navigationWindow").style.display = "flex";
    }
}


function closeModal()
{
    //TODO: Add functionality for saving a cookie so that this doesn't reappear on refresh.
    document.getElementById("modalWin").style.display = "none";
    console.log("Modal Closed");
    document.cookie = "modalClosed=true";
    console.log(document.cookie);
}


//Mobile and Desktop functionality
function isMobileRegex() {
    const regex = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return regex.test(navigator.userAgent);
}

function hasTouchSupport() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

if (isMobileRegex() || hasTouchSupport()) {
    debugText.innerHTML = "device is mobile";

    //Run Mobile Javascript events here


} else {
    debugText.innerHTML = "device is NOT mobile";

    //Run Desktop Javascript events here
}
