/* 专注力训练营 — Electron 预加载脚本
   向页面暴露 window.__fileStore，用于把数据镜像到本地文件。纯网页打开时不存在，自动降级。 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__fileStore', {
  load: () => ipcRenderer.sendSync('fs-load'),
  save: (json) => ipcRenderer.sendSync('fs-save', json),
  openFolder: () => ipcRenderer.send('fs-open-folder')
});
