// 오프라인에서도 열리도록 앱 파일을 저장해 두는 서비스워커
const CACHE = "ansimgil-v5";
const FILES = [
 "./",
 "index.html",
 "app.js",
 "runtime.js",
 "manifest.webmanifest",
 "assets/PretendardVariable.woff2",
 "assets/logo.png",
 "assets/map_A.svg",
 "assets/map_B.svg",
 "assets/map_C.svg",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png"
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => { e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request))); });
