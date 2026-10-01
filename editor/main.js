// main.js — editor entry point.
import { App } from "./app.js";

window.rpg9kEditor = true;

window.addEventListener("error", e => console.error("Editor error:", e.message, e.error));
window.addEventListener("unhandledrejection", e => console.error("Editor rejection:", e.reason));

const app = new App(document.getElementById("app"));
window.__app = app; // handy for debugging and automated tests
app.init();
