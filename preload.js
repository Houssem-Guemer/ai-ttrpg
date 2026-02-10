const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveImage: (payload) => ipcRenderer.invoke("save-image", payload)
});
