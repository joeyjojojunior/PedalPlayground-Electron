// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, globalShortcut } = require('electron');
const { dialog } = require('electron');
const electron = require('electron');
const ipcMain = electron.ipcMain;
const path = require('path');
const fs = require('fs');

// Enable live reload for Electron too
require('electron-reload')(__dirname, 
  {
    // Note that the path to electron may vary according to the main file
    electron: require(`${__dirname}/node_modules/electron`),
    ignored: /presets|[\/\\]\./
  }
);

const presetDir = "./presets/"
let isDialogOpen = false;


const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1480,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
  })

  // and load the index.html of the app.
  mainWindow.loadURL('http://127.0.0.1:8080/index.html');
  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {

    ipcMain.on('save-preset', (event, preset, presetName) => {
      fs.mkdir(presetDir, e => {
        if (e && e.code === 'EEXIST') {
          console.log("Directory already exists.");
        } else if(e) {
            console.error(e);
        } else {
            console.log('Success');
        }
        const fileName = (presetName.length > 0) ? presetName.replaceAll(' ', '_') : "unnamed_preset";
        fs.writeFile(`./presets/${fileName}.json`, preset, function (err) {
        if (err) {
            console.error(err)
            return
        }
        event.reply('save-preset-saved', "Canvas Saved to file!");
      }); 
      });   
    });
  });


  ipcMain.on('load-preset', (event) => {
    console.log("gap: " + app.getAppPath());

    if (!isDialogOpen) {
      isDialogOpen = true;
      dialog.showOpenDialog({
          title: "Select a preset...",
          properties: ['openFile'],
          defaultPath: `${app.getAppPath()}/presets`,
          filters: [
            {
              "name": "json",
              "extensions": ["json"]
            },
          ]
      }).then((pathObj) => {
          if (!pathObj.canceled) {              
              let filePath = pathObj.filePaths[0]
              fs.readFile(filePath, 'utf8', (err, preset) => {
                if (err) {
                    console.error(err)
                    return
                }
                event.reply('load-preset-loaded', preset);
              })
          }
          isDialogOpen = false;
      });
    }
  });
 



  // Open the DevTools. 
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })



})

app.on('browser-window-blur', function () {
  globalShortcut.unregister('CommandOrControl+R');
  globalShortcut.unregister('F5');
});

app.on('browser-window-focus', function () {
  globalShortcut.register("CommandOrControl+R", () => {
      console.log("CommandOrControl+R is pressed: Shortcut Disabled");
  });
  globalShortcut.register("F5", () => {
      console.log("F5 is pressed: Shortcut Disabled");
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.