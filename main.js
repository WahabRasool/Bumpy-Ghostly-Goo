import GLea from 'https://esm.sh/glea';

// enables code highlighting for glsl code (in theory ;).
const glsl = x => x

const frag = glsl`
precision highp float;
#define ITERS 64
#define PI 3.141592654
uniform float width;
uniform float height;
uniform float time;

// normalize coords and correct for aspect ratio
vec2 normalizeScreenCoords()
{
  float aspectRatio = width / height;
  vec2 result = 2.0 * (gl_FragCoord.xy / vec2(width, height) - 0.5);
  result.x *= aspectRatio; 
  return result;
}

// by IQ
// cosine based palette, 4 vec3 params
vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
  return a + b*cos( 6.28318*(c*t+d) );
}

// by IQ
// 0.5, 0.5, 0.5		0.5, 0.5, 0.5	1.0, 1.0, 1.0	0.30, 0.20, 0.20
vec3 palette(float t) {
  float i1 = sin(t * .5);
  float i2 = sin(t * .3);
  vec3 a = vec3(0.5, 0.5, .5);
  vec3 b = vec3(0.5, .5, .5);
  vec3 c = vec3(1., 1.0, 1.0);
  vec3 d = vec3(0.30, 0.20, 0.20);
  return pal(t, a, b, c, d);
}


float rand(vec2 c){
	return fract(sin(dot(c.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float noise(vec2 p, float freq ){
	float unit = width/freq;
	vec2 ij = floor(p/unit);
	vec2 xy = mod(p,unit)/unit;
	//xy = 3.*xy*xy-2.*xy*xy*xy;
	xy = .5*(1.-cos(PI*xy));
	float a = rand((ij+vec2(0.,0.)));
	float b = rand((ij+vec2(1.,0.)));
	float c = rand((ij+vec2(0.,1.)));
	float d = rand((ij+vec2(1.,1.)));
	float x1 = mix(a, b, xy.x);
	float x2 = mix(c, d, xy.x);
	return mix(x1, x2, xy.y);
}

float pNoise(vec2 p, int res){
	float persistance = .5;
	float n = 0.;
	float normK = 0.;
	float f = 4.;
	float amp = 1.;
	int iCount = 0;
	for (int i = 0; i<50; i++){
		n+=amp*noise(p, f);
		f*=2.;
		normK+=amp;
		amp*=persistance;
		if (iCount == res) break;
		iCount++;
	}
	float nf = n/normK;
	return nf*nf*nf*nf;
}

// Calculate cameras "orthonormal basis", i.e. its transform matrix components
vec3 getCameraRayDir(vec2 uv, vec3 camPos, vec3 camTarget) {
  vec3 camForward = normalize(camTarget - camPos);
  vec3 camRight = normalize(cross(vec3(0.0, 1.0, 0.0), camForward));
  vec3 camUp = normalize(cross(camForward, camRight));
     
  float fPersp = 2.0;
  vec3 vDir = normalize(uv.x * camRight + uv.y * camUp + camForward * fPersp);
 
  return vDir;
}

// distance function for a sphere
float sphere(vec3 p, float r)
{
    return length(p) - r;
}

float deformation(vec3 pos) {
  return sin(time * .1) * 0.6 * sin(time * .3 + pos.x * 1.9 * sin(pos.y + time* .1)) * 
    sin(time *.2 + pos.y * 2.7) * 
    sin(time * .3 + pos.z * 1.5);
}

float scene(vec3 pos)
{
  float t = sphere(pos - vec3(0.0, 0.0, 10.0), 3.0) + deformation(pos);   
  return t;
}

vec3 calcNormal(vec3 pos) {
  vec2 eps = vec2(0.0, 1.);
  // find the normal of the surface
  return normalize(vec3(
    scene(pos + eps.yxx) - scene(pos - eps.yxx),
	  scene(pos + eps.xyx) - scene(pos - eps.xyx),
	  scene(pos + eps.xxy) - scene(pos - eps.xxy)
  ));
}

// cast a ray along a direction and return 
// the distance to the first thing it hits
// if nothing was hit, return -1
float castRay(vec3 rayOrigin, vec3 rayDir)
{
  float t = 0.0; // Stores current distance along ray
  for (int i = 0; i < ITERS; i++)
  {
    float res = scene(rayOrigin + rayDir * t);
    if (res < (0.001*t))
    {
        return t;
    }
    t += res;
  }
  return -1.0;
}

vec3 background() {
  vec2 p = normalizeScreenCoords();
  return vec3(p.x * .01,0.,-p.y*.5);
}

// Visualize depth based on the distance
vec3 render(vec3 rayOrigin, vec3 rayDir, vec3 col0)
{
  float t = castRay(rayOrigin, rayDir);
  if (t == -1.0) {
    return vec3(0);
  }
  //vec3 col0 = vec3(1);
  // vec3 col = vec3(.9 - (4.5 - t * 0.45)) * palette(t * .4);
  
  vec3 p = rayOrigin + rayDir * t;
  vec3 norm = calcNormal(p);
  float diffuse = max(0.0, dot(-rayDir, norm));
  float specular = pow(diffuse, 2.0);
  vec3 col = vec3(.1) * col0 + vec3(diffuse *.2 + specular) * (col0 + .2 *sin(diffuse * rayDir.y * rayDir.x));
  
  return col;
}


void main() {
  vec3 camPos = vec3(0, 0, -1.0);
  vec3 camPos1 = camPos + .03 * sin(time * .1);
  vec3 camTarget = vec3(0);
  vec2 uv = normalizeScreenCoords();
  vec3 rayDir = getCameraRayDir(uv, camPos, camTarget);
  vec3 col0 = background();
  vec3 col1 = render(camPos, getCameraRayDir(uv, camPos, camTarget), vec3(.7, .1, .2));
  vec3 col2 = render(camPos1, getCameraRayDir(uv, camPos1, camTarget), vec3(.4, .1, .7));
  gl_FragColor = vec4((col0 + col1 + col2), 1.0);
}
`

export const vert = glsl`
precision highp float;
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const glea = new GLea({
  shaders: [
    GLea.fragmentShader(frag),
    GLea.vertexShader(vert)
  ],
  buffers: {
    'position': GLea.buffer(2, [1, 1,  -1, 1,  1,-1,  -1,-1])
  }
}).create();

window.addEventListener('resize', () => {
  glea.resize();
});

function loop(time) {
  const { gl } = glea;
  glea.clear();
  glea.uni('width', glea.width);
  glea.uni('height', glea.height);
  glea.uni('time', time * .005);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(loop);
}

loop(0);
