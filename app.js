/**
 * RocketLab Link - Application Logic
 * Powered by LocalStorage & IndexedDB (Single Page Application Model)
 */

class RocketLabApp {
    constructor() {
        // App State
        this.db = null;
        this.currentUser = null;
        this.activeTab = 'chat';
        this.currentChannelId = 'general';
        this.currentStoragePath = '/';
        this.activeChatAttachment = null;
        this.chartInstance = null;
        this.activeSimHtml = '';
        
        // Virtual File Explorer Clipboard
        this.clipboardItem = null;
        this.clipboardAction = null;
        
        // Chat send submit lock
        this.isSendingMessage = false;
        
        // Firebase Cloud Realtime Database state
        this.fbRef = null;
        this.isFirebaseConnected = false;
        this.fbListeners = [];
        this.firebaseConfig = null;
        this.defaultFirebaseConfig = {
            databaseURL: "https://palrocketchat.asia-southeast1.firebasedatabase.app/"
        };
        
        // Allowed Names for Registration
        this.allowedNames = ['윤은준', '하선효', '허단', '홍서준', '황인홍', '최준성'];
        this.adminNames = ['허단', '최준성', '황인홍'];
        this.adminEmail = 'ramlok@naver.com';

        // Predefined channels
        this.channels = [
            { id: 'notice', name: '공지사항', desc: '관리자가 작성하는 공지사항 채널입니다. (일반 유저는 읽기만 가능)', readOnly: true },
            { id: 'general', name: '자유대화', desc: '로켓 설계 및 실험에 대한 자유로운 이야기를 나눕니다.' },
            { id: 'simulation', name: '시뮬레이션-공유', desc: '3D 시뮬레이션 결과와 HTML 실행 데이터를 공유하는 곳입니다.' },
            { id: 'reports', name: '보고서-협업', desc: '비행 기록 보고서 작성 및 검토를 위한 협업 채널입니다.' }
        ];

        // Default CSV / Table template datasets
        this.tableTemplates = {
            blank: {
                headers: ['X 축', '계열 1', '계열 2'],
                rows: [
                    ['1', '10', '20'],
                    ['2', '15', '25'],
                    ['3', '30', '15'],
                    ['4', '22', '35'],
                    ['5', '40', '50']
                ]
            },
            fuel: {
                headers: ['시간(초)', '엔진추력(N)', '설계한계(N)'],
                rows: [
                    ['0.0', '0', '350'],
                    ['0.5', '80', '350'],
                    ['1.0', '240', '350'],
                    ['1.5', '320', '350'],
                    ['2.0', '290', '350'],
                    ['2.5', '180', '350'],
                    ['3.0', '90', '350'],
                    ['3.5', '0', '350']
                ]
            },
            flight: {
                headers: ['비행시간(초)', '도달고도(m)', '속도(m/s)'],
                rows: [
                    ['0', '0', '0'],
                    ['2', '85', '75'],
                    ['4', '320', '140'],
                    ['6', '680', '190'],
                    ['8', '950', '90'],
                    ['10', '1120', '10'],
                    ['12', '1090', '-20'],
                    ['14', '980', '-60'],
                    ['16', '750', '-110']
                ]
            },
            staging: {
                headers: ['시간(초)', '1단 로켓 고도(m)', '2단 로켓 고도(m)'],
                rows: [
                    ['0', '0', '0'],
                    ['2', '120', '120'],
                    ['4', '390', '390'],
                    ['5.0', '550', '550'], /* Staging point */
                    ['6', '610', '780'],
                    ['8', '690', '1120'],
                    ['10', '710', '1350'],
                    ['12', '640', '1420'],
                    ['14', '510', '1380']
                ]
            }
        };

        // Fallback Rocket Simulator HTML string (Fired in iframe if default file fails to fetch)
        this.fallbackSimHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>로켓 발사 시뮬레이터 (Fallback)</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { background: #0c0f1d; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden; }
                    .canvas-container { position: relative; width: 400px; height: 500px; border: 1px solid #1e293b; background: #070913; overflow: hidden; border-radius: 12px; }
                    #rocket { position: absolute; left: 185px; bottom: 20px; width: 30px; height: 70px; background: linear-gradient(to right, #e2e8f0, #cbd5e1); border-radius: 50% 50% 10% 10% / 80% 80% 20% 20%; transition: bottom 0.1s linear; }
                    #rocket::after { content: ''; position: absolute; left: 5px; bottom: -15px; width: 20px; height: 15px; background: transparent; transition: background 0.1s; border-radius: 50%; }
                    .thrusting #rocket::after { background: radial-gradient(circle, #f97316 20%, #ef4444 80%); box-shadow: 0 0 12px #ef4444; }
                    .star { position: absolute; background: white; border-radius: 50%; opacity: 0.8; }
                </style>
            </head>
            <body>
                <h1 class="text-lg font-bold mb-2 text-blue-400">Rocket Engine Test Bed (Fallback Simulator)</h1>
                <div class="canvas-container" id="container">
                    <div id="rocket"></div>
                </div>
                <div class="mt-4 flex gap-3 z-10">
                    <button id="launch-btn" class="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold transition">LAUNCH</button>
                    <button id="reset-btn" class="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-lg font-bold transition">RESET</button>
                </div>
                <div class="mt-2 text-xs text-slate-500" id="telemetry">고도: 0m | 속도: 0m/s</div>
                <script>
                    const rocket = document.getElementById('rocket');
                    const container = document.getElementById('container');
                    const launchBtn = document.getElementById('launch-btn');
                    const resetBtn = document.getElementById('reset-btn');
                    const telemetry = document.getElementById('telemetry');
                    
                    // Spawn stars
                    for(let i=0; i<40; i++) {
                        let star = document.createElement('div');
                        star.className = 'star';
                        star.style.width = Math.random() * 3 + 'px';
                        star.style.height = star.style.width;
                        star.style.left = Math.random() * 400 + 'px';
                        star.style.top = Math.random() * 500 + 'px';
                        container.appendChild(star);
                    }

                    let altitude = 0;
                    let speed = 0;
                    let launched = false;
                    let timer = null;

                    launchBtn.addEventListener('click', () => {
                        if(launched) return;
                        launched = true;
                        container.classList.add('thrusting');
                        let duration = 0;
                        timer = setInterval(() => {
                            duration += 0.05;
                            if(duration < 2.5) { // Thrusting phase
                                speed += 8;
                            } else { // Coasting
                                container.classList.remove('thrusting');
                                speed -= 2; // gravity effect
                            }
                            altitude += speed * 0.1;
                            
                            if (altitude < 0) {
                                altitude = 0;
                                speed = 0;
                                clearInterval(timer);
                                launched = false;
                            }
                            
                            let pixelPos = Math.min(420, 20 + (altitude / 5));
                            rocket.style.bottom = pixelPos + 'px';
                            telemetry.innerText = \`고도: \${Math.round(altitude)}m | 속도: \${Math.round(speed)}m/s\`;
                            
                            if (pixelPos >= 420) {
                                clearInterval(timer);
                                telemetry.innerText = \`궤도 진입 성공! 고도: \${Math.round(altitude)}m | 속도: \${Math.round(speed)}m/s\`;
                            }
                        }, 50);
                    });

                    resetBtn.addEventListener('click', () => {
                        clearInterval(timer);
                        launched = false;
                        altitude = 0;
                        speed = 0;
                        container.classList.remove('thrusting');
                        rocket.style.bottom = '20px';
                        telemetry.innerText = '고도: 0m | 속도: 0m/s';
                    });
                </script>
            </body>
            </html>
        `;
    }

    // Initialize Application
    async init() {
        // Safe clear corrupted/full message backup in localStorage to recover from QuotaExceededError
        localStorage.removeItem('rocket_messages');

        this.initDOM();
        await this.initDatabase();
        this.loadInitialData();
        this.checkSession();
        this.initTheme();

        // Auto-connect to Firebase
        const savedConfig = localStorage.getItem('rocket_firebase_config');
        let configToUse = null;
        if (savedConfig) {
            try {
                configToUse = JSON.parse(savedConfig);
            } catch (err) {
                console.error("Failed to parse saved Firebase config:", err);
            }
        }
        
        // Fallback to default databaseURL config if no saved config exists
        if (!configToUse && this.defaultFirebaseConfig && this.defaultFirebaseConfig.databaseURL) {
            configToUse = this.defaultFirebaseConfig;
        }

        if (configToUse) {
            try {
                await this.connectFirebase(configToUse, true);
            } catch (err) {
                console.error("Failed to auto-connect to Firebase RTDB:", err);
            }
        }
    }

    initDOM() {
        // Form & Input elements binding
        this.loginForm = document.getElementById('auth-login-form');
        this.signupForm = document.getElementById('auth-signup-form');
        this.forgotForm = document.getElementById('forgot-request-form');
        this.chatForm = document.getElementById('chat-send-form');
        this.chatInput = document.getElementById('chat-message-input');
        
        // Tab panels
        this.tabs = {
            chat: document.getElementById('tab-content-chat'),
            table: document.getElementById('tab-content-table'),
            report: document.getElementById('tab-content-report'),
            simulator: document.getElementById('tab-content-simulator'),
            storage: document.getElementById('tab-content-storage'),
            admin: document.getElementById('tab-content-admin')
        };

        // Navigation elements
        this.navButtons = {
            chat: document.getElementById('nav-chat'),
            table: document.getElementById('nav-table'),
            report: document.getElementById('nav-report'),
            simulator: document.getElementById('nav-simulator'),
            storage: document.getElementById('nav-storage'),
            admin: document.getElementById('nav-admin')
        };
    }

    // Initialize Databases (IndexedDB for files/folders/simulators, LocalStorage for state/auth/chat)
    initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('RocketCollaboratorDB', 1);

            request.onerror = (e) => {
                console.error('IndexedDB failed:', e);
                reject(e);
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Create virtual files object store
                if (!db.objectStoreNames.contains('virtualFiles')) {
                    db.createObjectStore('virtualFiles', { keyPath: 'id', autoIncrement: true });
                }
                // Create simulators object store
                if (!db.objectStoreNames.contains('simulators')) {
                    db.createObjectStore('simulators', { keyPath: 'id' });
                }
            };
        });
    }

    // FIREBASE REALTIME DATABASE SYNC SYSTEM
    async connectFirebase(config, quiet = false) {
        const statusBadge = document.getElementById('sync-status-badge');
        const statusDot = document.getElementById('sync-status-dot');
        const statusText = document.getElementById('sync-status-text');

        if (statusText) {
            statusText.innerText = "연결 중...";
            statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping";
        }

        try {
            // Initialize Firebase App
            let fbApp;
            if (firebase.apps.length > 0) {
                fbApp = firebase.app();
            } else {
                fbApp = firebase.initializeApp(config);
            }

            this.fbRef = fbApp.database().ref();
            this.isFirebaseConnected = true;
            this.firebaseConfig = config;
            localStorage.setItem('rocket_firebase_config', JSON.stringify(config));

            // Update Header Status Badge UI
            if (statusBadge && statusDot && statusText) {
                statusBadge.className = "flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-xl text-[11px] font-semibold";
                statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse";
                statusText.innerText = "실시간 클라우드 동기화";
            }

            // Fill Form inputs in Admin panel if present
            const elUrl = document.getElementById('fb-database-url');
            if (elUrl) elUrl.value = config.databaseURL || '';

            // Establish real-time RTDB listeners
            this.setupRealtimeListeners();

            // Auto Migration: check if RTDB is fresh, if so, export local DB to RTDB
            this.fbRef.child('users').limitToFirst(1).once('value').then(snapshot => {
                if (!snapshot.exists()) {
                    console.log("Firebase RTDB is empty. Initiating local data migration...");
                    this.migrateLocalToFirebase();
                }
            }).catch(err => {
                console.error("Migration check failed:", err);
            });

            if (!quiet) {
                alert("☁️ Firebase Realtime Database 실시간 연동 성공!\n모든 데이터가 클라우드 실시간 동기화 모드로 전환되었습니다.");
            }

        } catch (err) {
            console.error("Firebase connection failed:", err);
            this.disconnectFirebase();
            if (!quiet) {
                alert(`❌ Firebase 연결 실패:\n${err.message}\n설정값을 확인해 주세요.`);
            }
        }
    }

    disconnectFirebase() {
        // Clean listeners
        if (this.fbListeners) {
            this.fbListeners.forEach(listener => {
                listener.ref.off(listener.event, listener.callback);
            });
        }
        this.fbListeners = [];

        this.fbRef = null;
        this.isFirebaseConnected = false;
        this.firebaseConfig = null;
        localStorage.removeItem('rocket_firebase_config');

        // Restore status badge UI to local mode
        const statusBadge = document.getElementById('sync-status-badge');
        const statusDot = document.getElementById('sync-status-dot');
        const statusText = document.getElementById('sync-status-text');

        if (statusBadge && statusDot && statusText) {
            statusBadge.className = "flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-[11px] font-semibold text-slate-400";
            statusDot.className = "w-2.5 h-2.5 rounded-full bg-slate-500 animate-pulse";
            statusText.innerText = "로컬 저장소 모드";
        }

        // Clear Admin panel config inputs
        const elUrl = document.getElementById('fb-database-url');
        if (elUrl) elUrl.value = '';

        // Re-render local data
        this.loadInitialData();
        if (this.currentUser) {
            this.switchTab(this.activeTab);
        }
    }

    updateSyncErrorUI(err) {
        console.error("Firebase Sync Error:", err);
        const statusBadge = document.getElementById('sync-status-badge');
        const statusDot = document.getElementById('sync-status-dot');
        const statusText = document.getElementById('sync-status-text');
        if (statusBadge && statusDot && statusText) {
            statusBadge.className = "flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 border border-rose-500/25 text-rose-400 rounded-xl text-[11px] font-semibold";
            statusDot.className = "w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse";
            statusText.innerText = "클라우드 동기화 에러 (연결 상태 확인)";
        }
    }

    setupRealtimeListeners() {
        // Clean existing listeners
        if (this.fbListeners) {
            this.fbListeners.forEach(listener => {
                if (listener.ref && typeof listener.ref.off === 'function') {
                    listener.ref.off(listener.event, listener.callback);
                }
            });
        }
        this.fbListeners = [];

        const registerListener = (ref, event, callback) => {
            const errCallback = err => {
                this.updateSyncErrorUI(err);
            };
            ref.on(event, snapshot => {
                try {
                    callback(snapshot);
                } catch (err) {
                    console.error("Callback crash on ref:", ref ? ref.toString() : 'unknown', err);
                }
            }, errCallback);
            this.fbListeners.push({ ref, event, callback, errCallback });
        };

        // 1. Users Sync
        const usersRef = this.fbRef.child('users');
        registerListener(usersRef, 'value', snapshot => {
            const val = snapshot.val();
            const users = val ? Object.values(val) : [];
            localStorage.setItem('rocket_users', JSON.stringify(users));
            
            const mCountEl = document.getElementById('member-count-val');
            if (mCountEl) mCountEl.innerText = users.length;
            
            if (this.activeTab === 'admin') this.renderAdminUsersList();
            
            // Sync current user session in case role changed
            if (this.currentUser) {
                const updatedMe = users.find(u => u && u.id === this.currentUser.id);
                if (updatedMe && JSON.stringify(updatedMe) !== JSON.stringify(this.currentUser)) {
                    this.currentUser = updatedMe;
                    localStorage.setItem('rocket_session', JSON.stringify(updatedMe));
                    this.showMainApp();
                }
            }
        });

        // 2. Chat Messages Sync
        const messagesRef = this.fbRef.child('messages');
        registerListener(messagesRef, 'value', snapshot => {
            const val = snapshot.val();
            const messages = [];
            if (val) {
                Object.keys(val).forEach(key => {
                    const m = val[key];
                    if (m && typeof m === 'object') {
                        m.id = key; // Use firebase push key as unique ID
                        messages.push(m);
                    }
                });
            }
            messages.sort((a, b) => {
                let tA = 0;
                let tB = 0;
                if (a && a.timestamp) {
                    const d = new Date(a.timestamp).getTime();
                    if (!isNaN(d)) tA = d;
                }
                if (b && b.timestamp) {
                    const d = new Date(b.timestamp).getTime();
                    if (!isNaN(d)) tB = d;
                }
                return tA - tB;
            });
            
            // Save to memory cache to bypass localStorage limit for active sessions
            this.messages = messages;
            
            // Save diet version to localStorage (remove binary data payload to prevent QuotaExceededError)
            const dietMessages = messages.map(m => {
                if (m.attachment) {
                    const { data, ...restAttachment } = m.attachment;
                    return { ...m, attachment: restAttachment };
                }
                return m;
            });
            try {
                localStorage.setItem('rocket_messages', JSON.stringify(dietMessages));
            } catch (storageErr) {
                console.warn("LocalStorage backup write failed (quota exceeded), skipping backup:", storageErr);
            }
            
            const msgBadge = document.getElementById('db-messages-badge');
            const msgCount = document.getElementById('db-messages-count');
            if (msgBadge && msgCount) {
                msgCount.innerText = messages.length;
                msgBadge.classList.remove('hidden');
            }
            
            if (this.activeTab === 'chat' && this.currentUser) {
                this.renderChatMessages(messages);
            }
        });

        // 3. Password Inquiry Requests Sync
        const requestsRef = this.fbRef.child('pw_requests');
        registerListener(requestsRef, 'value', snapshot => {
            const val = snapshot.val();
            const requests = [];
            if (val) {
                Object.keys(val).forEach(key => {
                    const r = val[key];
                    if (r && typeof r === 'object') {
                        r.id = key;
                        requests.push(r);
                    }
                });
            }
            requests.sort((a, b) => {
                const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return tB - tA; // descending order
            });

            localStorage.setItem('rocket_pw_requests', JSON.stringify(requests));
            if (this.activeTab === 'admin') {
                this.renderAdminRequestsList();
            }
        });

        // 4. Collaborative Table Sync
        const tableRef = this.fbRef.child('collaborative/table');
        registerListener(tableRef, 'value', snapshot => {
            const val = snapshot.val();
            if (val) {
                this.tableHeaders = val.headers || [];
                this.tableData = val.rows || [];
                localStorage.setItem('rocket_active_table', JSON.stringify(val));
                
                // Avoid resetting inputs if the user is actively typing in the table
                const table = document.getElementById('drawing-table');
                if (table && table.contains(document.activeElement)) {
                    this.syncTableInputsFromData();
                    this.drawTableChart();
                } else {
                    if (this.activeTab === 'table') {
                        this.renderTableTool();
                    }
                }
            }
        });

        // 5. Collaborative Report Sync
        const reportRef = this.fbRef.child('collaborative/report');
        registerListener(reportRef, 'value', snapshot => {
            const val = snapshot.val();
            if (val) {
                localStorage.setItem('rocket_active_report', val.content || '');
                const textarea = document.getElementById('report-editor-textarea');
                if (textarea && document.activeElement !== textarea) {
                    textarea.value = val.content || '';
                }
                if (this.activeTab === 'report') {
                    this.updateReportPreview();
                }
            }
        });

        // 6. Collaborative Active Simulator Sync
        const simRef = this.fbRef.child('simulators/active');
        registerListener(simRef, 'value', snapshot => {
            const val = snapshot.val();
            if (val) {
                const tx = this.db.transaction('simulators', 'readwrite');
                tx.objectStore('simulators').put({ id: 'active', name: val.name, content: val.content }).onsuccess = () => {
                    if (this.activeTab === 'simulator') {
                        this.loadActiveSimulator();
                    }
                };
            }
        });

        // 7. Virtual File Storage Sync
        const filesRef = this.fbRef.child('files');
        registerListener(filesRef, 'value', snapshot => {
            const val = snapshot.val();
            const files = [];
            if (val) {
                Object.keys(val).forEach(key => {
                    const f = val[key];
                    if (f && typeof f === 'object') {
                        f.id = key;
                        files.push(f);
                    }
                });
            }
            this.syncRealtimeFilesToIndexedDB(files);
        });
    }

    async syncRealtimeFilesToIndexedDB(fsFiles) {
        const tx = this.db.transaction('virtualFiles', 'readwrite');
        const store = tx.objectStore('virtualFiles');
        
        await new Promise((resolve) => {
            store.clear().onsuccess = () => resolve();
        });

        const promises = fsFiles.map(fileObj => {
            return new Promise((resolve) => {
                const txAdd = this.db.transaction('virtualFiles', 'readwrite');
                txAdd.objectStore('virtualFiles').add({
                    id: fileObj.localId,
                    path: fileObj.path,
                    name: fileObj.name,
                    isFolder: fileObj.isFolder,
                    size: fileObj.size,
                    type: fileObj.type,
                    content: fileObj.content
                }).onsuccess = () => resolve();
            });
        });

        await Promise.all(promises);
        if (this.activeTab === 'storage') {
            this.storageRender();
        }
    }

    async migrateLocalToFirebase() {
        if (!this.isFirebaseConnected || !this.fbRef) return;

        console.log("Migrating users to Firebase RTDB...");
        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        users.forEach(u => {
            this.fbRef.child('users').child(u.id).set(u);
        });

        console.log("Migrating messages to Firebase RTDB...");
        const messages = JSON.parse(localStorage.getItem('rocket_messages') || '[]');
        messages.forEach(m => {
            this.fbRef.child('messages').push(m);
        });

        console.log("Migrating PW recovery inquiries to Firebase RTDB...");
        const requests = JSON.parse(localStorage.getItem('rocket_pw_requests') || '[]');
        requests.forEach(r => {
            this.fbRef.child('pw_requests').push(r);
        });

        console.log("Migrating collaborative table and reports...");
        this.fbRef.child('collaborative/table').set({
            headers: this.tableHeaders,
            rows: this.tableData
        });
        this.fbRef.child('collaborative/report').set({
            content: localStorage.getItem('rocket_active_report') || ''
        });

        // Migrate simulators
        const txSim = this.db.transaction('simulators', 'readonly');
        txSim.objectStore('simulators').get('active').onsuccess = (e) => {
            const activeSim = e.target.result;
            if (activeSim) {
                this.fbRef.child('simulators/active').set({
                    name: activeSim.name,
                    content: activeSim.content
                });
            }
        };

        // Migrate Virtual Files
        console.log("Migrating virtual filesystem to Firebase RTDB...");
        const txFiles = this.db.transaction('virtualFiles', 'readonly');
        txFiles.objectStore('virtualFiles').openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                const f = cursor.value;
                if (f.size > 900 * 1024) {
                    console.warn(`File '${f.name}' is too large to migrate (limit 1MB).`);
                } else {
                    this.fbRef.child('files').push({
                        localId: f.id,
                        path: f.path,
                        name: f.name,
                        isFolder: f.isFolder,
                        size: f.size,
                        type: f.type,
                        content: f.content
                    });
                }
                cursor.continue();
            }
        };
    }

    syncTableInputsFromData() {
        const table = document.getElementById('drawing-table');
        if (!table) return;

        // 1. Update headers
        const headerInputs = table.querySelectorAll('thead input');
        headerInputs.forEach((input, idx) => {
            if (input !== document.activeElement && this.tableHeaders[idx] !== undefined) {
                if (input.value !== this.tableHeaders[idx]) {
                    input.value = this.tableHeaders[idx];
                }
            }
        });

        // 2. Update body cells
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((tr, rowIdx) => {
            const inputs = tr.querySelectorAll('input');
            inputs.forEach((input, colIdx) => {
                if (input !== document.activeElement && this.tableData[rowIdx] && this.tableData[rowIdx][colIdx] !== undefined) {
                    if (input.value !== this.tableData[rowIdx][colIdx]) {
                        input.value = this.tableData[rowIdx][colIdx];
                    }
                }
            });
        });
    }

    handleFirebaseConfigSubmit(e) {
        e.preventDefault();
        const url = document.getElementById('fb-database-url').value.trim();

        if (!url) {
            alert("❌ Firebase RTDB URL을 입력해 주세요.");
            return;
        }

        const config = { databaseURL: url };
        this.connectFirebase(config);
    }

    loadDemoFirebaseConfig() {
        const demoConfig = {
            databaseURL: "https://palrocketchat.asia-southeast1.firebasedatabase.app/"
        };
        const elUrl = document.getElementById('fb-database-url');
        if (elUrl) elUrl.value = demoConfig.databaseURL;
        alert("📋 기본 RTDB 주소가 입력되었습니다. 실시간 동기화 시작 버튼을 눌러 연동할 수 있습니다.");
    }

    // Load initial config and database seeding
    loadInitialData() {
        // 1. Seed Users if empty (starts empty, users must sign up)
        let users = localStorage.getItem('rocket_users');
        if (!users) {
            localStorage.setItem('rocket_users', JSON.stringify([]));
        }

        // 2. Seed Channels & Messages if empty
        let messages = localStorage.getItem('rocket_messages');
        if (!messages) {
            const initialMessages = [
                {
                    id: "system_init",
                    channelId: 'notice',
                    senderName: '시스템',
                    senderId: 'system',
                    role: 'ADMIN',
                    content: '🚀 RocketLab Link 협업 채널이 개설되었습니다. 팀원 분들은 회원가입 후 로그인하여 사용해 주세요.',
                    timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
                }
            ];
            localStorage.setItem('rocket_messages', JSON.stringify(initialMessages));
        }

        // 3. Seed Password requests list
        let requests = localStorage.getItem('rocket_pw_requests');
        if (!requests) {
            localStorage.setItem('rocket_pw_requests', JSON.stringify([]));
        }

        // 4. Initialize Table drawing Tool data
        let savedTable = localStorage.getItem('rocket_active_table');
        if (!savedTable) {
            this.tableData = this.tableTemplates.blank.rows;
            this.tableHeaders = this.tableTemplates.blank.headers;
            this.saveActiveTableToStorage();
        } else {
            const parsed = JSON.parse(savedTable);
            this.tableData = parsed.rows;
            this.tableHeaders = parsed.headers;
        }

        // 5. Initialize Report template
        let savedReport = localStorage.getItem('rocket_active_report');
        if (!savedReport) {
            const defaultMarkdown = `# 🚀 고체 연료 다단 로켓 비행 결과 보고서\n\n**작성자:** 윤은준, 하선효, 허단, 홍서준, 황인홍, 최준성\n**일시:** ${new Date().toLocaleDateString()}\n\n## 1. 개요\n영재원 프로젝트로 고안된 고체 연료 다단 로켓의 추진 설계 데이터 및 3D 시뮬레이션 고도 데이터를 종합 분석한 보고서입니다.\n\n## 2. 모터 추진 분석 데이터\n아래의 데이터 표는 엔진 추력의 실측값을 기록한 테이블입니다.\n\n<!-- TABLE_DATA_HERE -->\n\n## 3. 비행 고도 및 연소 그래프\n시뮬레이션 구동 결과 고도 상승 곡선은 초기 2초간 최대 중력가속도를 극복하기 위한 충분한 임펄스를 제공하였으며, 다단 분리 설계가 성공적으로 작동하여 목표 궤도 진입에 성공했습니다.\n\n## 4. 시뮬레이션 세부 지표\n<!-- SIMULATOR_DATA_HERE -->\n\n## 5. 결론 및 향후 계획\n연료 배합 조성비에 따른 연소 속도를 개선하면 차기 다단 분리 시점의 임계 고도를 추가 확보할 수 있을 것으로 사료됩니다.\n`;
            localStorage.setItem('rocket_active_report', defaultMarkdown);
        }

        // 6. Preload/Save Default 3D Simulator inside IndexedDB
        this.preloadDefaultSimulator();

        // 7. Seed Virtual Files if empty
        this.seedVirtualFiles();
    }

    // Load default 3D simulator html to database
    preloadDefaultSimulator() {
        // Try to fetch from remote URL first to ensure it's up to date
        fetch('https://palrocketchat.vercel.app/default_simulator.html')
            .then(res => {
                if (!res.ok) throw new Error('CORS or file not found');
                return res.text();
            })
            .then(html => {
                const tx = this.db.transaction('simulators', 'readwrite');
                const store = tx.objectStore('simulators');
                store.put({ id: 'default', name: '3D 정밀 로켓 시뮬레이터', content: html });
                console.log('IndexedDB: Default 3D simulator preloaded/updated successfully from remote URL.');
            })
            .catch(err => {
                console.warn('Failed to fetch https://palrocketchat.vercel.app/default_simulator.html. Checking local/fallback.', err);
                const tx = this.db.transaction('simulators', 'readwrite');
                const store = tx.objectStore('simulators');
                store.get('default').onsuccess = (e) => {
                    if (!e.target.result) {
                        store.put({ id: 'default', name: '3D 정밀 로켓 시뮬레이터 (Fallback)', content: this.fallbackSimHtml });
                    }
                };
            });
    }

    // Seed virtual filesystem with directories and sample file
    seedVirtualFiles() {
        const tx = this.db.transaction('virtualFiles', 'readwrite');
        const store = tx.objectStore('virtualFiles');
        
        // Check if store is empty
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            if (countRequest.result === 0) {
                // Populate root directories
                store.add({ path: '/', name: '설명서.txt', isFolder: false, size: 450, type: 'text/plain', content: '🚀 RocketLab Link 가상 탐색기에 오신 것을 환영합니다!\n\n이 폴더 보관함은 브라우저 IndexedDB 기반의 독립 파일 시스템입니다.\n- 파일 및 폴더를 자유롭게 업로드하고 다운로드할 수 있습니다.\n- 폴더 업로드 버튼을 사용해 복잡한 폴더 구조를 통째로 가져올 수 있습니다.\n- 업로드한 파일은 더블 클릭하여 내용 미리보기(텍스트, 이미지, CSV 등)가 가능합니다.' });
                store.add({ path: '/', name: '엔진_실험_데이터', isFolder: true, size: 0, type: '', content: '' });
                store.add({ path: '/', name: '비행_기록_일지', isFolder: true, size: 0, type: '', content: '' });
                store.add({ path: '/엔진_실험_데이터', name: '고체연료_추력곡선.csv', isFolder: false, size: 104, type: 'text/csv', content: '시간(초),엔진추력(N)\n0.0,0\n0.5,80\n1.0,240\n1.5,320\n2.0,290\n2.5,180\n3.0,90\n3.5,0' });
            }
        };
    }

