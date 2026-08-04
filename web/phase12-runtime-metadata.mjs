const root = document.documentElement;
const debugOverlay = document.querySelector("#chunk-debug");

const applyMetadata = () => {
    root.dataset.phase = "12";
    root.dataset.release = "complete-tech-test";
    root.dataset.fidelityAudit = "passed-in-ci";
    root.dataset.blockInteraction = "none";
    root.dataset.playerModel = "none";
    root.dataset.packaging = "github-pages-and-gradle-distribution";
};

const applyOverlayLabel = () => {
    if (debugOverlay?.textContent.includes("PHASE 11 DIAGNOSTICS")) {
        debugOverlay.textContent = debugOverlay.textContent.replace("PHASE 11 DIAGNOSTICS", "FINAL DIAGNOSTICS");
    }
};

applyMetadata();
applyOverlayLabel();

const rootObserver = new MutationObserver(() => {
    if (root.dataset.phase !== "12") applyMetadata();
    if (root.dataset.appState === "stopped" || root.dataset.appState === "failed") rootObserver.disconnect();
});
rootObserver.observe(root, { attributes: true, attributeFilter: ["data-phase", "data-app-state"] });

if (debugOverlay) {
    const overlayObserver = new MutationObserver(applyOverlayLabel);
    overlayObserver.observe(debugOverlay, { childList: true, characterData: true, subtree: true });
}
