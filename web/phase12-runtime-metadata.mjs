const root = document.documentElement;
const apply = () => {
    root.dataset.phase = "12";
    root.dataset.release = "complete-tech-test";
    root.dataset.fidelityAudit = "required";
    root.dataset.blockInteraction = "none";
    root.dataset.playerModel = "none";
    root.dataset.packaging = "github-pages-and-gradle-distribution";
};

apply();
const observer = new MutationObserver(() => {
    if (root.dataset.phase !== "12") apply();
    if (root.dataset.appState === "stopped" || root.dataset.appState === "failed") observer.disconnect();
});
observer.observe(root, { attributes: true, attributeFilter: ["data-phase", "data-app-state"] });
