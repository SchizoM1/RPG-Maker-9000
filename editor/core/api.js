// api.js — access to the Electron preload bridge (window.rpg9k).
export const api = window.rpg9k;

export function projectUrl(rel) {
    return "rpg9k://project/" + rel.split("/").map(encodeURIComponent).join("/");
}
