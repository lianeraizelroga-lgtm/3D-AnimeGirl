//testing faces
document.querySelectorAll(".test-faces button").forEach((btn) => {
  btn.addEventListener("click", () => setEmotion(btn.dataset.emo));
});

//testing animation
document.querySelectorAll(".test-animation button").forEach((btn) => {
  btn.addEventListener("click", () => playAnim(btn.dataset.anim));
});

//for animations
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from "@pixiv/three-vrm-animation";

//for the scene, rendering, camera, and lighting 
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

let mixer = null;

let isAnimating = false;

function playAnim(file) {
  if (!file) return; // no file = do nothing (e.g. typo in the key)
  loader.load(file, (gltf) => {
    const clip = createVRMAnimationClip(gltf.userData.vrmAnimations[0], vrm);

    if (!mixer) {
      mixer = new THREE.AnimationMixer(vrm.scene);
      // runs every time an animation finishes
      mixer.addEventListener("finished", () => {
        mixer.stopAllAction();
        isAnimating = false;
        restPose();
      });
    }

    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce); // play once, not forever
    action.reset().play();
    isAnimating = true;
  });
}

function restPose() {
  bone("leftUpperArm").rotation.set(0, 0, -1.1);
  bone("rightUpperArm").rotation.set(0, 0, 1.1);
}

const canvas = document.querySelector("#stage");
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 20); //30 (changed to 42) is zoom-in angle, bigger number means pwede ma zoom-out
camera.position.set(-0.3, 1.00, 2.5); // x, y (height), z (distance). where the camera stands. can be tweaked to adjust waist-up shot
const light = new THREE.DirectionalLight(0xffffff, Math.PI);
light.position.set(1, 1, 1);
scene.add(light);

//for screen adaptability ng VRoid model
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);  
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);  // also handles rotating the tablet

if (camera.aspect < 0.8) {
  camera.position.z = 3.9;
} else {
  camera.position.z = 2.5;
}
camera.updateProjectionMatrix();

//For loading the VRM
let vrm = null;
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
//free animations
loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
//for normal arms, para di naka t-pose
const bone = (name) => vrm.humanoid.getNormalizedBoneNode(name);

loader.load("models/nyann.vrm", (gltf) => {
  vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm); // only turns her around if the file is old VRM 0.x
  scene.add(vrm.scene);
  bone("leftUpperArm").rotation.z = -1.2;
  bone("rightUpperArm").rotation.z = 1.2;
});

//for blinking
//random yung full blink na 0.16 (half 0.08 for opening value approaching 0, and another half for closing value approaching 1)
let blinkTimer = 0;
let nextBlink = 3;

function updateBlink(delta) {
    //t means time, 0.08 is 0.08 seconds, mathrandom ay para random yung pagwait ng seconds every 2-6 seconds
  blinkTimer += delta;
  if (blinkTimer > nextBlink) {
    const t = blinkTimer - nextBlink; // seconds into the blink
    const value = t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.08) / 0.08);
    //? shorthand ng if else, if t lower than 0.08 mangyayari ang t / 0.08 (closing), yung else naman ay opening
    vrm.expressionManager.setValue("blink", value);
    if (t > 0.16) { blinkTimer = 0; nextBlink = 2 + Math.random() * 4; }
  }
}

//for breathing and swaying
//Math.sin (yung sa sin cos tan) goes smoothly up and down between -1 and 1 forever, which is exactly what breathing looks like. 
function updateIdle() {
  const t = clock.elapsedTime;
  bone("leftUpperArm").rotation.x = Math.sin(t * 1.7) * 0.05; // breathing
  bone("rightUpperArm").rotation.x = Math.sin(t * 1.9) * 0.03; // breathing
  bone("spine").rotation.x = Math.sin(t * 1.8) * 0.03; // breathing
  bone("hips").rotation.y  = Math.sin(t * 0.8) * 0.04; // slow sway
  bone("head").rotation.z  = Math.sin(t * 0.10) * 0.03; // tiny head tilt
}