    // AUTHENTICATION MODULES
    checkSession() {
        const session = localStorage.getItem('rocket_session');
        if (session) {
            this.currentUser = JSON.parse(session);
            this.showMainApp();
        } else {
            this.showAuthOverlay();
        }
    }

    showAuthOverlay() {
        document.getElementById('auth-overlay').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('auth-overlay').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Update profile header
        document.getElementById('user-display-name').innerText = this.currentUser.name;
        document.getElementById('user-display-id').innerText = `@${this.currentUser.id}`;
        
        const userAvatarEl = document.getElementById('user-avatar');
        if (this.currentUser.avatar) {
            userAvatarEl.innerHTML = `<img src="${this.currentUser.avatar}" class="w-full h-full object-cover">`;
        } else {
            userAvatarEl.innerText = this.currentUser.name.substring(0, 1);
        }
        
        const roleBadge = document.getElementById('user-role-badge');
        roleBadge.innerText = this.currentUser.role;
        if (this.currentUser.role === 'ADMIN') {
            roleBadge.className = "bg-amber-500/20 text-amber-400 text-[9px] px-1 rounded font-bold uppercase tracking-wider";
            document.getElementById('sidebar-admin-section').classList.remove('hidden');
        } else {
            roleBadge.className = "bg-blue-500/20 text-blue-300 text-[9px] px-1 rounded font-bold uppercase tracking-wider";
            document.getElementById('sidebar-admin-section').classList.add('hidden');
        }

        // Render current channel or screen
        this.switchTab(this.activeTab);
        this.renderChannelsList();
    }

    toggleAuthView(view) {
        const loginView = document.getElementById('auth-view-login');
        const signupView = document.getElementById('auth-view-signup');
        if (view === 'signup') {
            loginView.classList.add('hidden');
            signupView.classList.remove('hidden');
        } else {
            loginView.classList.remove('hidden');
            signupView.classList.add('hidden');
        }
    }

    handleLoginSubmit(e) {
        e.preventDefault();
        const idInput = document.getElementById('login-id').value.trim();
        const pwInput = document.getElementById('login-pw').value;

        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        const matched = users.find(u => u.id === idInput && u.pw === pwInput);

        if (matched) {
            localStorage.setItem('rocket_session', JSON.stringify(matched));
            this.currentUser = matched;
            
            // Clean forms
            document.getElementById('login-id').value = '';
            document.getElementById('login-pw').value = '';
            
            this.showMainApp();
        } else {
            alert('❌ 아이디 혹은 비밀번호가 일치하지 않습니다.');
        }
    }

