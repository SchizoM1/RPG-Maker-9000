//=============================================================================
// main.js — boots the game after all runtime scripts and plugins load.
//=============================================================================
"use strict";

(function() {
    function showError(e) {
        console.error(e);
        const div = document.createElement("div");
        div.style.cssText = "color:#fff;font:16px sans-serif;padding:24px;white-space:pre-wrap";
        div.textContent = "Failed to start the game:\n" + (e && e.stack ? e.stack : e);
        document.body.appendChild(div);
    }

    function start() {
        EffekseerRenderer.initialize()
            .catch(() => 0)
            .then(() => PluginManager.setup(typeof $plugins !== "undefined" ? $plugins : []))
            .then(() => {
                PluginManager.checkErrors();
                SceneManager.run(Scene_Boot);
            })
            .catch(showError);
    }

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start);
})();