//the animation loop
//The screen gets redrawn about 60 times per second. delta is how many seconds passed since the last frame, so movement stays the same speed on fast and slow laptops. vrm.update(delta) is required; without it expressions won't apply.
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta(); 
  if (vrm) {
    if (current.happy < 0.7)
    {
        updateBlink(delta) 
    }
    updateFace(delta) 
    if (!isAnimating) updateIdle();   // no breathing during animations
    if (mixer) mixer.update(delta);   // animation moves the bones...
    vrm.update(delta);                // ...then vrm applies them
  }
  renderer.render(scene, camera);
}
animate();

// Eto naman ay yung para sa study ng discrete structures, nagbabago yung images/emotion pictures ni Nyann base sa keyword na sasabihin niya (nilagay ko yung instruction about sa keyword sa system prompt niya)

const FACES = ["happy", "angry", "sad", "relaxed", "surprised"];

const emotionMap = {
  "neutral":             {},
  "blush_or_sly_smile":  { happy: 0.5 },
  "full_grin":           { happy: 1.0 },
  "worried_shocked":     { sad: 1.0, surprised: 0.5 },
  "sad":                 { sad: 1.0, angry: 0.3 },
  "angry":               { angry: 1.0, happy: 0.3},
  "annoyed_or_frustrated":{ angry: 1, sad: 0.6 },
  "offended_or_indignant":{ angry: 1, surprised: 0.6 },
  "happy_surprised":     { surprised: 0.5 },
  "full_surprised":      { surprised: 1.0 },
  "small_smile":         { relaxed: 1.0 },
  "annoyed_or_pout":     { happy: 0.5, angry: 1 }, 
  "surprised_scared":    { surprised: 1, sad: 0.8 },
  "amazed_or_delighted": { happy: 0.7, surprised: 0.8 }, 
  "yawn":                { surprised: 0.8, happy: 1 },
  "touched_or_moved":     { sad: 0.7, happy: 0.5 },
  "worried_sad":          { sad: 0.7, relaxed: 0.2 },
  "confused_or_thinking": { happy: 0.7, angry: 0.5 },     // "hmm?" when you ask her something tricky
  "embarrassed_or_shy":   { surprised: 0.3, happy: 0.4, sad: 0.5 },         // awkward/shy smile, "ehehe..."
  "smug_or_proud":        { happy: 0.6, angry: 0.4, surprised: 0.3 },       // "told you so~" 
  "excited":              { happy: 1.0, surprised: 0.8 },   // "OMG REALLY?!"
  "sleepy_or_tired":      { happy: 0.5, sad: 0.7 },       // for your 2AM study chats
  "unimpressed_or_bored": { sad: 0.5, angry: 0.3 },     // the deadpan "...okay." face
  "disgusted":            { angry: 0.8, sad: 0.7, surprised: 0.5 }         // "ew, pineapple pizza"
  
};

const actionMap = { //for the free animations to get triggered
  "greeting":        "animations/greeting.vrma",
  "peace_sign":      "animations/peace_sign.vrma",
  "spin":            "animations/spin.vrma",
  "finger_gun_pose": "animations/finger_gun_pose.vrma",
  "model_pose":      "animations/model_pose.vrma",
  "show_fullbody":   "animations/show_fullbody.vrma",
  "squat":           "animations/squat.vrma",
};

let target = {}; // the face we want
const current = { happy: 0, angry: 0, sad: 0, relaxed: 0, surprised: 0 };

function setEmotion(name) {
  target = emotionMap[name] || emotionMap["neutral"];
}

function updateFace(delta) {
  FACES.forEach((f) => {
    const goal = target[f] || 0;
    current[f] += (goal - current[f]) * Math.min(1, delta * 6); // 6 = speed
    vrm.expressionManager.setValue(f, current[f]);
  });
}