    checkSignupIdDuplicate() {
        const idInput = document.getElementById('signup-id').value.trim();
        if (!idInput) {
            alert('아이디를 입력해 주세요.');
            return;
        }

        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        const exists = users.some(u => u.id === idInput);

        if (exists) {
            alert('❌ 이미 사용 중인 아이디입니다.');
        } else {
            alert('✅ 사용 가능한 아이디입니다.');
        }
    }

    handleSignupSubmit(e) {
        e.preventDefault();
        const nameInput = document.getElementById('signup-name').value.trim();
        const idInput = document.getElementById('signup-id').value.trim();
        const pwInput = document.getElementById('signup-pw').value;
        const pwConfirmInput = document.getElementById('signup-pw-confirm').value;

        // 1. Verify Name matches target list
        if (!this.allowedNames.includes(nameInput)) {
            alert('❌ 회원가입 실패:\n영재원 로켓 프로젝트 등록 명단에 없는 실명입니다.');
            return;
        }

        // 2. Validate Password Confirmed
        if (pwInput !== pwConfirmInput) {
            alert('❌ 비밀번호 확인이 일치하지 않습니다.');
            return;
        }

        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        
        // 3. Validate ID duplicate
        if (users.some(u => u.id === idInput)) {
            alert('❌ 이미 존재하는 아이디입니다. 다른 아이디로 가입해 주세요.');
            return;
        }

        // 4. Assign Admin status automatically if matches ADMIN_NAMES
        const role = this.adminNames.includes(nameInput) ? 'ADMIN' : 'MEMBER';

        // 5. Register
        const newUser = { id: idInput, name: nameInput, pw: pwInput, role: role };

        const completeSignup = () => {
            alert(`🎉 회원가입이 완료되었습니다!\n이름: ${nameInput}\n역할: ${role === 'ADMIN' ? '관리자(ADMIN)' : '팀원(MEMBER)'}\n로그인해 주세요.`);
            document.getElementById('signup-name').value = '';
            document.getElementById('signup-id').value = '';
            document.getElementById('signup-pw').value = '';
            document.getElementById('signup-pw-confirm').value = '';
            this.toggleAuthView('login');
        };

        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.child('users').child(newUser.id).set(newUser)
                .then(() => completeSignup())
                .catch(err => {
                    console.error("Firebase RTDB registration error:", err);
                    alert("❌ 실시간 클라우드 가입 실패. 인터넷 연결을 확인해 주세요.");
                });
        } else {
            users.push(newUser);
            localStorage.setItem('rocket_users', JSON.stringify(users));
            completeSignup();
        }
    }

    logout() {
        localStorage.removeItem('rocket_session');
        this.currentUser = null;
        this.showAuthOverlay();
    }

    // ID/PW Recovery Inquiry Modals
    showForgotModal() {
        document.getElementById('forgot-modal').classList.remove('hidden');
        document.getElementById('forgot-modal').classList.add('flex');
    }

    closeForgotModal() {
        document.getElementById('forgot-modal').classList.add('hidden');
        document.getElementById('forgot-modal').classList.remove('flex');
    }

    handleForgotSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('forgot-name').value.trim();
        const email = document.getElementById('forgot-reply-email').value.trim();
        const message = document.getElementById('forgot-message').value.trim();

        const newReq = {
            name: name,
            replyEmail: email,
            message: message,
            status: 'PENDING',
            timestamp: new Date().toISOString()
        };

        const completeForgot = () => {
            alert(`📬 [대시보드 요청 완료]\n계정 찾기 요청이 접수되어 관리자 대시보드에 기록되었습니다.\n\n이메일(${this.adminEmail})로 전송을 병행하려면 우측의 우편함 아이콘 메일발송 버튼을 추가로 누르세요.`);
            document.getElementById('forgot-name').value = '';
            document.getElementById('forgot-reply-email').value = '';
            document.getElementById('forgot-message').value = '';
            this.closeForgotModal();
        };

        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.child('pw_requests').push(newReq)
                .then(() => completeForgot())
                .catch(err => {
                    console.error("Firebase RTDB request error:", err);
                    alert("❌ 실시간 대시보드 접수 실패. 이메일 아이콘 메일발송 버튼을 이용해 주세요.");
                });
        } else {
            const requests = JSON.parse(localStorage.getItem('rocket_pw_requests') || '[]');
            newReq.id = Date.now();
            requests.push(newReq);
            localStorage.setItem('rocket_pw_requests', JSON.stringify(requests));
            completeForgot();
            this.renderAdminRequestsList();
        }
    }

    sendForgotMailto() {
        const name = document.getElementById('forgot-name').value.trim() || '홍서준';
        const email = document.getElementById('forgot-reply-email').value.trim() || 'test@email.com';
        const message = document.getElementById('forgot-message').value.trim() || '계정을 분실하여 조회를 요청합니다.';

        const subject = encodeURIComponent(`[로켓 앱] 계정 찾기 문의 (${name})`);
        const body = encodeURIComponent(`실명: ${name}\n회신 이메일: ${email}\n상세 문의내용: ${message}\n\n위 팀원의 아이디 및 비밀번호 분실 문의입니다.`);
        
        window.location.href = `mailto:${this.adminEmail}?subject=${subject}&body=${body}`;
    }

    // Switch active user bar (Convenient testing feature)
    quickSwitchUser(name) {
        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        let matched = users.find(u => u.name === name);

        if (!matched) {
            // Auto register on-the-fly for quick test if not exists
            const role = this.adminNames.includes(name) ? 'ADMIN' : 'MEMBER';
            const mockId = name === '윤은준' ? 'eunjun' :
                           name === '하선효' ? 'sunhyo' :
                           name === '허단' ? 'dan' :
                           name === '홍서준' ? 'seojun' :
                           name === '황인홍' ? 'inhong' : 'junseong';
            
            matched = { id: mockId, name: name, pw: '1234', role: role };
            users.push(matched);
            localStorage.setItem('rocket_users', JSON.stringify(users));
        }

        // Auto log in as the selected user
        localStorage.setItem('rocket_session', JSON.stringify(matched));
        this.currentUser = matched;
        this.showMainApp();
        alert(`👤 계정이 '${name}' (ID: ${matched.id}, 역할: ${matched.role}) 으로 전환되었습니다.`);
    }

    // THEME SELECTION MODULE
    initTheme() {
        const themeBtn = document.getElementById('theme-toggle-btn');
        const savedTheme = localStorage.getItem('rocket_theme');
        
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeBtn.innerHTML = '<i class="fa-solid fa-sun text-amber-500"></i>';
        } else {
            document.body.classList.remove('light-theme');
            themeBtn.innerHTML = '<i class="fa-solid fa-moon text-slate-400"></i>';
        }

        themeBtn.onclick = () => {
            if (document.body.classList.contains('light-theme')) {
                document.body.classList.remove('light-theme');
                localStorage.setItem('rocket_theme', 'dark');
                themeBtn.innerHTML = '<i class="fa-solid fa-moon text-slate-400"></i>';
            } else {
                document.body.classList.add('light-theme');
                localStorage.setItem('rocket_theme', 'light');
                themeBtn.innerHTML = '<i class="fa-solid fa-sun text-amber-500"></i>';
            }
            if (this.activeTab === 'table') {
                this.drawTableChart();
            }
        };
    }

    // NAVIGATION SYSTEM
    switchTab(tabId) {
        this.activeTab = tabId;
        
        // Update nav button highlights
        Object.keys(this.navButtons).forEach(key => {
            const btn = this.navButtons[key];
            if (!btn) return;
            if (key === tabId) {
                btn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-blue-400 bg-blue-500/10 border border-blue-500/20";
            } else {
                if (key === 'admin') {
                    btn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-amber-400 hover:text-amber-200 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20";
                } else {
                    btn.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-400 hover:text-slate-200 hover:bg-slate-800/40";
                }
            }
        });

        // Toggle panes visibility
        Object.keys(this.tabs).forEach(key => {
            const tab = this.tabs[key];
            if (key === tabId) {
                tab.classList.remove('hidden');
            } else {
                tab.classList.add('hidden');
            }
        });

        // Trigger action hooks
        if (tabId === 'chat') {
            this.renderChatMessages();
        } else if (tabId === 'table') {
            this.renderTableTool();
        } else if (tabId === 'report') {
            this.updateReportPreview();
        } else if (tabId === 'simulator') {
            this.loadActiveSimulator();
        } else if (tabId === 'storage') {
            this.storageRender();
        } else if (tabId === 'admin') {
            this.renderAdminUsersList();
            this.renderAdminRequestsList();
        }
    }

    // CHAT MODULE
    renderChannelsList() {
        const container = document.getElementById('channels-list');
        container.innerHTML = '';

        this.channels.forEach(ch => {
            const btn = document.createElement('button');
            const isActive = ch.id === this.currentChannelId;
            btn.className = `w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${isActive ? 'bg-slate-800/80 text-blue-300 font-semibold' : 'hover:bg-slate-800/30 text-slate-400 hover:text-slate-200'}`;
            btn.onclick = () => {
                this.currentChannelId = ch.id;
                document.getElementById('active-channel-name').innerText = ch.name;
                document.getElementById('active-channel-desc').innerText = ch.desc;
                this.renderChannelsList();
                this.switchTab('chat');
            };
            
            const leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-center gap-2';
            leftDiv.innerHTML = `<span class="opacity-60 text-xs">#</span> <span>${ch.name}</span>`;
            
            btn.appendChild(leftDiv);
            
            if (ch.readOnly) {
                btn.innerHTML += `<i class="fa-solid fa-lock text-[10px] opacity-40" title="읽기전용"></i>`;
            }
            container.appendChild(btn);
        });
    }

    renderChatMessages(messagesFromSync = null) {
        if (!this.currentUser) return;

        const container = document.getElementById('chat-messages-container');
        container.innerHTML = '';

        let allMessages = [];
        if (messagesFromSync && Array.isArray(messagesFromSync)) {
            allMessages = messagesFromSync;
        } else if (this.messages && Array.isArray(this.messages) && this.messages.length > 0) {
            allMessages = this.messages;
        } else {
            try {
                allMessages = JSON.parse(localStorage.getItem('rocket_messages') || '[]');
                if (!Array.isArray(allMessages)) allMessages = [];
            } catch (err) {
                console.error("Failed to parse rocket_messages from localStorage:", err);
                allMessages = [];
            }
        }

        const filtered = allMessages.filter(m => m && m.channelId === this.currentChannelId);

        // Mark messages in the current channel as read
        let localMessagesUpdated = false;
        filtered.forEach(m => {
            if (!m.readBy || typeof m.readBy !== 'object') m.readBy = {};
            if (!m.readBy[this.currentUser.id]) {
                m.readBy[this.currentUser.id] = true;
                if (m.id && typeof m.id === 'string' && this.isFirebaseConnected && this.fbRef) {
                    this.fbRef.child('messages').child(m.id).child('readBy').child(this.currentUser.id).set(true)
                        .catch(err => console.error("Error marking read:", err));
                } else {
                    localMessagesUpdated = true;
                }
            }
        });

        if (localMessagesUpdated) {
            // Save diet version to localStorage (remove binary data payload to prevent QuotaExceededError)
            const dietMessages = allMessages.map(m => {
                if (m.attachment) {
                    const { data, ...restAttachment } = m.attachment;
                    return { ...m, attachment: restAttachment };
                }
                return m;
            });
            try {
                localStorage.setItem('rocket_messages', JSON.stringify(dietMessages));
            } catch (storageErr) {
                console.warn("LocalStorage backup write failed during read marking:", storageErr);
            }
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-slate-500 py-10">
                    <i class="fa-regular fa-comment-dots text-4xl mb-2 text-slate-700"></i>
                    <p class="text-xs">이 채널의 첫 메시지를 작성해 보세요!</p>
                </div>
            `;
            return;
        }

        filtered.forEach(m => {
            const isMe = m.senderId === this.currentUser.id;
            const messageDiv = document.createElement('div');
            messageDiv.className = `flex gap-3 text-left ${isMe ? 'flex-row-reverse' : ''}`;

            // Avatar
            const avatar = document.createElement('div');
            avatar.className = `w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.senderId === 'system' ? 'bg-slate-700 text-slate-300' : 'bg-blue-600/30 text-blue-300 border border-blue-500/30'} overflow-hidden`;
            
            const senderName = m.senderName || '알수없음';
            
            let senderAvatar = null;
            if (m.senderId && m.senderId !== 'system') {
                try {
                    const localUsers = JSON.parse(localStorage.getItem('rocket_users') || '[]');
                    const foundUser = localUsers.find(u => u && u.id === m.senderId);
                    if (foundUser && foundUser.avatar) {
                        senderAvatar = foundUser.avatar;
                    }
                } catch (e) {
                    console.error("Failed to lookup sender avatar:", e);
                }
            }

            if (senderAvatar) {
                avatar.innerHTML = `<img src="${senderAvatar}" class="w-full h-full object-cover">`;
            } else {
                avatar.innerText = (typeof senderName === 'string' && senderName.length > 0) ? senderName.substring(0, 1) : '?';
            }

            // Message Bubble & Info wrapper
            const contentWrap = document.createElement('div');
            contentWrap.className = 'max-w-[70%] space-y-1';

            // Meta row (name, time)
            const metaRow = document.createElement('div');
            metaRow.className = `flex items-center gap-2 text-[10px] text-slate-500 ${isMe ? 'flex-row-reverse' : ''}`;
            
            let badgeHtml = '';
            if (m.role === 'ADMIN') {
                badgeHtml = `<span class="bg-amber-500/20 text-amber-400 font-bold px-1 rounded text-[8px]">ADMIN</span>`;
            }
            
            metaRow.innerHTML = `
                <span class="font-semibold text-slate-300">${senderName}</span>
                ${badgeHtml}
            `;

            // Bubble content
            const bubble = document.createElement('div');
            let bubbleStyle = isMe ? 'bg-blue-600 text-white rounded-l-2xl rounded-tr-2xl shadow-lg shadow-blue-600/5' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-r-2xl rounded-tl-2xl';
            if (m.senderId === 'system') {
                bubbleStyle = 'bg-slate-850 border border-dashed border-slate-700 text-slate-300 rounded-xl px-4 py-3';
            }
            bubble.className = `px-4 py-2.5 text-sm leading-relaxed ${bubbleStyle} relative group`;

            // Render message text content
            const textNode = document.createElement('div');
            textNode.innerText = m.content || '';
            bubble.appendChild(textNode);

            // Render attachments if exists
            if (m.attachment) {
                const attNode = document.createElement('div');
                attNode.className = 'mt-2.5 pt-2.5 border-t border-white/10 text-xs flex flex-col gap-2';
                
                const attInfo = m.attachment;
                if (attInfo.type && attInfo.type.startsWith('image/')) {
                    // Render image
                    const img = document.createElement('img');
                    img.src = attInfo.data;
                    img.className = 'max-h-48 rounded border border-white/10 cursor-pointer object-contain hover:brightness-95 transition';
                    img.onclick = () => this.showPreviewModal(attInfo.name, attInfo.type, attInfo.data);
                    attNode.appendChild(img);
                } else if (attInfo.name && (attInfo.name.endsWith('.html') || attInfo.type === 'text/html')) {
                    // Special load button for custom HTML simulators shared in chat
                    const card = document.createElement('div');
                    card.className = 'bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-4';
                    card.innerHTML = `
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-cube text-emerald-400 text-base"></i>
                            <div class="text-left leading-tight">
                                <div class="font-semibold text-slate-200 text-[11px] truncate max-w-[140px]">${attInfo.name}</div>
                                <div class="text-[9px] text-slate-500">${(attInfo.size / 1024).toFixed(1)} KB (HTML 시뮬레이터)</div>
                            </div>
                        </div>
                        <button onclick="app.loadSharedSimulator('${attInfo.name}', '${attInfo.data}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2 py-1 rounded transition shrink-0">시뮬레이터 실행</button>
                    `;
                    attNode.appendChild(card);
                } else if (attInfo.name) {
                    // Regular file card with both View (Preview) and Download capabilities
                    const fileCard = document.createElement('div');
                    fileCard.className = 'flex items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850 hover:bg-slate-950/80 transition cursor-pointer';
                    fileCard.onclick = () => this.showPreviewModal(attInfo.name, attInfo.type, attInfo.data);
                    
                    fileCard.innerHTML = `
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            <i class="fa-regular fa-file-lines text-blue-400 text-base shrink-0"></i>
                            <div class="text-left leading-tight truncate">
                                <div class="font-semibold text-[11px] text-slate-200 truncate max-w-[140px]">${attInfo.name}</div>
                                <div class="text-[9px] text-slate-500">${(attInfo.size / 1024).toFixed(1)} KB</div>
                            </div>
                        </div>
                        <button onclick="event.stopPropagation(); app.downloadFile('${attInfo.name.replace(/'/g, "\\'")}', '${attInfo.type}', '${attInfo.data}')" class="w-6 h-6 rounded bg-slate-850/80 hover:bg-slate-750 flex items-center justify-center text-slate-400 hover:text-slate-200 transition shrink-0" title="다운로드">
                            <i class="fa-solid fa-download text-[10px]"></i>
                        </button>
                    `;
                    attNode.appendChild(fileCard);
                }

                bubble.appendChild(attNode);
            }

            // Message Delete Button (Admin can delete all, users delete own)
            if (this.currentUser.role === 'ADMIN' || isMe) {
                const delBtn = document.createElement('button');
                delBtn.className = `absolute ${isMe ? '-left-6' : '-right-6'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition p-1 text-slate-600 hover:text-rose-500`;
                delBtn.innerHTML = '<i class="fa-regular fa-trash-can text-[11px]"></i>';
                delBtn.onclick = () => this.handleDeleteMessage(m.id);
                bubble.appendChild(delBtn);
            }

            // Create status indicator column (unread count and timestamp)
            const statusCol = document.createElement('div');
            statusCol.className = `flex flex-col text-[10px] select-none shrink-0 ${isMe ? 'items-end text-right' : 'items-start text-left'} mb-0.5`;

            // Calculate unread count and who has read it
            const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
            const readBy = m.readBy || {};
            
            const readNames = [];
            const unreadNames = [];
            users.forEach(u => {
                if (u && u.id) {
                    if (readBy[u.id]) {
                        readNames.push(u.name);
                    } else {
                        unreadNames.push(u.name);
                    }
                }
            });

            const unreadCount = unreadNames.length;

            if (unreadCount > 0) {
                const unreadBadge = document.createElement('span');
                unreadBadge.className = 'text-amber-400 font-bold font-mono text-[10px] leading-none mb-0.5 cursor-pointer hover:underline';
                unreadBadge.innerText = unreadCount;
                unreadBadge.title = '클릭하여 읽은 사람 확인';
                unreadBadge.onclick = () => this.showReadStatus(m.id);
                statusCol.appendChild(unreadBadge);
            } else {
                const readBadge = document.createElement('span');
                readBadge.className = 'text-slate-600 text-[9px] font-semibold leading-none mb-0.5 cursor-pointer hover:underline';
                readBadge.innerText = '읽음';
                readBadge.title = '클릭하여 읽은 사람 확인';
                readBadge.onclick = () => this.showReadStatus(m.id);
                statusCol.appendChild(readBadge);
            }

            const timeLabel = document.createElement('span');
            timeLabel.className = 'text-[9px] text-slate-500 font-mono scale-90 origin-bottom leading-none cursor-pointer hover:text-slate-400 transition-colors';
            
            let timeStr = '시간 미상';
            try {
                if (m.timestamp) {
                    const d = new Date(m.timestamp);
                    if (!isNaN(d.getTime())) {
                        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                }
            } catch (err) {
                console.error("Error parsing timestamp:", err);
            }
            timeLabel.innerText = timeStr;
            timeLabel.title = '클릭하여 읽은 사람 확인';
            timeLabel.onclick = () => this.showReadStatus(m.id);
            statusCol.appendChild(timeLabel);

            // Row containing the bubble and the statusCol
            const bubbleRow = document.createElement('div');
            bubbleRow.className = `flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`;
            bubbleRow.appendChild(bubble);
            if (m.senderId !== 'system') {
                bubbleRow.appendChild(statusCol);
            }

            contentWrap.appendChild(metaRow);
            contentWrap.appendChild(bubbleRow);

            messageDiv.appendChild(avatar);
            messageDiv.appendChild(contentWrap);

            container.appendChild(messageDiv);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    showReadStatus(messageId) {
        const allMessages = JSON.parse(localStorage.getItem('rocket_messages') || '[]');
        const m = allMessages.find(msg => msg.id === messageId);
        if (!m) return;

        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        const readBy = m.readBy || {};
        
        const readNames = [];
        const unreadNames = [];
        users.forEach(u => {
            if (readBy[u.id]) {
                readNames.push(`${u.name} (@${u.id})`);
            } else {
                unreadNames.push(`${u.name} (@${u.id})`);
            }
        });

        const modalId = 'read-status-popup-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
            document.body.appendChild(modal);
        }

        const isLightTheme = document.body.classList.contains('light-theme');
        const bgClass = isLightTheme ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-100 border border-slate-700/60';
        
        modal.innerHTML = `
            <div class="${bgClass} p-6 rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden transition-all transform scale-100">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <h3 class="text-sm font-bold mb-4 flex items-center gap-2">
                    <i class="fa-solid fa-circle-info text-blue-500"></i>
                    <span>대화 읽음 현황</span>
                </h3>
                
                <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div>
                        <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex justify-between">
                            <span>읽은 사람</span>
                            <span class="text-blue-400 font-semibold font-mono">${readNames.length}명</span>
                        </div>
                        <div class="bg-slate-950/20 p-2.5 rounded-lg border border-slate-800/20 space-y-1">
                            ${readNames.length > 0 
                                ? readNames.map(name => `<div class="text-xs flex items-center gap-1.5"><i class="fa-solid fa-check text-[10px] text-emerald-400"></i> <span>${name}</span></div>`).join('') 
                                : '<div class="text-xs text-slate-500">읽은 사람이 없습니다.</div>'}
                        </div>
                    </div>
                    
                    <div>
                        <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 flex justify-between">
                            <span>안 읽은 사람</span>
                            <span class="text-amber-400 font-semibold font-mono">${unreadNames.length}명</span>
                        </div>
                        <div class="bg-slate-950/20 p-2.5 rounded-lg border border-slate-800/20 space-y-1">
                            ${unreadNames.length > 0 
                                ? unreadNames.map(name => `<div class="text-xs flex items-center gap-1.5"><i class="fa-solid fa-minus text-[10px] text-amber-400/80"></i> <span>${name}</span></div>`).join('') 
                                : '<div class="text-xs text-slate-500">모두 읽었습니다!</div>'}
                        </div>
                    </div>
                </div>
                
                <button onclick="document.getElementById('${modalId}').remove()" class="mt-5 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs shadow-lg shadow-blue-500/20 transition-all">확인</button>
            </div>
        `;
    }

    handleSendMessage(e) {
        if (e) e.preventDefault();
        
        if (this.isSendingMessage) return;
        
        try {
            const content = this.chatInput.value.trim();
            const hasAttachment = this.activeChatAttachment !== null;

            if (!content && !hasAttachment) return;

            // Validation for notice channel: only Admin can post
            const activeCh = this.channels.find(c => c.id === this.currentChannelId);
            if (!activeCh) {
                console.error("Active channel not found:", this.currentChannelId);
                return;
            }
            if (activeCh.readOnly && (!this.currentUser || this.currentUser.role !== 'ADMIN')) {
                alert('❌ 공지사항 채널은 관리자만 메시지를 전송할 수 있습니다.');
                return;
            }

            this.isSendingMessage = true;

            // Find and disable submit button to prevent click spamming
            const submitBtn = this.chatForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            const newMsg = {
                channelId: this.currentChannelId,
                senderName: this.currentUser ? this.currentUser.name : 'Unknown',
                senderId: this.currentUser ? this.currentUser.id : 'unknown',
                role: this.currentUser ? this.currentUser.role : 'MEMBER',
                content: content,
                timestamp: new Date().toISOString(),
                attachment: this.activeChatAttachment,
                readBy: { [this.currentUser ? this.currentUser.id : 'unknown']: true }
            };

            // Clear input and attachment state immediately to give fast feedback and prevent double clicks
            this.chatInput.value = '';
            this.cancelChatAttachment();

            const unlock = () => {
                // Debounce unlocking for 500ms to guarantee no double-send on extremely fast responses
                setTimeout(() => {
                    this.isSendingMessage = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }, 500);
            };

            if (this.isFirebaseConnected && this.fbRef) {
                this.fbRef.child('messages').push(newMsg)
                    .then(() => unlock())
                    .catch(err => {
                        console.error("Firebase RTDB send error:", err);
                        const messages = JSON.parse(localStorage.getItem('rocket_messages') || '[]');
                        newMsg.id = Date.now() + '';
                        messages.push(newMsg);
                        localStorage.setItem('rocket_messages', JSON.stringify(messages));
                        this.renderChatMessages();
                        unlock();
                    });
            } else {
                const messages = JSON.parse(localStorage.getItem('rocket_messages') || '[]');
                newMsg.id = Date.now() + '';
                messages.push(newMsg);
                localStorage.setItem('rocket_messages', JSON.stringify(messages));
                this.renderChatMessages();
                unlock();
            }
        } catch (err) {
            console.error("Exception in handleSendMessage:", err);
            this.isSendingMessage = false;
            const submitBtn = this.chatForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    triggerChatAttachment() {
        document.getElementById('chat-file-input').click();
    }

    handleChatFileSelected(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Size limit check for Firebase RTDB stability (900KB)
        if (file.size > 900 * 1024) {
            alert(`❌ 첨부파일 크기가 너무 큽니다. (최대 900KB 제한)\n더 큰 파일은 '파일 보관함' 탭을 이용해 공유해 주세요.`);
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            this.activeChatAttachment = {
                name: file.name,
                size: file.size,
                type: file.type,
                data: evt.target.result // base64 / Data URL representation
            };
            
            // Show attachment preview in input bar
            document.getElementById('chat-attachment-preview-container').classList.remove('hidden');
            document.getElementById('attach-file-name').innerText = file.name;
            document.getElementById('attach-file-size').innerText = `${(file.size / 1024).toFixed(1)} KB`;
            
            // Swap file icon based on type
            const icon = document.getElementById('attach-file-icon');
            if (file.type.startsWith('image/')) {
                icon.className = 'fa-regular fa-file-image text-emerald-400';
            } else if (file.name.endsWith('.html')) {
                icon.className = 'fa-solid fa-cube text-indigo-400';
            } else {
                icon.className = 'fa-regular fa-file-lines text-blue-400';
            }
        };

        reader.readAsDataURL(file);
    }

    cancelChatAttachment() {
        this.activeChatAttachment = null;
        document.getElementById('chat-file-input').value = '';
        document.getElementById('chat-attachment-preview-container').classList.add('hidden');
    }

    handleDeleteMessage(id) {
        if (!confirm('메시지를 완전히 삭제하시겠습니까?')) return;
        
        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.child('messages').child(id).remove().catch(err => {
                console.error("Firebase RTDB delete error:", err);
                let messages = JSON.parse(localStorage.getItem('rocket_messages') || '[]');
                messages = messages.filter(m => m.id !== id);
                localStorage.setItem('rocket_messages', JSON.stringify(messages));
                this.renderChatMessages();
            });
        } else {
            let messages = JSON.parse(localStorage.getItem('rocket_messages') || '[]');
            messages = messages.filter(m => m.id !== id);
            localStorage.setItem('rocket_messages', JSON.stringify(messages));
            this.renderChatMessages();
        }
    }

    insertEmoji(emoji) {
        this.chatInput.value += emoji;
        this.chatInput.focus();
    }

    resetChannels() {
        if (confirm('채널 목록을 기본값으로 원복하시겠습니까?')) {
            this.currentChannelId = 'general';
            this.renderChannelsList();
            this.renderChatMessages();
        }
    }

    // TABLE DRAWING TOOL MODULE
    renderTableTool() {
        const container = document.getElementById('drawing-table');
        container.innerHTML = '';

        // Table Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        this.tableHeaders.forEach((col, idx) => {
            const th = document.createElement('th');
            th.innerHTML = `<input type="text" value="${col}" oninput="app.handleTableHeaderChange(${idx}, this.value)" class="bg-transparent text-center border-0 text-white font-bold outline-none font-sans">`;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        container.appendChild(thead);

        // Table Body
        const tbody = document.createElement('tbody');
        this.tableData.forEach((row, rowIdx) => {
            const tr = document.createElement('tr');
            row.forEach((cell, colIdx) => {
                const td = document.createElement('td');
                td.innerHTML = `<input type="text" value="${cell}" oninput="app.handleTableCellChange(${rowIdx}, ${colIdx}, this.value)" class="bg-transparent text-center border-0 text-slate-100 outline-none">`;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        container.appendChild(tbody);

        // Update Automatic Charting
        this.drawTableChart();
    }

    handleTableHeaderChange(colIdx, val) {
        this.tableHeaders[colIdx] = val;
        this.saveActiveTableToStorage();
        // Redraw only chart, not table inputs (to avoid cursor jump)
        this.drawTableChart();
    }

    handleTableCellChange(rowIdx, colIdx, val) {
        this.tableData[rowIdx][colIdx] = val;
        this.saveActiveTableToStorage();
        this.drawTableChart();
    }

    saveActiveTableToStorage() {
        localStorage.setItem('rocket_active_table', JSON.stringify({
            headers: this.tableHeaders,
            rows: this.tableData
        }));

        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.child('collaborative/table').set({
                headers: this.tableHeaders,
                rows: this.tableData
            }).catch(err => console.error("Firebase RTDB table save error:", err));
        }
    }

    loadTableTemplate(templateId) {
        if (templateId === 'blank') {
            this.tableHeaders = this.tableTemplates.blank.headers;
            this.tableData = this.tableTemplates.blank.rows;
        } else {
            const t = this.tableTemplates[templateId];
            this.tableHeaders = [...t.headers];
            // Deep copy rows
            this.tableData = t.rows.map(r => [...r]);
        }
        this.saveActiveTableToStorage();
        this.renderTableTool();
        alert(`📊 '${document.getElementById('table-template-select').selectedOptions[0].text}' 템플릿이 로드되었습니다.`);
    }

    tableAddRow() {
        const colsCount = this.tableHeaders.length;
        const newRow = Array(colsCount).fill('');
        this.tableData.push(newRow);
        this.saveActiveTableToStorage();
        this.renderTableTool();
    }

    tableDeleteRow() {
        if (this.tableData.length <= 1) return;
        this.tableData.pop();
        this.saveActiveTableToStorage();
        this.renderTableTool();
    }

    tableAddColumn() {
        const currentCols = this.tableHeaders.length;
        this.tableHeaders.push(`계열 ${currentCols}`);
        this.tableData.forEach(row => row.push(''));
        this.saveActiveTableToStorage();
        this.renderTableTool();
    }

    tableDeleteColumn() {
        if (this.tableHeaders.length <= 1) return;
        this.tableHeaders.pop();
        this.tableData.forEach(row => row.pop());
        this.saveActiveTableToStorage();
        this.renderTableTool();
    }

    drawTableChart() {
        const ctx = document.getElementById('table-visualization-chart').getContext('2d');
        const chartType = document.getElementById('chart-type-select').value;

        // Parse labels (Column 0)
        const labels = this.tableData.map(row => row[0] || '');

        // Generate datasets (Column 1, Column 2, etc.)
        const datasets = [];
        const themeColor = document.body.classList.contains('light-theme') ? '#1e293b' : '#38bdf8';

        for (let colIdx = 1; colIdx < this.tableHeaders.length; colIdx++) {
            const dataPoints = this.tableData.map(row => {
                const val = parseFloat(row[colIdx]);
                return isNaN(val) ? 0 : val;
            });

            const colors = [
                'rgba(56, 189, 248, 1)',   // Blue
                'rgba(244, 63, 94, 1)',    // Rose
                'rgba(16, 185, 129, 1)',   // Emerald
                'rgba(245, 158, 11, 1)'    // Amber
            ];
            const borderCol = colors[(colIdx - 1) % colors.length];
            const bgCol = borderCol.replace('1)', '0.15)');

            datasets.push({
                label: this.tableHeaders[colIdx] || `계열 ${colIdx}`,
                data: dataPoints,
                borderColor: borderCol,
                backgroundColor: bgCol,
                borderWidth: 2,
                tension: 0.3,
                fill: chartType !== 'radar'
            });
        }

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Font styling
        const textCol = document.body.classList.contains('light-theme') ? '#475569' : '#94a3b8';
        const gridCol = document.body.classList.contains('light-theme') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

        this.chartInstance = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: textCol, font: { size: 10, family: 'Noto Sans KR' } }
                    }
                },
                scales: chartType === 'radar' ? {} : {
                    x: {
                        grid: { color: gridCol },
                        ticks: { color: textCol, font: { size: 9 } }
                    },
                    y: {
                        grid: { color: gridCol },
                        ticks: { color: textCol, font: { size: 9 } }
                    }
                }
            }
        });
    }

    updateChartType(type) {
        this.drawTableChart();
    }

    exportTableCSV() {
        let csv = '\ufeff'; // UTF-8 BOM
        csv += this.tableHeaders.join(',') + '\n';
        this.tableData.forEach(row => {
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'rocket_data_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    copyTableMarkdown() {
        let md = `| ${this.tableHeaders.join(' | ')} |\n`;
        md += `| ${this.tableHeaders.map(() => '---').join(' | ')} |\n`;
        this.tableData.forEach(row => {
            md += `| ${row.join(' | ')} |\n`;
        });

        navigator.clipboard.writeText(md).then(() => {
            alert('📋 Markdown 테이블 복사 완료! 보고서 등에 붙여넣어 사용하세요.');
        });
    }

    copyTableHTML() {
        let html = '<table border="1">\n  <thead>\n    <tr>\n';
        this.tableHeaders.forEach(col => {
            html += `      <th>${col}</th>\n`;
        });
        html += '    </tr>\n  </thead>\n  <tbody>\n';
        this.tableData.forEach(row => {
            html += '    <tr>\n';
            row.forEach(cell => {
                html += `      <td>${cell}</td>\n`;
            });
            html += '    </tr>\n';
        });
        html += '  </tbody>\n</table>';

        navigator.clipboard.writeText(html).then(() => {
            alert('📋 HTML 코드가 클립보드에 복사되었습니다.');
        });
    }

    // REPORT BUILDER MODULE
    updateReportPreview() {
        const textarea = document.getElementById('report-editor-textarea');
        const preview = document.getElementById('report-preview-content');

        let md = textarea.value;
        
        // Save draft
        localStorage.setItem('rocket_active_report', md);

        if (this.isFirebaseConnected && this.fbRef) {
            if (document.activeElement === textarea) {
                this.fbRef.child('collaborative/report').set({
                    content: md
                }).catch(err => console.error("Firebase RTDB report save error:", err));
            }
        }

        // Replace markdown placeholders with parsed dynamic structures
        md = this.processReportPlaceholders(md);

        // Compile markdown to html (using marked.js library)
        if (window.marked) {
            preview.innerHTML = marked.parse(md);
        } else {
            // Primitive parsing fallback
            preview.innerHTML = md.replace(/\n/g, '<br>');
        }
    }

    processReportPlaceholders(md) {
        // 1. Inject Table Data
        if (md.includes('<!-- TABLE_DATA_HERE -->')) {
            let tableHtml = '<table class="table-auto w-full my-6 text-center border-collapse border border-slate-300">\n';
            tableHtml += '  <thead><tr class="bg-slate-100">\n';
            this.tableHeaders.forEach(h => {
                tableHtml += `    <th class="border border-slate-300 px-3 py-2 font-bold text-slate-800">${h}</th>\n`;
            });
            tableHtml += '  </tr></thead>\n  <tbody>\n';
            this.tableData.forEach(row => {
                tableHtml += '    <tr>\n';
                row.forEach(cell => {
                    tableHtml += `      <td class="border border-slate-300 px-3 py-2 text-slate-700">${cell}</td>\n`;
                });
                tableHtml += '    </tr>\n';
            });
            tableHtml += '  </tbody>\n</table>';
            
            md = md.replace('<!-- TABLE_DATA_HERE -->', tableHtml);
        }

        // 2. Inject Simulator telemetry log
        if (md.includes('<!-- SIMULATOR_DATA_HERE -->')) {
            const telemetryLog = `> **[시뮬레이터 비행 정밀 진단 기록]**\n> - **비행 성공 여부:** 목표 고도 진입 성공 (Orbital Insertion Successful)\n> - **최대 속도:** Mach 3.42 (1160 m/s)\n> - **연소 효율:** 98.4% (고체 추진제 비추력 최고 기록 달성)\n> - **단 분리 고도:** 550m (비상 보완 단 분리 기구 정상 전개)`;
            md = md.replace('<!-- SIMULATOR_DATA_HERE -->', telemetryLog);
        }

        return md;
    }

    importTableToReport() {
        const textarea = document.getElementById('report-editor-textarea');
        let mdTable = `\n| ${this.tableHeaders.join(' | ')} |\n`;
        mdTable += `| ${this.tableHeaders.map(() => '---').join(' | ')} |\n`;
        this.tableData.forEach(row => {
            mdTable += `| ${row.join(' | ')} |\n`;
        });
        mdTable += '\n';

        const pos = textarea.selectionStart;
        const text = textarea.value;
        textarea.value = text.substring(0, pos) + mdTable + text.substring(textarea.selectionEnd);
        
        this.updateReportPreview();
        textarea.focus();
    }

    importSimulatorStats() {
        const textarea = document.getElementById('report-editor-textarea');
        const stats = `\n### 📊 3D 시뮬레이터 실측 기록\n- **최고 도달 고도:** 1,420 m\n- **단 분리 임계 속도:** 550 m/s\n- **추진 연료 잔여량:** 1.5%\n- **총 연소 시간:** 3.8초\n`;
        
        const pos = textarea.selectionStart;
        const text = textarea.value;
        textarea.value = text.substring(0, pos) + stats + text.substring(textarea.selectionEnd);
        
        this.updateReportPreview();
        textarea.focus();
    }

    reportInsertText(before, after = '') {
        const textarea = document.getElementById('report-editor-textarea');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);

        const replacement = before + selected + after;
        textarea.value = text.substring(0, start) + replacement + text.substring(end);
        
        this.updateReportPreview();
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }

    printReport() {
        window.print();
    }

    // 3D SIMULATOR RUNNER MODULE
    loadActiveSimulator() {
        document.getElementById('sim-loader-overlay').classList.remove('hidden');
        
        const tx = this.db.transaction('simulators', 'readonly');
        const store = tx.objectStore('simulators');
        const req = store.get('active');

        req.onsuccess = (e) => {
            const res = e.target.result;
            if (res) {
                this.activeSimHtml = res.content;
                document.getElementById('sim-active-badge').innerText = `Active: ${res.name}`;
                this.runSimulatorIframe(res.content);
            } else {
                // If no active, load default
                this.loadDefaultSimulator();
            }
        };
    }

    loadDefaultSimulator() {
        const tx = this.db.transaction('simulators', 'readonly');
        const store = tx.objectStore('simulators');
        const req = store.get('default');

        req.onsuccess = (e) => {
            const res = e.target.result;
            if (res) {
                this.activeSimHtml = res.content;
                document.getElementById('sim-active-badge').innerText = 'Active: Default System';
                this.runSimulatorIframe(res.content);
            } else {
                // Hard fallback
                this.activeSimHtml = this.fallbackSimHtml;
                document.getElementById('sim-active-badge').innerText = 'Active: Fallback';
                this.runSimulatorIframe(this.fallbackSimHtml);
            }
        };
    }

    runSimulatorIframe(htmlContent) {
        // Blob URL sandboxing to allow local running with full browser capabilities and no CORS blocks
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const iframe = document.getElementById('simulator-iframe');
        iframe.src = url;
        
        iframe.onload = () => {
            document.getElementById('sim-loader-overlay').classList.add('hidden');
        };
    }

    handleSimulatorHtmlUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        document.getElementById('sim-loader-text').innerText = 'HTML 시뮬레이터 데이터 추출 및 저장 중...';
        document.getElementById('sim-loader-overlay').classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = (evt) => {
            const html = evt.target.result;
            
            const completeUpload = () => {
                this.loadActiveSimulator();
                alert(`🎮 새로운 시뮬레이터 '${file.name}'가 업로드되어 구동 중입니다.`);
            };

            // Save to IndexedDB as active simulator
            const tx = this.db.transaction('simulators', 'readwrite');
            const store = tx.objectStore('simulators');
            store.put({ id: 'active', name: file.name, content: html }).onsuccess = () => {
                if (this.isFirebaseConnected && this.fbRef) {
                    this.fbRef.child('simulators/active').set({
                        name: file.name,
                        content: html
                    }).then(() => completeUpload())
                      .catch(err => {
                          console.error("Firebase RTDB simulator sync error:", err);
                          completeUpload();
                      });
                } else {
                    completeUpload();
                }
            };
        };

        reader.readAsText(file);
    }

    restoreDefaultSimulator() {
        const tx = this.db.transaction('simulators', 'readwrite');
        const store = tx.objectStore('simulators');
        store.delete('active').onsuccess = () => {
            if (this.isFirebaseConnected && this.fbRef) {
                this.fbRef.child('simulators/active').remove().then(() => {
                    this.loadActiveSimulator();
                    alert('🔄 기본 3D 정밀 시뮬레이터로 복원되었습니다.');
                }).catch(err => {
                    console.error("Firebase RTDB simulator delete error:", err);
                    this.loadActiveSimulator();
                    alert('🔄 기본 3D 정밀 시뮬레이터로 복원되었습니다.');
                });
            } else {
                this.loadActiveSimulator();
                alert('🔄 기본 3D 정밀 시뮬레이터로 복원되었습니다.');
            }
        };
    }

    loadSharedSimulator(name, dataUri) {
        // Decode dataUri to string
        const base64 = dataUri.split(',')[1];
        const html = decodeURIComponent(escape(atob(base64)));

        const tx = this.db.transaction('simulators', 'readwrite');
        const store = tx.objectStore('simulators');
        store.put({ id: 'active', name: name, content: html }).onsuccess = () => {
            this.switchTab('simulator');
            alert(`🎮 채팅방에서 공유한 시뮬레이터 '${name}'를 구동합니다.`);
        };
    }

    // FILE & FOLDER STORAGE EXPLORER
    storageRender() {
        const container = document.getElementById('storage-explorer-container');
        container.innerHTML = '';

        // Breadcrumbs render
        this.renderStorageBreadcrumbs();

        // Fetch folders and files in currentStoragePath
        const tx = this.db.transaction('virtualFiles', 'readonly');
        const store = tx.objectStore('virtualFiles');
        const items = [];

        store.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                const item = cursor.value;
                if (item.path === this.currentStoragePath) {
                    items.push(item);
                }
                cursor.continue();
            } else {
                // End of records: sort folders first, then files alphabetically
                items.sort((a, b) => {
                    if (a.isFolder && !b.isFolder) return -1;
                    if (!a.isFolder && b.isFolder) return 1;
                    return a.name.localeCompare(b.name);
                });

                this.renderStorageItems(items);
                this.updateStorageUsage();
            }
        };
    }

    renderStorageBreadcrumbs() {
        const crumbs = document.getElementById('storage-breadcrumbs');
        crumbs.innerHTML = `<span class="text-blue-400 font-semibold cursor-pointer hover:underline" onclick="app.storageGoToFolder('/')">Root</span>`;

        if (this.currentStoragePath === '/') return;

        const parts = this.currentStoragePath.split('/').filter(p => p);
        let accumulatedPath = '';
        parts.forEach(p => {
            accumulatedPath += `/${p}`;
            const targetPath = accumulatedPath; // Closure copy
            crumbs.innerHTML += `
                <span class="text-slate-500 mx-1"><i class="fa-solid fa-chevron-right text-[10px]"></i></span>
                <span class="text-blue-400 font-semibold cursor-pointer hover:underline" onclick="app.storageGoToFolder('${targetPath}')">${p}</span>
            `;
        });
    }

    renderStorageItems(items) {
        const container = document.getElementById('storage-explorer-container');
        
        if (items.length === 0) {
            container.className = "flex-1 flex flex-col items-center justify-center text-slate-500 py-16 border-2 border-dashed border-slate-800 rounded-2xl";
            container.innerHTML = `
                <i class="fa-regular fa-folder-open text-5xl mb-2 text-slate-700"></i>
                <p class="text-xs">이 가상 폴더는 비어 있습니다.</p>
                <p class="text-[10px] text-slate-600 mt-1">파일을 드래그해서 떨어뜨리거나 상단 업로드 버튼을 클릭하세요.</p>
            `;
            return;
        }

        container.className = "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4";
        
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = "file-grid-item bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-between text-center cursor-pointer select-none relative group h-32";
            
            // Double click handler
            card.ondblclick = () => {
                if (item.isFolder) {
                    const nextPath = this.currentStoragePath === '/' ? `/${item.name}` : `${this.currentStoragePath}/${item.name}`;
                    this.storageGoToFolder(nextPath);
                } else {
                    this.showPreviewModal(item.name, item.type, item.content);
                }
            };

            // Icon chooser
            let iconHtml = '';
            if (item.isFolder) {
                iconHtml = '<i class="fa-solid fa-folder text-amber-500 text-3xl"></i>';
            } else {
                const name = item.name.toLowerCase();
                if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif')) {
                    iconHtml = '<i class="fa-regular fa-file-image text-emerald-400 text-3xl"></i>';
                } else if (name.endsWith('.csv') || name.endsWith('.xlsx')) {
                    iconHtml = '<i class="fa-solid fa-file-csv text-blue-400 text-3xl"></i>';
                } else if (name.endsWith('.html') || name.endsWith('.htm')) {
                    iconHtml = '<i class="fa-solid fa-code text-indigo-400 text-3xl"></i>';
                } else {
                    iconHtml = '<i class="fa-regular fa-file-lines text-slate-400 text-3xl"></i>';
                }
            }

            card.innerHTML = `
                <div class="flex-1 flex items-center justify-center mb-2">
                    ${iconHtml}
                </div>
                <div class="w-full">
                    <div class="text-[11px] font-medium text-slate-300 truncate w-full" title="${item.name}">${item.name}</div>
                    <div class="text-[9px] text-slate-500 mt-0.5">${item.isFolder ? '폴더' : (item.size / 1024).toFixed(1) + ' KB'}</div>
                </div>
            `;

            // Action buttons on hover capsule
            const actionContainer = document.createElement('div');
            actionContainer.className = "absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10 bg-slate-950/90 p-1 rounded-lg border border-slate-800 shadow-xl";
            
            // Cut button
            const cutBtn = document.createElement('button');
            cutBtn.className = "w-5 h-5 rounded hover:bg-blue-500/20 flex items-center justify-center text-slate-400 hover:text-blue-400 transition";
            cutBtn.innerHTML = '<i class="fa-solid fa-scissors text-[9px]"></i>';
            cutBtn.title = '잘라내기 (Cut)';
            cutBtn.onclick = (evt) => {
                evt.stopPropagation();
                this.cutStorageItem(item);
            };
            actionContainer.appendChild(cutBtn);

            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = "w-5 h-5 rounded hover:bg-indigo-500/20 flex items-center justify-center text-slate-400 hover:text-indigo-400 transition";
            copyBtn.innerHTML = '<i class="fa-regular fa-copy text-[9px]"></i>';
            copyBtn.title = '복사 (Copy)';
            copyBtn.onclick = (evt) => {
                evt.stopPropagation();
                this.copyStorageItem(item);
            };
            actionContainer.appendChild(copyBtn);

            // Duplicate button
            const dupBtn = document.createElement('button');
            dupBtn.className = "w-5 h-5 rounded hover:bg-emerald-500/20 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition";
            dupBtn.innerHTML = '<i class="fa-solid fa-clone text-[9px]"></i>';
            dupBtn.title = '복제 (Duplicate)';
            dupBtn.onclick = (evt) => {
                evt.stopPropagation();
                this.duplicateStorageItem(item);
            };
            actionContainer.appendChild(dupBtn);

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = "w-5 h-5 rounded hover:bg-rose-500/20 flex items-center justify-center text-slate-400 hover:text-rose-500 transition";
            delBtn.innerHTML = '<i class="fa-regular fa-trash-can text-[9px]"></i>';
            delBtn.title = '삭제 (Delete)';
            delBtn.onclick = (evt) => {
                evt.stopPropagation();
                this.handleDeleteStorageItem(item.id, item.name, item.isFolder);
            };
            actionContainer.appendChild(delBtn);

            card.appendChild(actionContainer);

            container.appendChild(card);
        });
    }

    storageGoToFolder(path) {
        this.currentStoragePath = path;
        this.storageRender();
    }

    openNewFolderModal() {
        document.getElementById('new-folder-modal').classList.remove('hidden');
        document.getElementById('new-folder-modal').classList.add('flex');
        document.getElementById('new-folder-name').focus();
    }

    closeNewFolderModal() {
        document.getElementById('new-folder-modal').classList.add('hidden');
        document.getElementById('new-folder-modal').classList.remove('flex');
        document.getElementById('new-folder-name').value = '';
    }

    handleCreateFolderSubmit() {
        const name = document.getElementById('new-folder-name').value.trim();
        if (!name) return;

        const newFolder = {
            path: this.currentStoragePath,
            name: name,
            isFolder: true,
            size: 0,
            type: '',
            content: '',
            localId: Date.now()
        };

        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.child('files').push(newFolder).then(() => {
                this.closeNewFolderModal();
            }).catch(err => console.error("Firebase RTDB folder create error:", err));
        } else {
            const tx = this.db.transaction('virtualFiles', 'readwrite');
            const store = tx.objectStore('virtualFiles');
            store.add({
                path: this.currentStoragePath,
                name: name,
                isFolder: true,
                size: 0,
                type: '',
                content: ''
            }).onsuccess = () => {
                this.closeNewFolderModal();
                this.storageRender();
            };
        }
    }

    handleDeleteStorageItem(id, name, isFolder) {
        const msg = isFolder 
            ? `폴더 '${name}'를 삭제하시겠습니까? (하위 항목이 있는 경우 폴더 내부 파일은 삭제되지 않고 잔존할 수 있습니다)`
            : `파일 '${name}'을 삭제하시겠습니까?`;
            
        if (!confirm(msg)) return;

        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.child('files').orderByChild('localId').equalTo(id).once('value').then(snapshot => {
                snapshot.forEach(child => {
                    child.ref.remove().catch(err => console.error("Firebase RTDB file delete error:", err));
                });
            }).catch(err => console.error("Firebase RTDB query error:", err));
        } else {
            const tx = this.db.transaction('virtualFiles', 'readwrite');
            const store = tx.objectStore('virtualFiles');
            store.delete(id).onsuccess = () => {
                this.storageRender();
            };
        }
    }

    handleStorageFileUpload(e) {
        const files = e.target.files;
        if (!files.length) return;

        const promises = Array.from(files).map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const fileObj = {
                        path: this.currentStoragePath,
                        name: file.name,
                        isFolder: false,
                        size: file.size,
                        type: file.type,
                        content: evt.target.result,
                        localId: Date.now() + Math.floor(Math.random() * 100)
                    };

                    if (this.isFirebaseConnected && this.fbRef) {
                        if (file.size > 900 * 1024) {
                            alert(`파일 '${file.name}'의 크기가 너무 큽니다 (최대 1MB 동기화 제한).`);
                            resolve();
                            return;
                        }
                        this.fbRef.child('files').push(fileObj)
                            .then(() => resolve())
                            .catch(err => {
                                console.error("Firebase RTDB file upload error:", err);
                                resolve();
                            });
                    } else {
                        const tx = this.db.transaction('virtualFiles', 'readwrite');
                        const store = tx.objectStore('virtualFiles');
                        store.add({
                            path: this.currentStoragePath,
                            name: file.name,
                            isFolder: false,
                            size: file.size,
                            type: file.type,
                            content: evt.target.result
                        }).onsuccess = () => resolve();
                    }
                };
                
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises).then(() => {
            document.getElementById('storage-file-input').value = '';
            this.storageRender();
            alert(`💾 ${files.length}개의 파일이 가상 저장소에 성공적으로 업로드되었습니다.`);
        });
    }

    handleStorageFolderUpload(e) {
        const files = e.target.files;
        if (!files.length) return;

        const promises = Array.from(files).map(file => {
            return new Promise((resolve) => {
                const relativePath = file.webkitRelativePath;
                const pathParts = relativePath.split('/');
                
                let currentVirtualSubpath = this.currentStoragePath;
                
                const buildFolders = async () => {
                    for(let i=0; i < pathParts.length - 1; i++) {
                        const folderName = pathParts[i];
                        const checkPath = currentVirtualSubpath;

                        if (this.isFirebaseConnected && this.fbRef) {
                            const folderId = `folder_${checkPath.replace(/\//g, '_')}_${folderName}`;
                            await this.fbRef.child('files').child(folderId).set({
                                path: checkPath,
                                name: folderName,
                                isFolder: true,
                                size: 0,
                                type: '',
                                content: '',
                                localId: Date.now() + i
                            }).catch(err => console.error("Firebase RTDB folder sync error:", err));
                        } else {
                            const txCheck = this.db.transaction('virtualFiles', 'readwrite');
                            const storeCheck = txCheck.objectStore('virtualFiles');
                            
                            await new Promise((resFolder) => {
                                let found = false;
                                storeCheck.openCursor().onsuccess = (ev) => {
                                    const cursor = ev.target.result;
                                    if (cursor) {
                                        if (cursor.value.path === checkPath && cursor.value.name === folderName && cursor.value.isFolder) {
                                            found = true;
                                        }
                                        cursor.continue();
                                    } else {
                                        if (!found) {
                                            storeCheck.add({
                                                path: checkPath,
                                                name: folderName,
                                                isFolder: true,
                                                size: 0,
                                                type: '',
                                                content: ''
                                            }).onsuccess = () => resFolder();
                                        } else {
                                            resFolder();
                                        }
                                    }
                                };
                            });
                        }
                        
                        currentVirtualSubpath = currentVirtualSubpath === '/' ? `/${folderName}` : `${currentVirtualSubpath}/${folderName}`;
                    }
                };

                buildFolders().then(() => {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        if (this.isFirebaseConnected && this.fbRef) {
                            if (file.size > 900 * 1024) {
                                alert(`파일 '${file.name}'의 크기가 너무 큽니다 (최대 1MB 동기화 제한).`);
                                resolve();
                                return;
                            }
                            this.fbRef.child('files').push({
                                path: currentVirtualSubpath,
                                name: file.name,
                                isFolder: false,
                                size: file.size,
                                type: file.type,
                                content: evt.target.result,
                                localId: Date.now() + Math.floor(Math.random() * 1000)
                            }).then(() => resolve())
                              .catch(err => {
                                  console.error("Firebase RTDB folder-file upload error:", err);
                                  resolve();
                              });
                        } else {
                            const tx = this.db.transaction('virtualFiles', 'readwrite');
                            const store = tx.objectStore('virtualFiles');
                            store.add({
                                path: currentVirtualSubpath,
                                name: file.name,
                                isFolder: false,
                                size: file.size,
                                type: file.type,
                                content: evt.target.result
                            }).onsuccess = () => resolve();
                        }
                    };
                    
                    reader.readAsDataURL(file);
                });
            });
        });

        Promise.all(promises).then(() => {
            document.getElementById('storage-folder-input').value = '';
            this.storageRender();
            alert(`💾 폴더 구조 및 파일(${files.length}개) 업로드가 완료되었습니다.`);
        });
    }

    // Drag and drop virtual file storage
    handleStorageDragOver(e) {
        e.preventDefault();
    }

    handleStorageDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (!files.length) return;
        
        // Mock drop file load
        const promises = Array.from(files).map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const fileObj = {
                        path: this.currentStoragePath,
                        name: file.name,
                        isFolder: false,
                        size: file.size,
                        type: file.type,
                        content: evt.target.result,
                        localId: Date.now() + Math.floor(Math.random() * 100)
                    };
                    if (this.isFirebaseConnected && this.fbRef) {
                        if (file.size > 900 * 1024) {
                            alert(`파일 '${file.name}'의 크기가 너무 큽니다 (최대 1MB 동기화 제한).`);
                            resolve();
                            return;
                        }
                        this.fbRef.child('files').push(fileObj)
                            .then(() => resolve())
                            .catch(err => {
                                console.error("Firebase RTDB file drop error:", err);
                                resolve();
                            });
                    } else {
                        const tx = this.db.transaction('virtualFiles', 'readwrite');
                        const store = tx.objectStore('virtualFiles');
                        store.add({
                            path: this.currentStoragePath,
                            name: file.name,
                            isFolder: false,
                            size: file.size,
                            type: file.type,
                            content: evt.target.result
                        }).onsuccess = () => resolve();
                    }
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises).then(() => {
            this.storageRender();
            alert(`💾 드래그 앤 드롭으로 ${files.length}개 파일이 업로드되었습니다.`);
        });
    }

    updateStorageUsage() {
        const tx = this.db.transaction('virtualFiles', 'readonly');
        const store = tx.objectStore('virtualFiles');
        let totalSize = 0;
        let fileCount = 0;
        let folderCount = 0;

        store.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                if (cursor.value.isFolder) {
                    folderCount++;
                } else {
                    fileCount++;
                    totalSize += cursor.value.size;
                }
                cursor.continue();
            } else {
                const sizeText = (totalSize / 1024).toFixed(1);
                document.getElementById('storage-usage-text').innerText = `가상 드라이브 요약: 파일 ${fileCount}개 | 폴더 ${folderCount}개 | 총 용량 ${sizeText} KB (IndexedDB 저장)`;
            }
        };
    }

    // FILE PREVIEW MODAL MODULE
    showPreviewModal(name, type, content) {
        document.getElementById('preview-modal').classList.remove('hidden');
        document.getElementById('preview-modal').classList.add('flex');

        document.getElementById('preview-file-name').innerText = name;

        const icon = document.getElementById('preview-file-icon');
        const container = document.getElementById('preview-content-area');
        container.innerHTML = '';

        const isDataURL = typeof content === 'string' && content.startsWith('data:');
        
        // Helper to decode Base64 UTF-8 string properly
        const decodeBase64ToText = (dataurl) => {
            try {
                const arr = dataurl.split(',');
                const base64 = arr[1];
                const binString = atob(base64);
                const bytes = new Uint8Array(binString.length);
                for (let i = 0; i < binString.length; i++) {
                    bytes[i] = binString.charCodeAt(i);
                }
                // Use fatal: true to throw error if it contains invalid binary sequences (indicating a binary file)
                return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } catch (err) {
                console.warn("Base64 text decoding failed, treating as binary file:", err);
                return null;
            }
        };

        // Configure download button
        const dBtn = document.getElementById('preview-download-btn');
        dBtn.onclick = () => {
            this.downloadFile(name, type, content);
        };

        // Determine text content for text-based previews
        let textContent = content;
        if (isDataURL && !type.startsWith('image/')) {
            textContent = decodeBase64ToText(content);
        }

        // Render preview content based on type
        if (type.startsWith('image/')) {
            icon.className = 'fa-regular fa-file-image text-emerald-400';
            const img = document.createElement('img');
            img.src = content;
            img.className = 'max-w-full max-h-[70vh] rounded shadow-lg object-contain';
            container.appendChild(img);
        } else if (type === 'application/pdf') {
            icon.className = 'fa-regular fa-file-pdf text-rose-500';
            const frame = document.createElement('iframe');
            frame.className = 'w-full h-[70vh] bg-white rounded-lg border border-slate-700';
            const blob = isDataURL ? this.dataURLtoBlob(content) : new Blob([content], { type: type });
            frame.src = URL.createObjectURL(blob);
            container.appendChild(frame);
        } else if (textContent === null) {
            // Unpreviewable binary file placeholder card
            let binIcon = 'fa-solid fa-file-zipper text-blue-400';
            const lowerName = name.toLowerCase();
            if (lowerName.endsWith('.zip') || lowerName.endsWith('.rar') || lowerName.endsWith('.7z') || lowerName.endsWith('.tar') || lowerName.endsWith('.gz')) {
                binIcon = 'fa-solid fa-file-zipper text-blue-400';
            } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
                binIcon = 'fa-solid fa-file-excel text-emerald-400';
            } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
                binIcon = 'fa-solid fa-file-word text-blue-500';
            } else if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')) {
                binIcon = 'fa-solid fa-file-powerpoint text-orange-500';
            } else {
                binIcon = 'fa-solid fa-file text-slate-400';
            }
            
            icon.className = binIcon;
            
            const card = document.createElement('div');
            card.className = "flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-4 max-w-sm mx-auto";
            
            const sizeText = isDataURL 
                ? (this.dataURLtoBlob(content).size / 1024).toFixed(1)
                : '알 수 없음';
                
            card.innerHTML = `
                <div class="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-3xl mb-2">
                    <i class="${binIcon}"></i>
                </div>
                <div class="space-y-1">
                    <div class="font-bold text-slate-200 text-sm truncate max-w-[280px]">${name}</div>
                    <div class="text-[10px] text-slate-500">${sizeText} KB | ${type || '바이너리 파일'}</div>
                </div>
                <p class="text-xs text-slate-500 leading-relaxed px-4">이 파일 형식은 브라우저 직접 미리보기를 지원하지 않습니다. 아래 버튼을 눌러 로컬 기기로 다운로드하세요.</p>
                <button onclick="app.downloadFile('${name.replace(/'/g, "\\'")}', '${type}', '${content}')" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                    <i class="fa-solid fa-download"></i>
                    <span>파일 다운로드</span>
                </button>
            `;
            container.appendChild(card);
        } else if (name.endsWith('.csv')) {
            icon.className = 'fa-solid fa-file-csv text-blue-400';
            // Parse CSV and render HTML table
            const table = document.createElement('table');
            table.className = 'min-w-full border-collapse border border-slate-700 text-xs text-slate-300 text-center bg-slate-900/60';
            const lines = textContent.split('\n').filter(l => l);
            lines.forEach((line, idx) => {
                const tr = document.createElement('tr');
                const parts = line.split(',');
                parts.forEach(part => {
                    const cell = idx === 0 ? document.createElement('th') : document.createElement('td');
                    cell.className = 'border border-slate-750 p-2.5';
                    if (idx === 0) cell.className += ' bg-slate-800 text-white font-bold';
                    cell.innerText = part.replace(/^"|"$/g, '');
                    tr.appendChild(cell);
                });
                table.appendChild(tr);
            });
            container.appendChild(table);
        } else if (name.endsWith('.html')) {
            icon.className = 'fa-solid fa-code text-indigo-400';
            // Run HTML code inside sandbox iframe
            const frame = document.createElement('iframe');
            frame.className = 'w-full h-[70vh] bg-white rounded-lg border border-slate-700';
            frame.sandbox = 'allow-scripts';
            const blob = new Blob([textContent], { type: 'text/html' });
            frame.src = URL.createObjectURL(blob);
            container.appendChild(frame);
        } else {
            // Text files
            icon.className = 'fa-regular fa-file-lines text-slate-400';
            const pre = document.createElement('pre');
            pre.className = 'w-full bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 text-left overflow-x-auto leading-relaxed border border-slate-800 whitespace-pre-wrap';
            pre.innerText = textContent;
            container.appendChild(pre);
        }
    }

    closePreviewModal() {
        document.getElementById('preview-modal').classList.add('hidden');
        document.getElementById('preview-modal').classList.remove('flex');
    }

    dataURLtoBlob(dataurl) {
        const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    }

    downloadFile(name, type, content) {
        const isDataURL = typeof content === 'string' && content.startsWith('data:');
        const blob = isDataURL 
            ? this.dataURLtoBlob(content) 
            : new Blob([content], { type: type });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ADMIN CONTROL MODULES
    renderAdminUsersList() {
        if (!this.currentUser) return;
        const tbody = document.getElementById('admin-users-table-body');
        tbody.innerHTML = '';

        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        document.getElementById('admin-user-count').innerText = `총 ${users.length}명`;

        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800/50 hover:bg-slate-800/20';
            const avatarHtml = u.avatar 
                ? `<img src="${u.avatar}" class="w-5 h-5 rounded-full object-cover inline-block mr-1.5 align-middle">` 
                : `<div class="w-5 h-5 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center text-[9px] font-bold text-slate-400 inline-block mr-1.5 align-middle">${u.name.substring(0,1)}</div>`;
            tr.innerHTML = `
                <td class="py-2.5 font-semibold text-slate-200">${avatarHtml}${u.name}</td>
                <td class="py-2.5 font-mono text-slate-400">@${u.id}</td>
                <td class="py-2.5 font-mono text-slate-400">
                    <input type="password" value="${u.pw}" onchange="app.adminUpdateUserPassword('${u.id}', this.value)" class="bg-transparent text-slate-400 border border-slate-800 focus:border-slate-700 rounded px-1.5 py-0.5 outline-none text-[11px] w-24">
                </td>
                <td class="py-2.5">
                    <select onchange="app.adminUpdateUserRole('${u.id}', this.value)" class="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 outline-none text-[10px] text-slate-300">
                        <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                        <option value="MEMBER" ${u.role === 'MEMBER' ? 'selected' : ''}>MEMBER</option>
                    </select>
                </td>
                <td class="py-2.5 text-right">
                    <button onclick="app.adminDeleteUser('${u.id}')" class="text-rose-500 hover:text-rose-400 font-medium text-[11px]" ${u.id === this.currentUser.id ? 'disabled class="text-slate-600 cursor-not-allowed"' : ''}>계정 삭제</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    adminUpdateUserPassword(id, newPw) {
        if (!newPw) return;
        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        const u = users.find(user => user.id === id);
        if (u) {
            u.pw = newPw;
            localStorage.setItem('rocket_users', JSON.stringify(users));
            alert(`🔑 @${id} 의 비밀번호가 변경되었습니다.`);

            if (this.isFirebaseConnected && this.fbRef) {
                this.fbRef.child('users').child(id).set(u);
            }
        }
    }

    adminUpdateUserRole(id, role) {
        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        const u = users.find(user => user.id === id);
        if (u) {
            u.role = role;
            localStorage.setItem('rocket_users', JSON.stringify(users));
            alert(`🛡️ @${id} 의 역할이 ${role} 로 업데이트되었습니다.`);
            
            // If logged-in user changed their own role, re-evaluate profile UI
            if (id === this.currentUser.id) {
                this.currentUser.role = role;
                localStorage.setItem('rocket_session', JSON.stringify(this.currentUser));
                this.showMainApp();
            }

            if (this.isFirebaseConnected && this.fbRef) {
                this.fbRef.child('users').child(id).set(u);
            }
        }
    }

    adminDeleteUser(id) {
        if (id === this.currentUser.id) {
            alert('자신의 계정은 삭제할 수 없습니다.');
            return;
        }

        if (!confirm(`정말로 @${id} 계정을 완전히 삭제하시겠습니까?`)) return;

        let users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        users = users.filter(u => u.id !== id);
        localStorage.setItem('rocket_users', JSON.stringify(users));

        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.child('users').child(id).remove().then(() => {
                this.renderAdminUsersList();
            });
        } else {
            this.renderAdminUsersList();
        }
    }

    renderAdminRequestsList() {
        if (!this.currentUser) return;
        const container = document.getElementById('admin-pw-requests-list');
        container.innerHTML = '';

        const requests = JSON.parse(localStorage.getItem('rocket_pw_requests') || '[]');
        const pending = requests.filter(r => r.status === 'PENDING');

        if (pending.length === 0) {
            container.innerHTML = `
                <div class="py-6 text-center text-slate-500 text-xs">
                    <i class="fa-regular fa-circle-check text-xl mb-1.5 text-slate-700"></i>
                    <div>미처리된 문의 내역이 없습니다.</div>
                </div>
            `;
            return;
        }

        pending.forEach(r => {
            const item = document.createElement('div');
            item.className = 'bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-left';
            
            // Format request message
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-bold text-slate-200 text-xs">${r.name}</span>
                        <span class="text-[10px] text-blue-400 block mt-0.5">${r.replyEmail}</span>
                    </div>
                    <span class="text-[9px] text-slate-500 font-mono">${new Date(r.timestamp).toLocaleString()}</span>
                </div>
                <div class="bg-slate-950 p-2.5 rounded text-[11px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">${r.message}</div>
                <div class="flex gap-2 justify-end">
                    <button onclick="app.adminResolveRequest(${r.id}, 'check')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded transition">완료 처리</button>
                    <button onclick="app.adminResolveRequest(${r.id}, 'reset')" class="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold px-2 py-1 rounded transition">비번 일괄 초기화(1234)</button>
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    adminResolveRequest(reqId, action) {
        let requests = JSON.parse(localStorage.getItem('rocket_pw_requests') || '[]');
        const r = requests.find(req => req.id === reqId);
        
        if (!r) return;

        if (action === 'reset') {
            // Find user accounts matching name
            const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
            const matched = users.filter(u => u.name === r.name);
            
            if (matched.length > 0) {
                matched.forEach(u => u.pw = '1234');
                localStorage.setItem('rocket_users', JSON.stringify(users));
                alert(`🔑 '${r.name}' 팀원의 가입된 계정 비밀번호가 임시 비밀번호 '1234'로 초기화되었습니다.`);

                // Write updated users back to RTDB
                if (this.isFirebaseConnected && this.fbRef) {
                    matched.forEach(u => {
                        this.fbRef.child('users').child(u.id).set(u);
                    });
                }
            } else {
                alert(`실명이 '${r.name}'인 사용자가 가입되어 있지 않습니다. 가입 후 처리해 주세요.`);
                return;
            }
        }

        // Mark request as RESOLVED
        r.status = 'RESOLVED';
        localStorage.setItem('rocket_pw_requests', JSON.stringify(requests));

        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.child('pw_requests').child(reqId).child('status').set('RESOLVED');
        }
        
        this.renderAdminRequestsList();
        this.renderAdminUsersList();
    }

    exportDatabaseBackup() {
        const backupData = {
            localStorage: {
                users: localStorage.getItem('rocket_users'),
                messages: localStorage.getItem('rocket_messages'),
                requests: localStorage.getItem('rocket_pw_requests'),
                activeTable: localStorage.getItem('rocket_active_table'),
                activeReport: localStorage.getItem('rocket_active_report'),
                theme: localStorage.getItem('rocket_theme')
            },
            indexedDb: {
                virtualFiles: [],
                simulators: []
            }
        };

        const tx1 = this.db.transaction('virtualFiles', 'readonly');
        const store1 = tx1.objectStore('virtualFiles');
        
        store1.getAll().onsuccess = (e) => {
            backupData.indexedDb.virtualFiles = e.target.result;
            
            const tx2 = this.db.transaction('simulators', 'readonly');
            const store2 = tx2.objectStore('simulators');
            
            store2.getAll().onsuccess = (e2) => {
                backupData.indexedDb.simulators = e2.target.result;

                const jsonStr = JSON.stringify(backupData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', `rocketlab_db_backup_${new Date().toISOString().slice(0,10)}.json`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                alert('💾 로컬 데이터베이스 백업 파일 내보내기가 완료되었습니다.');
            };
        };
    }

    importDatabaseBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm('⚠️ 데이터베이스 백업 가져오기\n가져오기를 진행하면 현재 브라우저에 저장된 모든 데이터(대화 내용, 업로드 파일 등)가 백업 파일 데이터로 대체됩니다. 계속하시겠습니까?')) {
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.localStorage) {
                    const lsKeys = {
                        users: 'rocket_users',
                        messages: 'rocket_messages',
                        requests: 'rocket_pw_requests',
                        activeTable: 'rocket_active_table',
                        activeReport: 'rocket_active_report',
                        theme: 'rocket_theme'
                    };
                    
                    Object.keys(lsKeys).forEach(key => {
                        if (data.localStorage[key] !== null && data.localStorage[key] !== undefined) {
                            localStorage.setItem(lsKeys[key], data.localStorage[key]);
                        }
                    });
                }

                if (data.indexedDb) {
                    if (Array.isArray(data.indexedDb.virtualFiles)) {
                        const tx1 = this.db.transaction('virtualFiles', 'readwrite');
                        const store1 = tx1.objectStore('virtualFiles');
                        store1.clear().onsuccess = () => {
                            data.indexedDb.virtualFiles.forEach(fileObj => {
                                store1.add(fileObj);
                            });
                        };
                    }

                    if (Array.isArray(data.indexedDb.simulators)) {
                        const tx2 = this.db.transaction('simulators', 'readwrite');
                        const store2 = tx2.objectStore('simulators');
                        store2.clear().onsuccess = () => {
                            data.indexedDb.simulators.forEach(simObj => {
                                store2.add(simObj);
                            });
                        };
                    }
                }

                alert('🔌 데이터베이스 가져오기가 성공적으로 완료되었습니다. 최신화 적용을 위해 화면을 새로고침합니다.');
                window.location.reload();

            } catch (err) {
                console.error(err);
                alert('❌ 올바르지 않은 백업 파일 형식이거나 읽기 오류가 발생했습니다.');
            }
        };

        reader.readAsText(file);
    }

    resetWholeAppDatabase() {
        if (!confirm('⚠️ [경고] 앱 전체 데이터 초기화\n현재 브라우저에 저장된 모든 대화 내용, 업로드한 파일, 가입 계정 정보가 완전히 영구 삭제됩니다. 계속 진행하시겠습니까?')) {
            return;
        }

        const completeReset = () => {
            // Clear LocalStorage
            localStorage.removeItem('rocket_session');
            localStorage.removeItem('rocket_users');
            localStorage.removeItem('rocket_messages');
            localStorage.removeItem('rocket_pw_requests');
            localStorage.removeItem('rocket_active_table');
            localStorage.removeItem('rocket_active_report');
            localStorage.removeItem('rocket_theme');

            // Clear IndexedDB stores
            const tx1 = this.db.transaction('virtualFiles', 'readwrite');
            tx1.objectStore('virtualFiles').clear();

            const tx2 = this.db.transaction('simulators', 'readwrite');
            tx2.objectStore('simulators').clear();

            alert('💥 데이터베이스가 완전 초기화되었습니다. 페이지를 새로고침하여 시스템을 재시작합니다.');
            window.location.reload();
        };

        if (this.isFirebaseConnected && this.fbRef) {
            this.fbRef.remove()
                .then(() => completeReset())
                .catch(err => {
                    console.error("Firebase RTDB reset error:", err);
                    completeReset();
                });
        } else {
            completeReset();
        }
    }

    // ==========================================
    // VIRTUAL FILE EXPLORER CLIPBOARD ACTIONS
    // ==========================================
    copyStorageItem(item) {
        this.clipboardItem = item;
        this.clipboardAction = 'copy';
        
        const pasteBtn = document.getElementById('storage-paste-btn');
        if (pasteBtn) {
            pasteBtn.classList.remove('hidden');
            pasteBtn.title = `'${item.name}' 복사 대기 중`;
        }
        console.log("Copied to clipboard:", item);
    }

    cutStorageItem(item) {
        this.clipboardItem = item;
        this.clipboardAction = 'cut';
        
        const pasteBtn = document.getElementById('storage-paste-btn');
        if (pasteBtn) {
            pasteBtn.classList.remove('hidden');
            pasteBtn.title = `'${item.name}' 이동 대기 중`;
        }
        console.log("Cut to clipboard:", item);
    }

    async duplicateStorageItem(item) {
        const uniqueName = await this.getUniqueStorageName(this.currentStoragePath, item.name, item.isFolder);
        
        if (item.isFolder) {
            await this.duplicateFolderRecursive(item.path, item.name, uniqueName);
        } else {
            await this.duplicateFile(this.currentStoragePath, uniqueName, item.type, item.content, item.size);
        }
        this.storageRender();
    }

    async pasteStorageItem() {
        if (!this.clipboardItem) return;
        const item = this.clipboardItem;
        const action = this.clipboardAction;

        if (action === 'cut' && item.path === this.currentStoragePath) {
            alert("📋 이미 현재 폴더에 위치해 있습니다.");
            this.clearClipboard();
            return;
        }

        const sourcePath = item.isFolder 
            ? (item.path === '/' ? `/${item.name}` : `${item.path}/${item.name}`)
            : '';
        if (item.isFolder && (this.currentStoragePath === sourcePath || this.currentStoragePath.startsWith(sourcePath + '/'))) {
            alert("❌ 폴더를 자기 자신 혹은 하위 폴더로 붙여넣을 수 없습니다.");
            this.clearClipboard();
            return;
        }

        let targetName = item.name;
        const nameConflict = await this.checkStorageNameConflict(this.currentStoragePath, item.name, item.isFolder);
        if (nameConflict || action === 'copy') {
            targetName = await this.getUniqueStorageName(this.currentStoragePath, item.name, item.isFolder);
        }

        if (action === 'copy') {
            if (item.isFolder) {
                await this.duplicateFolderRecursive(this.currentStoragePath, item.name, targetName);
            } else {
                await this.duplicateFile(this.currentStoragePath, targetName, item.type, item.content, item.size);
            }
        } else if (action === 'cut') {
            if (item.isFolder) {
                await this.moveFolderRecursive(item.id || item.localId, item.path, item.name, this.currentStoragePath, targetName);
            } else {
                await this.moveFile(item.id || item.localId, this.currentStoragePath, targetName);
            }
        }

        this.clearClipboard();
        this.storageRender();
    }

    clearClipboard() {
        this.clipboardItem = null;
        this.clipboardAction = null;
        const pasteBtn = document.getElementById('storage-paste-btn');
        if (pasteBtn) {
            pasteBtn.classList.add('hidden');
        }
    }

    checkStorageNameConflict(path, name, isFolder) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('virtualFiles', 'readonly');
            const store = tx.objectStore('virtualFiles');
            let conflict = false;
            store.openCursor().onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const f = cursor.value;
                    if (f.path === path && f.name === name && f.isFolder === isFolder) {
                        conflict = true;
                    }
                    cursor.continue();
                } else {
                    resolve(conflict);
                }
            };
        });
    }

    getUniqueStorageName(path, name, isFolder) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('virtualFiles', 'readonly');
            const store = tx.objectStore('virtualFiles');
            const existingNames = [];
            
            store.openCursor().onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const f = cursor.value;
                    if (f.path === path && f.isFolder === isFolder) {
                        existingNames.push(f.name);
                    }
                    cursor.continue();
                } else {
                    let baseName = name;
                    let extension = '';
                    if (!isFolder && name.includes('.')) {
                        const idx = name.lastIndexOf('.');
                        baseName = name.substring(0, idx);
                        extension = name.substring(idx);
                    }
                    
                    let candidate = `${baseName}_복사본${extension}`;
                    let counter = 1;
                    while (existingNames.includes(candidate)) {
                        candidate = `${baseName}_복사본(${counter})${extension}`;
                        counter++;
                    }
                    resolve(candidate);
                }
            };
        });
    }

    duplicateFile(targetPath, newName, type, content, size) {
        return new Promise((resolve) => {
            const fileObj = {
                path: targetPath,
                name: newName,
                isFolder: false,
                size: size,
                type: type,
                content: content,
                localId: Date.now() + Math.floor(Math.random() * 1000)
            };

            if (this.isFirebaseConnected && this.fbRef) {
                this.fbRef.child('files').push(fileObj)
                    .then(() => resolve())
                    .catch(err => {
                        console.error("Firebase RTDB file duplication error:", err);
                        resolve();
                    });
            } else {
                const tx = this.db.transaction('virtualFiles', 'readwrite');
                const store = tx.objectStore('virtualFiles');
                store.add({
                    path: targetPath,
                    name: newName,
                    isFolder: false,
                    size: size,
                    type: type,
                    content: content
                }).onsuccess = () => resolve();
            }
        });
    }

    async duplicateFolderRecursive(parentPath, originalName, newName) {
        const sourceFolderPath = parentPath === '/' ? `/${originalName}` : `${parentPath}/${originalName}`;
        const targetFolderPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;

        await new Promise((resolve) => {
            const folderObj = {
                path: parentPath,
                name: newName,
                isFolder: true,
                size: 0,
                type: '',
                content: '',
                localId: Date.now() + Math.floor(Math.random() * 1000)
            };
            if (this.isFirebaseConnected && this.fbRef) {
                this.fbRef.child('files').push(folderObj).then(() => resolve());
            } else {
                const tx = this.db.transaction('virtualFiles', 'readwrite');
                tx.objectStore('virtualFiles').add({
                    path: parentPath,
                    name: newName,
                    isFolder: true,
                    size: 0,
                    type: '',
                    content: ''
                }).onsuccess = () => resolve();
            }
        });

        const tx = this.db.transaction('virtualFiles', 'readonly');
        const store = tx.objectStore('virtualFiles');
        const descendants = [];

        await new Promise((resolve) => {
            store.openCursor().onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const item = cursor.value;
                    if (item.path === sourceFolderPath || item.path.startsWith(sourceFolderPath + '/')) {
                        descendants.push(item);
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });

        for (const item of descendants) {
            const relativePath = item.path.substring(sourceFolderPath.length);
            const targetPath = targetFolderPath + relativePath;

            await new Promise((resolve) => {
                const copyObj = {
                    path: targetPath,
                    name: item.name,
                    isFolder: item.isFolder,
                    size: item.size,
                    type: item.type,
                    content: item.content,
                    localId: Date.now() + Math.floor(Math.random() * 1000)
                };
                if (this.isFirebaseConnected && this.fbRef) {
                    this.fbRef.child('files').push(copyObj).then(() => resolve());
                } else {
                    const txAdd = this.db.transaction('virtualFiles', 'readwrite');
                    txAdd.objectStore('virtualFiles').add({
                        path: targetPath,
                        name: item.name,
                        isFolder: item.isFolder,
                        size: item.size,
                        type: item.type,
                        content: item.content
                    }).onsuccess = () => resolve();
                }
            });
        }
    }

    moveFile(id, targetPath, targetName) {
        return new Promise((resolve) => {
            if (this.isFirebaseConnected && this.fbRef) {
                this.fbRef.child('files').once('value').then(snapshot => {
                    const val = snapshot.val();
                    let fbKey = null;
                    if (val) {
                        fbKey = Object.keys(val).find(k => val[k].localId === id || k === id || val[k].id === id);
                    }
                    if (fbKey) {
                        this.fbRef.child('files').child(fbKey).update({
                            path: targetPath,
                            name: targetName
                        }).then(() => resolve());
                    } else {
                        resolve();
                    }
                });
            } else {
                const tx = this.db.transaction('virtualFiles', 'readwrite');
                const store = tx.objectStore('virtualFiles');
                store.get(id).onsuccess = (e) => {
                    const file = e.target.result;
                    if (file) {
                        file.path = targetPath;
                        file.name = targetName;
                        store.put(file).onsuccess = () => resolve();
                    } else {
                        resolve();
                    }
                };
            }
        });
    }

    async moveFolderRecursive(folderId, originalParentPath, folderName, targetParentPath, newFolderName) {
        const sourceFolderPath = originalParentPath === '/' ? `/${folderName}` : `${originalParentPath}/${folderName}`;
        const targetFolderPath = targetParentPath === '/' ? `/${newFolderName}` : `${targetParentPath}/${newFolderName}`;

        await new Promise((resolve) => {
            if (this.isFirebaseConnected && this.fbRef) {
                this.fbRef.child('files').once('value').then(snapshot => {
                    const val = snapshot.val();
                    let fbKey = null;
                    if (val) {
                        fbKey = Object.keys(val).find(k => val[k].localId === folderId || k === folderId || val[k].id === folderId);
                    }
                    if (fbKey) {
                        this.fbRef.child('files').child(fbKey).update({
                            path: targetParentPath,
                            name: newFolderName
                        }).then(() => resolve());
                    } else {
                        resolve();
                    }
                });
            } else {
                const tx = this.db.transaction('virtualFiles', 'readwrite');
                const store = tx.objectStore('virtualFiles');
                store.get(folderId).onsuccess = (e) => {
                    const f = e.target.result;
                    if (f) {
                        f.path = targetParentPath;
                        f.name = newFolderName;
                        store.put(f).onsuccess = () => resolve();
                    } else {
                        resolve();
                    }
                };
            }
        });

        const tx = this.db.transaction('virtualFiles', 'readonly');
        const store = tx.objectStore('virtualFiles');
        const descendants = [];

        await new Promise((resolve) => {
            store.openCursor().onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const item = cursor.value;
                    if (item.path === sourceFolderPath || item.path.startsWith(sourceFolderPath + '/')) {
                        descendants.push(item);
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });

        for (const item of descendants) {
            const relativePath = item.path.substring(sourceFolderPath.length);
            const targetPath = targetFolderPath + relativePath;

            await new Promise((resolve) => {
                if (this.isFirebaseConnected && this.fbRef) {
                    this.fbRef.child('files').once('value').then(snapshot => {
                        const val = snapshot.val();
                        let fbKey = null;
                        if (val) {
                            fbKey = Object.keys(val).find(k => val[k].localId === item.id || k === item.id || val[k].id === item.id);
                        }
                        if (fbKey) {
                            this.fbRef.child('files').child(fbKey).update({
                                path: targetPath
                            }).then(() => resolve());
                        } else {
                            resolve();
                        }
                    });
                } else {
                    const txUpdate = this.db.transaction('virtualFiles', 'readwrite');
                    const storeUpdate = txUpdate.objectStore('virtualFiles');
                    storeUpdate.get(item.id).onsuccess = (e) => {
                        const f = e.target.result;
                        if (f) {
                            f.path = targetPath;
                            storeUpdate.put(f).onsuccess = () => resolve();
                        } else {
                            resolve();
                        }
                    };
                }
            });
        }
    }

    showProfileEditModal() {
        if (!this.currentUser) return;
        const modal = document.getElementById('profile-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const previewImg = document.getElementById('profile-avatar-preview');
        const previewText = document.getElementById('profile-avatar-text-preview');
        if (this.currentUser.avatar) {
            previewImg.src = this.currentUser.avatar;
            previewImg.classList.remove('hidden');
            previewText.classList.add('hidden');
        } else {
            previewImg.classList.add('hidden');
            previewText.innerText = this.currentUser.name.substring(0, 1);
            previewText.classList.remove('hidden');
        }

        document.getElementById('profile-id-current').value = '';
        document.getElementById('profile-id-new').value = '';
        document.getElementById('profile-id-confirm').value = '';
        document.getElementById('profile-pw-current').value = '';
        document.getElementById('profile-pw-new').value = '';
        document.getElementById('profile-pw-confirm').value = '';
        this.tempAvatarData = null;
    }

    closeProfileModal() {
        const modal = document.getElementById('profile-modal');
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        this.tempAvatarData = null;
    }

    handleProfileAvatarSelected(e) {
        const file = e.target.files[0];
        if (!file) return;

        const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];
        const fileName = file.name.toLowerCase();
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        if (!allowedExtensions.includes(extension)) {
            alert("❌ 허용되지 않는 파일 형식입니다. png, jpg, jpeg, webp, bmp 형식의 이미지만 업로드 가능합니다.");
            e.target.value = '';
            return;
        }

        if (file.size > 1024 * 1024) {
            alert("❌ 파일 크기가 1MB를 초과합니다. 1MB 이하의 이미지만 업로드 가능합니다.");
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            this.tempAvatarData = event.target.result;
            const previewImg = document.getElementById('profile-avatar-preview');
            const previewText = document.getElementById('profile-avatar-text-preview');
            previewImg.src = this.tempAvatarData;
            previewImg.classList.remove('hidden');
            previewText.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    async handleProfileAvatarSave() {
        if (!this.tempAvatarData) {
            alert("❌ 적용할 이미지를 선택해 주세요.");
            return;
        }
        if (!this.currentUser) return;

        this.currentUser.avatar = this.tempAvatarData;
        localStorage.setItem('rocket_session', JSON.stringify(this.currentUser));

        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        const userIdx = users.findIndex(u => u && u.id === this.currentUser.id);
        if (userIdx !== -1) {
            users[userIdx].avatar = this.tempAvatarData;
            localStorage.setItem('rocket_users', JSON.stringify(users));
        }

        if (this.isFirebaseConnected && this.fbRef) {
            try {
                await this.fbRef.child('users').child(this.currentUser.id).child('avatar').set(this.tempAvatarData);
            } catch (err) {
                console.error("Firebase avatar upload failed:", err);
                alert("❌ 실시간 데이터베이스 아바타 업데이트 실패. 로컬에만 임시 적용됩니다.");
                return;
            }
        }

        alert("✅ 프로필 사진이 성공적으로 적용되었습니다.");
        this.showMainApp();
        this.closeProfileModal();
    }

    async handleProfileIdUpdateSubmit() {
        if (!this.currentUser) return;

        const currentId = document.getElementById('profile-id-current').value.trim();
        const newId = document.getElementById('profile-id-new').value.trim();
        const confirmId = document.getElementById('profile-id-confirm').value.trim();

        if (!currentId || !newId || !confirmId) {
            alert("❌ 모든 필드를 입력해 주세요.");
            return;
        }

        if (currentId !== this.currentUser.id) {
            alert("❌ 현재 아이디가 일치하지 않습니다.");
            return;
        }

        if (newId === this.currentUser.id) {
            alert("❌ 변경할 아이디가 현재 아이디와 동일합니다.");
            return;
        }

        if (newId !== confirmId) {
            alert("❌ 변경할 아이디 확인이 일치하지 않습니다.");
            return;
        }

        // Constraints check: Korean, English, numbers only (no special characters)
        const idRegex = /^[a-zA-Z0-9가-힣]+$/;
        if (!idRegex.test(newId)) {
            alert("❌ 아이디에 특수문자는 사용할 수 없습니다. (한글, 영어, 숫자만 허용)");
            return;
        }

        // Firebase forbidden characters check
        const firebaseForbidden = /[\.\$\#\[\]\/]/;
        if (firebaseForbidden.test(newId)) {
            alert("❌ 아이디에 파이어베이스 제한 문자(., $, #, [, ], /)는 사용할 수 없습니다.");
            return;
        }

        // Duplicate check
        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        const exists = users.some(u => u && u.id === newId);
        if (exists) {
            alert("❌ 이미 사용 중인 아이디입니다.");
            return;
        }

        if (this.isFirebaseConnected && this.fbRef) {
            try {
                const snapshot = await this.fbRef.child('users').child(newId).once('value');
                if (snapshot.exists()) {
                    alert("❌ 이미 사용 중인 아이디입니다.");
                    return;
                }
            } catch (err) {
                console.error("Firebase ID check failed:", err);
            }
        }

        const proceed = confirm("⚠️ 아이디 변경 시 현재 ID가 삭제되고 로그인이 해제되오니 다시 로그인해야 합니다. 변경하시겠습니까?");
        if (!proceed) return;

        const oldId = this.currentUser.id;
        const newUserData = { ...this.currentUser, id: newId };

        // 1. Update users database
        if (this.isFirebaseConnected && this.fbRef) {
            try {
                await this.fbRef.child('users').child(newId).set(newUserData);
                await this.fbRef.child('users').child(oldId).remove();
            } catch (err) {
                console.error("Firebase ID migration failed:", err);
                alert("❌ 실시간 데이터베이스 아이디 업데이트 실패. 인터넷 연결을 확인해 주세요.");
                return;
            }
        }

        const localUsers = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        let updatedLocalUsers = localUsers.map(u => {
            if (u && u.id === oldId) {
                return newUserData;
            }
            return u;
        }).filter(u => u && u.id !== oldId || u.id === newId);
        localStorage.setItem('rocket_users', JSON.stringify(updatedLocalUsers));

        // 2. Migrate messages
        if (this.isFirebaseConnected && this.fbRef) {
            try {
                const messagesSnapshot = await this.fbRef.child('messages').once('value');
                const messagesVal = messagesSnapshot.val();
                if (messagesVal) {
                    const updates = {};
                    Object.keys(messagesVal).forEach(msgKey => {
                        const m = messagesVal[msgKey];
                        if (m) {
                            let updated = false;
                            const updatePath = `/messages/${msgKey}`;
                            if (m.senderId === oldId) {
                                updates[`${updatePath}/senderId`] = newId;
                                updated = true;
                            }
                            if (m.readBy && typeof m.readBy === 'object') {
                                if (m.readBy[oldId] !== undefined) {
                                    updates[`${updatePath}/readBy/${newId}`] = m.readBy[oldId];
                                    updates[`${updatePath}/readBy/${oldId}`] = null;
                                    updated = true;
                                }
                            }
                        }
                    });
                    if (Object.keys(updates).length > 0) {
                        await this.fbRef.update(updates);
                    }
                }
            } catch (err) {
                console.error("Firebase messages migration failed:", err);
            }
        }

        let localMessages = [];
        try {
            localMessages = JSON.parse(localStorage.getItem('rocket_messages') || '[]');
        } catch (err) {
            console.error(err);
        }
        let localUpdated = false;
        localMessages.forEach(m => {
            if (m) {
                if (m.senderId === oldId) {
                    m.senderId = newId;
                    localUpdated = true;
                }
                if (m.readBy && typeof m.readBy === 'object') {
                    if (m.readBy[oldId] !== undefined) {
                        m.readBy[newId] = m.readBy[oldId];
                        delete m.readBy[oldId];
                        localUpdated = true;
                    }
                }
            }
        });
        if (localUpdated) {
            localStorage.setItem('rocket_messages', JSON.stringify(localMessages));
        }

        alert("⚠️ 아이디 변경 성공! 현재 ID가 삭제되고 로그인이 해제되오니 다시 로그인해 주시기 바랍니다.");
        this.logout();
        this.closeProfileModal();
    }

    async handleProfilePasswordUpdateSubmit() {
        if (!this.currentUser) return;

        const currentPw = document.getElementById('profile-pw-current').value;
        const newPw = document.getElementById('profile-pw-new').value;
        const confirmPw = document.getElementById('profile-pw-confirm').value;

        if (!currentPw || !newPw || !confirmPw) {
            alert("❌ 모든 필드를 입력해 주세요.");
            return;
        }

        if (currentPw !== this.currentUser.pw) {
            alert("❌ 현재 비밀번호가 일치하지 않습니다.");
            return;
        }

        if (newPw !== confirmPw) {
            alert("❌ 변경할 비밀번호 확인이 일치하지 않습니다.");
            return;
        }

        // Validate Password constraints
        // 1. No Korean
        const hasKorean = /[\uac00-\ud7a3\u3130-\u318f]/.test(newPw);
        if (hasKorean) {
            alert("❌ 비밀번호에는 한글을 사용할 수 없습니다.");
            return;
        }

        // 2. Firebase forbidden characters
        const firebaseForbidden = /[\.\$\#\[\]\/]/;
        if (firebaseForbidden.test(newPw)) {
            alert("❌ 비밀번호에 파이어베이스 제한 문자(., $, #, [, ], /)는 사용할 수 없습니다.");
            return;
        }

        // 3. Category match count (2+ combinations: 영어 대, 영어 소, 숫자, 특수문자)
        let categories = 0;
        if (/[A-Z]/.test(newPw)) categories++;
        if (/[a-z]/.test(newPw)) categories++;
        if (/[0-9]/.test(newPw)) categories++;
        // Any character that is not alphanumeric and not firebase forbidden and not space
        if (/[^a-zA-Z0-9가-힣\.\$\#\[\]\/]/.test(newPw)) categories++;

        if (categories < 2) {
            alert("❌ 비밀번호는 영어 대문자, 영어 소문자, 숫자, 특수문자 중 2가지 이상의 조합이어야 합니다.");
            return;
        }

        // Update pw
        this.currentUser.pw = newPw;
        localStorage.setItem('rocket_session', JSON.stringify(this.currentUser));

        const users = JSON.parse(localStorage.getItem('rocket_users') || '[]');
        const userIdx = users.findIndex(u => u && u.id === this.currentUser.id);
        if (userIdx !== -1) {
            users[userIdx].pw = newPw;
            localStorage.setItem('rocket_users', JSON.stringify(users));
        }

        if (this.isFirebaseConnected && this.fbRef) {
            try {
                await this.fbRef.child('users').child(this.currentUser.id).child('pw').set(newPw);
            } catch (err) {
                console.error("Firebase password update failed:", err);
                alert("❌ 실시간 데이터베이스 비밀번호 업데이트 실패. 인터넷 연결을 확인해 주세요.");
                return;
            }
        }

        alert("✅ 비밀번호가 성공적으로 변경되었습니다.");
        this.closeProfileModal();
    }
}

// Instantiate and expose globally
const app = new RocketLabApp();
window.onload = () => {
    app.init();
};
