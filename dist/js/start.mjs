import("./app.mjs").catch(() => {
  const status = document.querySelector("#status");
  status.textContent =
    "The journal could not load. Check your connection and reload.";
  const retry = document.createElement("button");
  retry.textContent = "Reload journal";
  retry.onclick = () => location.reload();
  status.append(" ", retry);
});
