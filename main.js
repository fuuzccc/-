const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(app.getPath('userData'), 'data');
const FILES = {
  tasks: path.join(DATA_DIR, 'tasks.json'),
  goals: path.join(DATA_DIR, 'goals.json'),
  notes: path.join(DATA_DIR, 'notes.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

let mainWindow = null;
let tray = null;
let isQuitting = false;
let reminderTimer = null;
let notifiedKeys = new Set();
