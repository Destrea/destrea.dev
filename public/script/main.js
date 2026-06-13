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




// Click and Drag functionality (Mouse/Desktop)
dragElement(document.getElementById("projectDetails"));
dragElement(document.getElementById("aboutMe"));
dragElement(document.getElementById("projectSettings"));
dragElement(document.getElementById("projectsList"));
dragElement(document.getElementById("navigationWindow"));
dragElement(document.getElementById("modalImageBox"));

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



// Touch and Drag functionality (Mobile)
touchDragElement(document.getElementById("projectDetailstaskbar"));
touchDragElement(document.getElementById("aboutMetaskbar"));
touchDragElement(document.getElementById("projectSettingstaskbar"));
touchDragElement(document.getElementById("projectsListtaskbar"));
touchDragElement(document.getElementById("navigationWindowtaskbar"));
touchDragElement(document.getElementById("modalImageBoxtaskbar"));

function touchDragElement(elmnt) {

    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;


    function handleTouchStart(e) {
        e.preventDefault();
        pos3 = e.touches[0].clientX;
        pos4 = e.touches[0].clientY;
    }


    function handleTouchMove(e) {
        e.preventDefault();

        pos1 = pos3 - e.touches[0].clientX;
        pos2 = pos4 - e.touches[0].clientY;
        pos3 = e.touches[0].clientX;
        pos4 = e.touches[0].clientY;
        var parent = elmnt.parentNode;
        parent.style.top = clamp((parent.offsetTop - pos2), 5, (window.innerHeight - 5 - parent.offsetHeight)) + "px";
        parent.style.left = clamp((parent.offsetLeft - pos1), 70, (window.innerWidth - 5 - parent.offsetWidth)) + "px";
        foregroundWindow(parent);
    }

    function handleTouchEnd(e) {
        e.preventDefault();
    }


    elmnt.ontouchstart=function(e){
        handleTouchStart(e);
    }

    elmnt.ontouchmove=function(e){
        handleTouchMove(e);
    }

    elmnt.ontouchend=function(e){
        handleTouchEnd(e);
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
        let elmnt =  document.getElementById("projectSettings");
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


//Project Screenshots and videos

    //project Image arrays
    const TimelostImages = ["public/images/Timelost/Timelost1.png","public/images/Timelost/Timelost2.png","public/images/Timelost/Timelost3.png","public/images/Timelost/Timelost4.png","public/images/Timelost/Timelost5.png"];
    const GodotImages = ["public/images/GodotShaders/GodotShader1.png","public/images/GodotShaders/GodotShader2.png","public/images/GodotShaders/GodotShader3.png","public/images/GodotShaders/GodotShader4.png","public/images/GodotShaders/GodotShader5.png"];

    const MahjongImages = ["public/images/ScoringTool/ScoringTool1.png","public/images/ScoringTool/ScoringTool2.png"];
    const ReShadeImages = ["public/images/ReShade/3D.png","public/images/ReShade/shader1.png","https://raw.githubusercontent.com/Destrea/destrea.dev/183aed14637003e76756dd548b919982abdaa8df/public/images/ReShade/Banner.png","https://raw.githubusercontent.com/Destrea/destrea.dev/183aed14637003e76756dd548b919982abdaa8df/public/images/ReShade/ShaderLines.png","public/images/ReShade/Shader2Tone.png","public/images/ReShade/Shader3BitClose.png","public/images/ReShade/ShaderBW.png","public/images/ReShade/ShaderProc.png","public/images/ReShade/Stars.png",];
    const EngineImages = ["https://raw.githubusercontent.com/Destrea/destrea.dev/refs/heads/main/public/images/GameEngine/Engine1.png"];
    const WebsiteImages = ["public/images/Website/Website1.png"];


let imageIndex = 0;
let currentProject = "p2";
function nextImage(val)
{
    imageIndex += val;
    showSlides(imageIndex, currentProject);

    if(document.getElementById("modalImageBox").style.display === "flex")
    {
        imageModal();
    }
}

function setSlide(n)
{
    showSlides(imageIndex = n);
}

function showSlides(n, project)
{

    let gallery = ReShadeImages;

    if(project === "s1") { gallery = TimelostImages;}
    else if(project === "s2") { gallery = GodotImages;}
    else if(project === "p1") { gallery = MahjongImages;}
    else if(project === "p2") { gallery = ReShadeImages;}
    else if(project === "p3") { gallery = EngineImages;}
    else if(project === "p4") { gallery = WebsiteImages;};

    if( n > gallery.length - 1) { imageIndex = 0; }
    if( n < 0 ) { imageIndex = gallery.length - 1; }
    changeImage(gallery[imageIndex]);
}


function imageModal()
{

    let n = imageIndex;
    let gallery = ReShadeImages;
    let project = currentProject;

    if(project === "s1") { gallery = TimelostImages;}
    else if(project === "s2") { gallery = GodotImages;}
    else if(project === "p1") { gallery = MahjongImages;}
    else if(project === "p2") { gallery = ReShadeImages;}
    else if(project === "p3") { gallery = EngineImages;}
    else if(project === "p4") { gallery = WebsiteImages;};

    let img = document.getElementById("modalImage");
    img.src = gallery[n];
    document.getElementById("modalImageBox").style.display = "flex";
    foregroundWindow(document.getElementById("modalImageBox"));

}



function loadProject(value)
{
    let content = document.getElementById("projectDetails");
    foregroundWindow(content);
    content.style.display = "flex";


    if(value !== "p4")
    {
        document.getElementById("videoDiv").style.display = "flex";
    }

    if(value == "s1")
    {
        currentProject = "s1";
        imageIndex = 0;
        showSlides(imageIndex, currentProject);
        //changeImage("public/images/Timelost/Timelost1.png");
        changeLink("", "https://youtu.be/6RzoZncmLPY");
        document.getElementById("projectGithub").style.display = "none";
        document.getElementById("projectName").innerHTML = "Tower of the Timelost";
        document.getElementById("projectDate").innerHTML = "Date: August - December 2023";
        document.getElementById("descrText").innerHTML = `'Tower of the Timelost' is a project that I completed in a group of three as part of a game programming course that I took as an elective for my computer science degree. This game was completed over the course of one semester, totaling 15 weeks.<br /><br />

        The game itself was designed as a top-down roguelike, with the main goal being to acquire score by collecting valuabes and defeating enemies, while surviving until a time limit had been reached. The valuables you collected would also provide you with gold that could be spent on stat upgrades, to increase your damage, health, speed, and more.<br /><br />

        The project utilized my university's custom game engine, written primarily in C++, using DirectXTK 12. While I had experience working in C++ from previous courses, and some experience working in the Unity game engine, this was a really great learning expeience for me. Being my first long-term group programming project, as well as my first project utilizing git version control, it taught me many valuable skills. In addition to this, using the custom game engine for development pushed me to learn game development on a much deeper level than I was with Unity.<br /><br />
        The project itself used many licensed or open source assets, and some of the underlying systems were pre-made with the engine. Many of the game's final features are half-baked or buggy, but it was the first game that the three of us had actually invested time into developing. That said, I worked on a plethora of the final game's mechanics, and really grew my love for game development.<br /><br />

        A list of the features I worked on include:<br />
        - All of the game's UI design, both the graphics and the functionality.<br />
        - The game's level design, and pseudo-procedural room selection.<br />
        - The player's stats, including the scoring system and Time-keeping systems.<br />
        - Interaction systems, for objects and the shop-keeper npc.<br />
        - Level-switching and game states (Play, Pause, Main-menu, Game Over)<br /><br />
        Source code examples for this project are available upon request, since I'm not sure if I'm able to freely distribute any/all of the engine's code.`;
    }
    else
    {
         document.getElementById("projectGithub").style.display = "flex";
    }

    if(value == "s2")
    {
        currentProject = "s2";
        imageIndex = 0;
        showSlides(imageIndex, currentProject);
        //changeImage("public/images/GodotShaders/GodotShader1.png");
        changeLink("https://github.com/Destrea/GodotShadersProject", "https://youtu.be/sQTYYDeRbpM");
        document.getElementById("projectName").innerHTML = "Godot Shaders Exploration";
        document.getElementById("projectDate").innerHTML = "Date: January - May 2025";
        document.getElementById("descrText").innerHTML = `This project was completed as part of my "Topics in Game Development" course that I took as an elective for my computer science degree. Continuing beyond the Game Programming course, this course was focused around picking or technique in game development, and to spend an entire 15 week semester creating a project built around that concept. <br /><br />

        For this project, I picked 'Shaders'. Having seen them mentioned many times in many places, I knew they were important in game development but I had no idea what went into creating them, or what exactly they did. <br /><br />

        Through this semester, I created a project in the Godot Game engine that utilized a variety of different shader effects. Some of these were post-processing effects focused on the fragment shader, and others were material shaders that involved both the fragmen and vertex shaders. <br /><br />

        Through this project, I created:<br />
        - A simple water shader.<br />
        - A palette-swap shader<br />
        - Sobel Edge Detection, for object outlines<br />
        - Color Posterization filter<br />
        - A simple Bayer 4x4 dither.<br />
        - An ice shader with refraction<br />
        - A few different "fireball" style orbs and objects<br />
        - A simple and amateurish Cel-Shader.<br /><br />


        The project is rather messy, and it was sort of abandoned following the completion of the course, since I opted to move on to other projects of a similar vain.<br />

        Source code can be found on my GitHub, by following the link above.<br /><br />

        The main shaders are found within the files:<br />
        "SimpleWater.gdshader"<br />
        "refractiveIce.gdshader<"br />
        "ToonShader.gdshader"<br />
        "CelShader.gdshader"<br />
        "fireball.gdshader"<br />
        "MagicOrb.gdshader"<br />
        `;
    }


    if(value == "p1")
    {
        currentProject = "p1";
        imageIndex = 0;
        showSlides(imageIndex, currentProject);
        //changeImage("public/images/ScoringTool/ScoringTool1.png");
        changeLink("https://github.com/Destrea/Mahjong-Scoring-Tool", "https://youtu.be/XOf0tsTe2aU");
        document.getElementById("projectName").innerHTML = "Mahjong Scoring Calculator";
        document.getElementById("projectDate").innerHTML = "Date: January 2025 - August 2025";
        document.getElementById("descrText").innerHTML = `In January 2025 I was working in the Godot Game engine, and I decided that I wanted to learn how it's UI features worked. Alongside this, I had been learning to play Riichi Mahjong for roughly 6 months. This is a game with notoriously complex rules, and a very long list of scoring hands known as "Yaku" that reward you with points upon their formation. These Yaku can be combined with one another, and contribute different amounts of score. Because of this, I figured that making a scoring calculator would be a great test of learning Godot's UI features, as well as learning the rules and scoring for Riichi Mahjong more thoroughly. <br /><br />

        This calculator handles all of the most common Yaku, uses an algorithm I created to detect them accurately from a selected hand of 14 tiles, and can output roughly what the final score of the hand will be. All of the standard Yaku that dont rely on "Waits" are implemented properly, and can be combined with others. The two standard Yaku that isn't currently implemented as a result is "Pinfu", as it requires a Ryanmen wait. Aside from this, there is one other standard yaku and one high scoring "Yakuman" that arent handled correctly either, since the algorithm doesnt currently support more than 14 tiles, causing it to not be compatible with detecting "kan" (quad) calls. As a result, it can't detect Sankantsu (three quads) and Suukantsu (four quads). <br /><br />

        Aside from these stipulations, the calculator handles everything else procedurally and outputs an itemized list of the Yaku it detects, their "han" value, and the final calculated score that the hand is valued at. I'd like to return to this project at some point, and maybe remake it in Javascript instead so that it can be hosted here, and support the missing features, and fix any remaining inconsistencies with it's scoring, since it's still got some weird edge cases. <br /><br />

        As with my other projects, you can find this Mahjong Scoring Calculator in a repository on my github, and it comes with pre-compiled Windows and linux builds, or it can be compiled or used manually by opening the project file directly in the free Godot Game engine.


        <br />
        `;
    }

    if(value == "p2")
    {
        currentProject = "p2";
        imageIndex = 0;
        showSlides(imageIndex, currentProject);
        //changeImage("public/images/ReShade/Shader3BitClose.png");
        changeLink("https://github.com/Destrea/DestreaFX", "https://youtu.be/JB2X-bTES90");
        document.getElementById("projectName").innerHTML = "ReShade Shader Effects";
        document.getElementById("projectDate").innerHTML = "Date: May 2025 - Current";
        document.getElementById("descrText").innerHTML = `Following my time working on the "Godot Shaders Exploration" project in Spring 2025, I began exploring how I could continue learning about shader techniques within the context of games, closer to how it's done in actual graphics APIs, and with "quicker" visual feedback. <br /><br />

        My next step up was creating shaders for ReShade. I'm an avid Final Fantasy XIV player, and I figured that ReShade would be a nice next step, since creating shaders for it would allow me to take more interesting screenshots, and allow me to enjoy my hard work as well! <br /><br />

        To begin, I wanted to port my existing shaders from the Godot Shaders project into the ReShade language, which is similar in syntax to HLSL. This proved to be a process, as my outline shader uses the Sobel Operation which required access to the depth and normal buffers, which ReShade doesn't have direct access to, without preprocessing definitions. To solve this, I used an existing shader that comes packed with ReShade (DisplayDepth.fx) to help get everything set up properly. This shader can be found on the github repository as "DestreaFX_EdgeDetection.fx".<br /><br />

        Alongside this I created a shader that provided a color-palette swap, and optionally a posterization pass, by taking in a user-determined color palette, and finding the closest color, using a simple difference calculation: distance = dot( final_color - palette[index], final_color - palette[index]). <br /> This, I found, isn't the most accurate way to determine which color is the closest, and I would implement in the next shader I'll talk about. This color-palette swapper can be found as "DestreaFX_ColorPalette.fx". <br /><br />

        Lastly, my most recent shader was a many-in-one Ordered Dithering shader. This ended up being a much larger project, and became the "successor" to my color-palette swap shader, since it's executed much better. It uses a Bayer Ordered dither, adapted from Joel Yliluoma's implementation, to create many different types of effects. These range from two-color dithering (Custom colors, and Black/white), 8 color custom palette, a procedural monochrome palette, and my favorite, a "3-Bit RGB" dither, using the old 3-Bit color palette to re-create the original colors of the image. This is the shader I'm most proud of, and I still have ideas on what I can add to it, but for all intents and purposes, it's ready to be used! This dithering shader can be found as "DestreaFX_Dither.fx". <br /><br />

        Once again, all of these shaders can be found at the github repository linked above, and I'd love to discuss any of them in more detail as well. <br />
        `;
    }

    if(value == "p3")
    {

        currentProject = "p3";
        imageIndex = 0;
        showSlides(imageIndex, currentProject);

        //TODO: Add links to all of the Dependencies.
        //changeImage("public/images/GameEngine/Engine1.png");
        changeLink("https://github.com/Destrea/Interloper-Engine", "");
        document.getElementById("videoDiv").style.display = "none";
        document.getElementById("projectName").innerHTML = "Interloper Game Engine";
        document.getElementById("projectDate").innerHTML = "Date: August 2025 - Current";
        document.getElementById("descrText").innerHTML = `The intent behind making the Interloper Game Engine was a goal to piggyback off my initial intent with making the ReShade shaders, to learn how a graphics API works, and what it's role is in game development. I began by learning OpenGL, using "learnOpenGL.com", and quickly found out that I loved the process. This then began a long term project of creating my own game engine so that I can make my own games in it. I've really loved working on this project alongside my college courses, anytime I've found the time to work on it. <br /> <br />

        This is admittedly a very ambitious project, and after working on the project from August to November 2025 without any sort of plan or guidance, I found that my codebase was a mess and really needed a rework. So I decided to restructure everything before it got out of hand. To do so, I began by using the game engine development series by "The Cherno" on YouTube as a baseline for learning what I needed to know about each component of a game engine, and how you can go about creating them. Using this series and "Game Engine Architecture" by Jason Gregory, I've reworked the entire engine, and its features, to accomodate a typical 3D editor workflow, an Entity Component system, a (comparatively) streamlined rendering pipeline, and more. <br /> <br />

        This game engine is definitely still a work in progress, and will continue to be for the forseeable future. That said, I've got a roadmap of features that I want completed before I begin developing a game using this engine, and any features that the game requires will be added to the engine to accomodate it. <br /> <br />

        Currently, the engine features:<br />
        - A 3D editor window <br />
        - Entity Component System<br />
        - Resource Management (Shaders, 3D Models/Meshes, Textures)<br />
        - Input Management <br />
        - Native C++ Scripting <br /><br />

        My current roadmap before developing a game still requires: <br />
        - Complete scene serialization and deserialization <br />
        - Flying Editor camera, and 3D gizmos <br />
        - 3D collision detection and resolution <br />
        - Simple raycast functionality <br />
        - Audio management <br /><br />


        Project Dependencies: <br />
        - glfw3 <br />
        - glm <br />
        - stb_image.h <br />
        - glad <br />
        - Assimp <br />
        - Entt <br />
        - Dear ImGui <br />
        - YAML cpp <br /> <br />




        I'm having so much fun working on this engine, and I can't wait to begin developing games with it.<br />
        It's entire codebase can be found on my github repository found linked above. The engine is compatible with Windows and Linux, with instructions on the repo for installation and building. <br />

        <br />
        `;
    }


    if(value == "p4")
    {
        currentProject = "p4";
        imageIndex = 0;
        showSlides(imageIndex, currentProject);
        //TODO: Add either an image for the website, or
        //changeImage("public/images/Website1.png");
        changeLink("https://github.com/Destrea/destrea.dev");
        document.getElementById("videoDiv").style.display = "none";
        document.getElementById("projectName").innerHTML = "Portfolio Website";
        document.getElementById("projectDate").innerHTML = "Date: Feb 2026 - Current";
        document.getElementById("descrText").innerHTML = `I created this website for two major reasons. First, I wanted a website where I could show off all of my portfolio projects, so that they're out in the open for anyone who's interested in any of my projects, and when they were made. Secondly, I wanted to toy around with HTML, CSS and JavaScript to create a website where I can create and host any tools or projects that would work really well hosted on a website, such as tools that utilize API calls to provide a service for anyone interested. <br /><br />

        This website was made primarily using HTML, CSS and Javascript, and the background was made using a WebGL shader that I wrote, and it has options in the settings menu to manipulate the settings and play with. My goal for the design was make everything by hand to have complete control, and to take inspiration from late '90s and early 2000s design. My initial idea was to make each component of the website a window that can be manipulated and closed like you would a window on an Operating System. Fonts were chosen to follow this design as well. <br /><br />

        As time goes on, more projects and features will be added, and some of the design may change, but the design ideology will remain the same going forward. Additionally, I plan to add a new window, or a new page that houses a development blog for my various project, with my game engine and game development being the main focus.<br />
        `;
    }


}




function changeImage(a)
{
    document.getElementById("contentImg").src = a;
}

function changeLink(a,b)
{
     document.getElementById("projectGithub").href = a;
     document.getElementById("videoDemonstration").href = b;
}


function closeWindow(elem)
{
    if(elem.parentNode.parentNode.id == "navigationWindow")
    {

        let loadedCookie = document.cookie;
        if(loadedCookie.includes("cookiesAccepted=true"))
        {
            document.cookie = "tutorialSeen=true";
        }
    }

    elem.parentNode.parentNode.style.display = "none";
}

function cookieLoading()
{
    let loadedCookie = document.cookie;
    if(!loadedCookie.includes("modalClosed=true"))
    {
        document.getElementById("modalDisclaimer").style.display = "flex";
         document.getElementById("modalWin").style.display = "flex";
    }
    if(!loadedCookie.includes("tutorialSeen=true"))
    {
        document.getElementById("navigationWindow").style.display = "flex";
    }
}

function getCookie()
{
    let loadedCookie = document.cookie;
    console.log(loadedcookie);
}

function closeModal()
{
    document.getElementById("modalDisclaimer").style.display = "none";
    document.getElementById("modalWin").style.display = "none";
    document.cookie = "modalClosed=true";
    document.cookie = "cookiesAccepted=true";
}

function declineCookies()
{
    document.getElementById("modalDisclaimer").style.display = "none";
    document.getElementById("modalWin").style.display = "none";
}


var prevModifier = 0;
var prevFontSetting = 1;
var fontSetting = 1;
function changeFontSize(value)
{
    prevFontSetting = fontSetting;

    var modifier = 0;
    //Small
    if(value === 1)
    {
        fontSetting = value;
        modifier = 0;
    }
    if(value === 2)
    {
        fontSetting = value;
        modifier = 5;
    }
    if(value === 3)
    {
        fontSetting = value;
        modifier = 10;
    }


    var elems = document.querySelectorAll('*');

    for (var i=elems.length; i--;) {
        var f_size = getComputedStyle(elems[i]).fontSize;
        var numb   = f_size.replace(/\D/g,''); // the number
        var val    = f_size.replace(/\d/g,''); // px

        elems[i].style.fontSize = (+numb + modifier - prevModifier) + val;
    }
    prevModifier = modifier;
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
    checkAspectRatio();
    //Run Mobile Javascript events here




} else {
    debugText.innerHTML = "device is NOT mobile";

    //Run Desktop Javascript events here

}


function checkAspectRatio()
{
    let aspectRatio = window.innerWidth / window.innerHeight;
    devAspectRatio.innerHTML = Math.round((9 / aspectRatio)*10)/10;

}



