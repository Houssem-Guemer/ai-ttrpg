const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveImage: (payload) => ipcRenderer.invoke("save-image", payload),
  onDataUpdated: (callback) => {
    if (typeof callback !== "function") return;
    const wrapped = () => callback();
    ipcRenderer.on("data-updated", wrapped);
  }
});
