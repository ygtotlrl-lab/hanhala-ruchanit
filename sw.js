// sw.js — service worker של האפליקציה
importScripts('./app.config.js');
// מכאן נגזרת גרסת האפליקציה שבבאנר.
var CACHE_NAME = self.APP.id + '-v276';

var CORE = [
  './',
  './index.html',
  './app.config.js',
  './core/boot.js',
  './core/sw.js',
  './core/ui.css',
  './app/style.css',
  './app/style.screens.css',
  './core/util.js',
  './core/sync.js',
  './core/storage.js',
  './core/mirror.js',
  './core/backup.js',
  './core/boot-run.js',
  './core/auth.js',
  './core/ui.js',
  './core/hebrew.js',
  './app/constants.js',
  './app/state.js',
  './app/domain.js',
  './app/domain.hebdate.js',
  './app/domain.sessions.js',
  './app/domain.arc.js',
  './app/domain.sup.js',
  './app/domain.reg.js',
  './app/screens/attend.js',
  './app/screens/home.js',
  './app/screens/login.js',
  './app/screens/settings.js',
  './app/screens/sleep.js',
  './app/screens/students.js',
  './app/main.js',
  './manifest.json',
  './icons/icon-192.aad94dba.png',
  './icons/icon-512.092edf48.png'
];

// האפליקציה אינה רצה בלי supabase — createClient זורק והסקריפט המוטבע כולו נעצר
var CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/pdfmake@0.3.11/build/pdfmake.min.js',
  'https://cdn.jsdelivr.net/npm/pdfmake@0.3.11/build/vfs_fonts.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

importScripts('./core/sw.js');
