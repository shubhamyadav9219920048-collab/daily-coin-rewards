        // Global States
        let currentUser = null;
        let connectionMode = 'sandbox'; // 'sandbox' or 'firebase'
        let db = null;
        let auth = null;
        let timerInterval = null;
        
        // Export Zip Handler
        function triggerDownloadZip() {
            if (window.AndroidBridge && typeof window.AndroidBridge.downloadZip === 'function') {
                window.AndroidBridge.downloadZip();
            } else {
                // Fallback for standard web browsers
                const link = document.createElement('a');
                link.href = 'web_project.zip';
                link.download = 'web_project.zip';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
        
        // Tab routing state
        let currentTab = 'daily';

        // Active Ad Session states
        let adProgressTimer = null;
        let adSecondsLeft = 15;
        let adTitleSelected = '';

        // Admin Access state
        let isAdminAuthenticated = false;
        let adminFilter = 'all';

        // Initialize Lucide icons on load
        document.addEventListener("DOMContentLoaded", () => {
            lucide.createIcons();
            loadConnectionSettings();
            initApp();
        });

        // Load settings from local storage
        function loadConnectionSettings() {
            const savedMode = localStorage.getItem('connection_mode');
            if (savedMode) {
                connectionMode = savedMode;
                document.getElementById('firebaseModeSelect').value = savedMode;
            }

            // Populate saved config if any
            const savedConfig = localStorage.getItem('firebase_config');
            if (savedConfig) {
                try {
                    const config = JSON.parse(savedConfig);
                    document.getElementById('firebase_apiKey').value = config.apiKey || '';
                    document.getElementById('firebase_authDomain').value = config.authDomain || '';
                    document.getElementById('firebase_projectId').value = config.projectId || '';
                    document.getElementById('firebase_storageBucket').value = config.storageBucket || '';
                    document.getElementById('firebase_messagingSenderId').value = config.messagingSenderId || '';
                    document.getElementById('firebase_appId').value = config.appId || '';
                } catch (e) {
                    console.error("Failed to parse saved Firebase config", e);
                }
            }

            onConnectionModeChanged();
        }

        // Toggle drawer visibility
        function toggleConfigDrawer(show) {
            const drawer = document.getElementById('configDrawer');
            const drawerContent = drawer.firstElementChild;
            if (show) {
                drawer.classList.remove('pointer-events-none', 'opacity-0');
                drawerContent.classList.remove('translate-x-full');
            } else {
                drawer.classList.add('pointer-events-none', 'opacity-0');
                drawerContent.classList.add('translate-x-full');
            }
        }

        // Handle connection dropdown change
        function onConnectionModeChanged() {
            const select = document.getElementById('firebaseModeSelect');
            const mode = select.value;
            const configForm = document.getElementById('firebaseConfigForm');
            const firestoreHint = document.getElementById('firestoreHint');

            if (mode === 'firebase') {
                configForm.classList.remove('hidden');
                firestoreHint.classList.remove('hidden');
            } else {
                configForm.classList.add('hidden');
                firestoreHint.classList.add('hidden');
            }
        }

        // Save Connection settings & optionally initialize Firebase
        function saveConnectionSettings() {
            const select = document.getElementById('firebaseModeSelect');
            const mode = select.value;
            connectionMode = mode;
            localStorage.setItem('connection_mode', mode);

            if (mode === 'firebase') {
                const config = {
                    apiKey: document.getElementById('firebase_apiKey').value.trim(),
                    authDomain: document.getElementById('firebase_authDomain').value.trim(),
                    projectId: document.getElementById('firebase_projectId').value.trim(),
                    storageBucket: document.getElementById('firebase_storageBucket').value.trim(),
                    messagingSenderId: document.getElementById('firebase_messagingSenderId').value.trim(),
                    appId: document.getElementById('firebase_appId').value.trim()
                };

                if (!config.apiKey || !config.projectId) {
                    showToast("⚠️ Missing API Key or Project ID for Firebase", "error");
                    return;
                }

                localStorage.setItem('firebase_config', JSON.stringify(config));
                
                // Reinitialize
                try {
                    if (firebase.apps.length > 0) {
                        firebase.app().delete().then(() => {
                            initFirebase(config);
                            showToast("⚡ Firebase Connected Successfully!", "success");
                        });
                    } else {
                        initFirebase(config);
                        showToast("⚡ Firebase Connected Successfully!", "success");
                    }
                } catch (e) {
                    showToast("❌ Connection error: " + e.message, "error");
                    return;
                }
            } else {
                showToast("📦 Switched to Local Simulated Sandbox", "success");
            }

            updateConnectionBadge();
            toggleConfigDrawer(false);

            if (currentUser) {
                logout();
            }
        }

        // Initialize real Firebase SDK
        function initFirebase(config) {
            try {
                firebase.initializeApp(config);
                db = firebase.firestore();
                auth = firebase.auth();

                auth.onAuthStateChanged((user) => {
                    if (connectionMode === 'firebase') {
                        if (user) {
                            syncFirebaseUser(user);
                        } else {
                            currentUser = null;
                            showScreen('login');
                        }
                    }
                });
            } catch (e) {
                console.error("Firebase Init Error:", e);
                showToast("⚠️ Init Error: " + e.message, "error");
            }
        }

        // Update UI Badge state
        function updateConnectionBadge() {
            const badge = document.getElementById('connectionBadge');
            const text = document.getElementById('connectionBadgeText');
            const bullet = badge.querySelector('span');

            if (connectionMode === 'firebase') {
                text.innerText = "Firebase Live";
                badge.className = "flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer";
                bullet.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
            } else {
                text.innerText = "Local Sandbox";
                badge.className = "flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 cursor-pointer";
                bullet.className = "w-2 h-2 rounded-full bg-orange-500 animate-pulse";
            }
        }

        // App initial setup
        function initApp() {
            updateConnectionBadge();

            if (connectionMode === 'sandbox') {
                const savedUser = localStorage.getItem('sandbox_user');
                if (savedUser) {
                    currentUser = JSON.parse(savedUser);
                    showScreen('dashboard');
                    startCooldownTimer();
                    buildStreakTracker();
                    loadWithdrawalList();
                } else {
                    showScreen('login');
                }
            } else {
                const savedConfig = localStorage.getItem('firebase_config');
                if (savedConfig) {
                    try {
                        const config = JSON.parse(savedConfig);
                        initFirebase(config);
                    } catch (e) {
                        console.error("Firebase startup failed:", e);
                        showScreen('login');
                    }
                } else {
                    showScreen('login');
                }
            }
        }

        // Screen Routing logic
        function showScreen(screenId) {
            const login = document.getElementById('loginScreen');
            const dash = document.getElementById('dashboardScreen');

            if (screenId === 'login') {
                login.classList.remove('hidden');
                dash.classList.add('hidden');
                if (timerInterval) clearInterval(timerInterval);
            } else {
                login.classList.add('hidden');
                dash.classList.remove('hidden');
                updateDashboardUI();
                switchTab('daily');
            }
        }

        // Google Sign-In trigger (Firebase Live Mode)
        function loginWithGoogle() {
            if (connectionMode !== 'firebase' || !auth) {
                showToast("⚙️ Please configure & connect Firebase in Settings first!", "info");
                toggleConfigDrawer(true);
                return;
            }

            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .then((result) => {
                    showToast("👋 Signed in with Google!", "success");
                })
                .catch((err) => {
                    console.error("Google Signin Failure", err);
                    showToast("❌ Google Sign-in Failed: " + err.message, "error");
                });
        }

        // Sync Firebase Auth user data to Firestore
        function syncFirebaseUser(user) {
            const userRef = db.collection("Users").doc(user.uid);
            
            userRef.get().then((doc) => {
                if (doc.exists) {
                    currentUser = {
                        uid: user.uid,
                        displayName: user.displayName || 'Google Explorer',
                        email: user.email,
                        coins: doc.data().coins || 0,
                        lastClaimedTimestamp: doc.data().lastClaimedTimestamp || 0
                    };
                } else {
                    currentUser = {
                        uid: user.uid,
                        displayName: user.displayName || 'Google Explorer',
                        email: user.email,
                        coins: 0,
                        lastClaimedTimestamp: 0
                    };
                    userRef.set(currentUser);
                }
                showScreen('dashboard');
                startCooldownTimer();
                buildStreakTracker();
                loadWithdrawalList();
                listenToGlobalWithdrawalsForBadge();
            }).catch((err) => {
                showToast("⚠️ Firestore Sync Failed: " + err.message, "error");
                currentUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    coins: 0,
                    lastClaimedTimestamp: 0
                };
                showScreen('dashboard');
            });
        }

        // Sandbox simulated login
        function loginSandbox() {
            const nameInput = document.getElementById('sandboxName').value.trim();
            const emailInput = document.getElementById('sandboxEmail').value.trim();

            currentUser = {
                uid: 'sandbox_user_id',
                displayName: nameInput || 'Sandbox Explorer',
                email: emailInput || 'sandbox@example.com',
                coins: 0,
                lastClaimedTimestamp: 0
            };

            const savedStats = localStorage.getItem(`sandbox_stats_${currentUser.email}`);
            if (savedStats) {
                const stats = JSON.parse(savedStats);
                currentUser.coins = stats.coins || 0;
                currentUser.lastClaimedTimestamp = stats.lastClaimedTimestamp || 0;
            }

            localStorage.setItem('sandbox_user', JSON.stringify(currentUser));
            localStorage.setItem('connection_mode', 'sandbox');
            connectionMode = 'sandbox';
            updateConnectionBadge();

            showToast(`🎁 Logged in as ${currentUser.displayName}`, "success");
            showScreen('dashboard');
            startCooldownTimer();
            buildStreakTracker();
            loadWithdrawalList();
            updatePendingAdminBadge();
        }

        // Log out user
        function logout() {
            if (connectionMode === 'firebase' && auth) {
                auth.signOut();
            } else {
                localStorage.removeItem('sandbox_user');
                currentUser = null;
                showScreen('login');
            }
        }

        // Refresh screen details
        function updateDashboardUI() {
            if (!currentUser) return;

            document.getElementById('userDisplayName').innerText = currentUser.displayName;
            document.getElementById('userEmail').innerText = currentUser.email;
            document.getElementById('userCoinBalance').innerText = currentUser.coins;
            document.getElementById('withdrawAvailableCoins').innerText = `${currentUser.coins} Coins`;

            const names = currentUser.displayName.split(' ');
            const initials = names.map(n => n[0]).join('').slice(0, 2).toUpperCase();
            document.getElementById('userAvatar').innerText = initials || 'EX';

            const infoBanner = document.getElementById('infoBanner');
            const infoTitle = document.getElementById('infoBannerTitle');
            const infoDesc = document.getElementById('infoBannerDesc');

            if (connectionMode === 'firebase') {
                infoBanner.className = "w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-4 text-sm shadow-sm";
                infoTitle.innerText = "Cloud Firestore Sync Enabled";
                infoDesc.innerText = "You are connected to a live Google Cloud database. All coin balance additions, timestamp calculations, and withdrawal processing sync directly into your custom Firebase collections in real-time.";
            } else {
                infoBanner.className = "w-full bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex gap-4 text-sm shadow-sm";
                infoTitle.innerText = "Sandbox Simulated Mode Active";
                infoDesc.innerText = "All stats and payout history are simulated locally in this web browser. Setup your own Firebase credentials via the Settings panel in the navbar to connect a live production cloud.";
            }
        }

        // Switch internal navigation tabs
        function switchTab(tabId) {
            currentTab = tabId;

            // Hide all tab contents
            document.getElementById('tabContent-daily').classList.add('hidden');
            document.getElementById('tabContent-ads').classList.add('hidden');
            document.getElementById('tabContent-withdraw').classList.add('hidden');
            document.getElementById('tabContent-admin').classList.add('hidden');

            // Reset tab button styles
            const tabs = ['daily', 'ads', 'withdraw', 'admin'];
            tabs.forEach(t => {
                const btn = document.getElementById(`tabBtn-${t}`);
                if (btn) {
                    btn.className = "flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-bold transition-all text-gray-400 hover:text-white hover:bg-cosmicSurfaceVariant";
                }
            });

            // Show selected tab content
            document.getElementById(`tabContent-${tabId}`).classList.remove('hidden');
            
            // Set active button style
            const activeBtn = document.getElementById(`tabBtn-${tabId}`);
            if (activeBtn) {
                activeBtn.className = "flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-bold transition-all bg-goldPrimary text-cosmicBg";
            }

            // Specific tab entry setups
            if (tabId === 'withdraw') {
                loadWithdrawalList();
            } else if (tabId === 'admin') {
                setupAdminPanelVisibility();
            }
        }

        // Start daily countdown ticks
        function startCooldownTimer() {
            if (timerInterval) clearInterval(timerInterval);

            const checkCooldown = () => {
                if (!currentUser) return;

                const now = Date.now();
                const cycle = 24 * 60 * 60 * 1000;
                const elapsed = now - currentUser.lastClaimedTimestamp;
                const remaining = cycle - elapsed;

                const coinFace = document.getElementById('claimCoinFace');
                const coinEmoji = document.getElementById('claimCoinEmoji');
                const coinBadge = document.getElementById('claimCoinBadge');
                const claimBtn = document.getElementById('claimRewardBtn');
                const clockContainer = document.getElementById('cooldownClockContainer');
                const progressContainer = document.getElementById('cooldownProgressContainer');
                const progressText = document.getElementById('cooldownProgressText');
                const progressBar = document.getElementById('cooldownProgressBar');
                const rewardTitle = document.getElementById('rewardTitle');
                const rewardSubtitle = document.getElementById('rewardSubtitle');
                const glowRipple = document.getElementById('glowRipple');

                if (remaining > 0) {
                    const totalSeconds = Math.floor(remaining / 1000);
                    const h = Math.floor(totalSeconds / 3600);
                    const m = Math.floor((totalSeconds % 3600) / 60);
                    const s = totalSeconds % 60;

                    const format = (val) => String(val).padStart(2, '0');
                    document.getElementById('cooldownTimer').innerText = `${format(h)} : ${format(m)} : ${format(s)}`;

                    clockContainer.classList.remove('hidden');
                    progressContainer.classList.remove('hidden');
                    glowRipple.classList.add('hidden');

                    const percent = Math.min(100, Math.floor((elapsed / cycle) * 100));
                    progressBar.style.width = `${percent}%`;
                    progressText.innerText = `${percent}% Recharged`;

                    coinFace.className = "w-32 h-32 rounded-full bg-gradient-to-tr from-gray-700 via-gray-600 to-gray-500 border-4 border-gray-500 shadow-inner flex flex-col items-center justify-center transition-all duration-300 relative scale-95 opacity-70 cursor-not-allowed";
                    coinEmoji.className = "text-5xl filter grayscale opacity-40 select-none";
                    coinBadge.innerText = "COOLDOWN";
                    coinBadge.className = "absolute bottom-3 bg-gray-900/90 px-2.5 py-0.5 border border-gray-600 rounded-full text-[9px] font-black text-gray-400 tracking-wider";

                    rewardTitle.innerText = "Reward On Cooldown";
                    rewardSubtitle.innerText = "You have claimed today's reward bundle! Recharge progress is active. Please return when the countdown above reaches zero.";

                    claimBtn.disabled = true;
                    claimBtn.className = "w-full h-14 bg-cosmicSurfaceVariant text-gray-500 border border-borderDark font-bold text-base rounded-2xl cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-2";
                    claimBtn.innerHTML = `<i data-lucide="lock" class="w-5 h-5"></i><span>ON COOLDOWN</span>`;
                    lucide.createIcons();
                } else {
                    clockContainer.classList.add('hidden');
                    progressContainer.classList.add('hidden');
                    glowRipple.classList.remove('hidden');

                    coinFace.className = "w-32 h-32 rounded-full bg-gradient-to-tr from-yellow-600 via-goldPrimary to-goldLight border-4 border-yellow-300 shadow-2xl flex flex-col items-center justify-center transition-all duration-300 relative hover:scale-105 active:scale-95 cursor-pointer gold-glow-button";
                    coinEmoji.className = "text-5xl select-none drop-shadow-lg";
                    coinBadge.innerText = "+10";
                    coinBadge.className = "absolute bottom-3 bg-cosmicBg/80 px-2.5 py-0.5 border border-goldPrimary/30 rounded-full text-[10px] font-black text-goldPrimary tracking-widest";

                    rewardTitle.innerText = "Claim Today's Reward!";
                    rewardSubtitle.innerText = "Your daily +10 gold coins are fully recharged and ready. Tap the glowing coin or click the action button below to claim them immediately!";

                    claimBtn.disabled = false;
                    claimBtn.className = "w-full h-14 bg-gradient-to-r from-goldPrimary to-amber-500 text-cosmicBg font-black text-base rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl cursor-pointer select-none";
                    claimBtn.innerHTML = `<i data-lucide="star" class="w-5 h-5 fill-cosmicBg"></i><span>CLAIM 10 COINS</span>`;
                    lucide.createIcons();
                }
            };

            checkCooldown();
            timerInterval = setInterval(checkCooldown, 1000);
        }

        // Clicking the chest coin launches the claim
        function triggerClaimAttempt() {
            const claimBtn = document.getElementById('claimRewardBtn');
            if (!claimBtn.disabled) {
                claimDailyReward();
            } else {
                showToast("⏳ Cooldown recharge is still in progress!", "info");
            }
        }

        // Perform Rewards claim transaction
        function claimDailyReward() {
            if (!currentUser) return;

            const elapsed = Date.now() - currentUser.lastClaimedTimestamp;
            const cycle = 24 * 60 * 60 * 1000;
            if (elapsed < cycle) {
                showToast("⏳ Reward not ready yet!", "info");
                return;
            }

            const previousCoins = currentUser.coins;
            currentUser.coins += 10;
            currentUser.lastClaimedTimestamp = Date.now();

            triggerConfettiSplatter();

            if (connectionMode === 'firebase' && db) {
                const userRef = db.collection("Users").doc(currentUser.uid);
                userRef.update({
                    coins: currentUser.coins,
                    lastClaimedTimestamp: currentUser.lastClaimedTimestamp
                }).then(() => {
                    showToast("✨ +10 Gold Coins Saved to Cloud Firestore!", "success");
                    updateDashboardUI();
                    buildStreakTracker();
                }).catch((err) => {
                    showToast("❌ Cloud save failed: " + err.message, "error");
                    currentUser.coins = previousCoins;
                    updateDashboardUI();
                });
            } else {
                localStorage.setItem(`sandbox_stats_${currentUser.email}`, JSON.stringify({
                    coins: currentUser.coins,
                    lastClaimedTimestamp: currentUser.lastClaimedTimestamp
                }));
                localStorage.setItem('sandbox_user', JSON.stringify(currentUser));

                showToast("✨ +10 Simulated Coins added to Sandbox Ledger!", "success");
                updateDashboardUI();
                buildStreakTracker();
            }
        }

        // Build beautiful visual weekly grid
        function buildStreakTracker() {
            const container = document.getElementById('streakDaysContainer');
            const template = document.getElementById('streakDayTemplate');
            container.innerHTML = '';

            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const currentDayOfWeek = new Date().getDay();

            for (let i = 0; i < 7; i++) {
                const clone = template.content.cloneNode(true);
                const circle = clone.querySelector('.day-circle');
                const label = clone.querySelector('.day-label');

                label.innerText = days[i];

                if (i === currentDayOfWeek) {
                    label.className += " text-goldPrimary font-bold";
                    const now = Date.now();
                    const elapsed = now - currentUser.lastClaimedTimestamp;
                    const cycle = 24 * 60 * 60 * 1000;

                    if (elapsed < cycle) {
                        circle.innerText = "✓";
                        circle.className += " bg-emeraldSuccess/20 border-emeraldSuccess text-emeraldSuccess scale-105";
                    } else {
                        circle.innerText = "+10";
                        circle.className += " bg-goldPrimary/10 border-goldPrimary/40 text-goldPrimary animate-pulse";
                    }
                } else if (i < currentDayOfWeek) {
                    circle.innerText = "✓";
                    circle.className += " bg-emeraldSuccess/10 border-emeraldSuccess/40 text-emeraldSuccess/70";
                } else {
                    circle.innerText = "+10";
                    circle.className += " bg-cosmicSurfaceVariant border-borderDark text-gray-500";
                }

                container.appendChild(clone);
            }
        }

        // Gorgeous Golden Confetti Celebration
        function triggerConfettiSplatter() {
            const duration = 1.5 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 25, spread: 360, ticks: 50, zIndex: 100 };

            function randomInRange(min, max) {
                return Math.random() * (max - min) + min;
            }

            const interval = setInterval(function() {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 45 * (timeLeft / duration);
                const goldenColors = ['#FFD700', '#FFA500', '#FFFFE0', '#FFF8DC', '#B8860B'];
                
                confetti(Object.assign({}, defaults, { 
                    particleCount, 
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                    colors: goldenColors
                }));
                confetti(Object.assign({}, defaults, { 
                    particleCount, 
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                    colors: goldenColors
                }));
            }, 250);
        }

        // ================= JS ADS MODULE =================
        function startAdSession(adProviderName) {
            if (!currentUser) return;

            adTitleSelected = adProviderName;
            adSecondsLeft = 15;

            // Setup elements in ad modal
            document.getElementById('adTitleText').innerText = adProviderName;
            document.getElementById('adTimerSeconds').innerText = adSecondsLeft;
            
            const progressBar = document.getElementById('adProgressBar');
            progressBar.style.width = '0%';

            // Set dynamic ad graphics/text based on selected provider
            const graphicIcon = document.getElementById('adGraphicIcon');
            const graphicPromo = document.getElementById('adGraphicPromoText');
            
            if (adProviderName.includes('Colony')) {
                graphicIcon.innerText = "🎮";
                graphicPromo.innerText = "SUPER CLASH RPG";
            } else if (adProviderName.includes('Unity')) {
                graphicIcon.innerText = "📈";
                graphicPromo.innerText = "STOCK & OPTIONS SIM";
            } else if (adProviderName.includes('AppLovin')) {
                graphicIcon.innerText = "🛍️";
                graphicPromo.innerText = "MEGA DEALS MART";
            } else {
                graphicIcon.innerText = "⚡";
                graphicPromo.innerText = "SPEED PRO VPN";
            }

            // Disable close/claim button initially
            const closeBtn = document.getElementById('adCloseBtn');
            closeBtn.disabled = true;
            closeBtn.className = "w-full h-12 bg-cosmicSurfaceVariant text-gray-500 border border-borderDark font-bold text-sm rounded-xl mt-6 cursor-not-allowed transition-all flex items-center justify-center space-x-2";
            closeBtn.innerHTML = `<i data-lucide="lock" class="w-4 h-4 text-gray-500" id="adCloseIcon"></i><span id="adCloseText">Watch Video to Unlock Reward (15s)</span>`;
            lucide.createIcons();

            // Open overlay modal
            const overlay = document.getElementById('adOverlayModal');
            overlay.classList.remove('pointer-events-none', 'opacity-0');
            overlay.classList.add('opacity-100');

            // Begin ad countdown ticker
            if (adProgressTimer) clearInterval(adProgressTimer);
            
            adProgressTimer = setInterval(() => {
                adSecondsLeft--;
                document.getElementById('adTimerSeconds').innerText = adSecondsLeft;
                
                // Progress calculation
                const percent = Math.floor(((15 - adSecondsLeft) / 15) * 100);
                progressBar.style.width = `${percent}%`;

                // Update unlock label
                const closeTxt = document.getElementById('adCloseText');
                closeTxt.innerText = `Watch Video to Unlock Reward (${adSecondsLeft}s)`;

                if (adSecondsLeft <= 0) {
                    clearInterval(adProgressTimer);
                    unlockAdClaim();
                }
            }, 1000);
        }

        // Unlock action button after completed progress timer
        function unlockAdClaim() {
            const closeBtn = document.getElementById('adCloseBtn');
            closeBtn.disabled = false;
            closeBtn.className = "w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-cosmicBg font-black text-sm rounded-xl mt-6 transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2";
            closeBtn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 text-cosmicBg" id="adCloseIcon"></i><span id="adCloseText">Claim +10 Gold Coins!</span>`;
            lucide.createIcons();
            
            showToast("🎁 Reward Unlocked! You can claim your coins now.", "info");
        }

        // Close ad overlay and commit rewards
        function finishAdClaim() {
            const overlay = document.getElementById('adOverlayModal');
            overlay.classList.add('pointer-events-none', 'opacity-0');
            overlay.classList.remove('opacity-100');

            if (adProgressTimer) clearInterval(adProgressTimer);

            // Double check to prevent exploits
            if (adSecondsLeft > 0) {
                showToast("⚠️ Ad was cancelled early. No rewards assigned.", "error");
                return;
            }

            const previousCoins = currentUser.coins;
            currentUser.coins += 10;

            triggerConfettiSplatter();

            if (connectionMode === 'firebase' && db) {
                const userRef = db.collection("Users").doc(currentUser.uid);
                userRef.update({
                    coins: currentUser.coins
                }).then(() => {
                    showToast(`✨ Ad complete! +10 Coins added to cloud balance.`, "success");
                    updateDashboardUI();
                }).catch((err) => {
                    showToast("❌ Cloud save failed: " + err.message, "error");
                    currentUser.coins = previousCoins;
                    updateDashboardUI();
                });
            } else {
                localStorage.setItem(`sandbox_stats_${currentUser.email}`, JSON.stringify({
                    coins: currentUser.coins,
                    lastClaimedTimestamp: currentUser.lastClaimedTimestamp
                }));
                localStorage.setItem('sandbox_user', JSON.stringify(currentUser));

                showToast(`✨ Ad complete! +10 Coins added to sandbox ledger.`, "success");
                updateDashboardUI();
            }
        }

        // ================= WITHDRAWAL SYSTEM MODULE =================
        function loadWithdrawalList() {
            const container = document.getElementById('payoutHistoryContainer');
            container.innerHTML = '';

            if (connectionMode === 'firebase' && db) {
                db.collection("Withdrawals")
                    .where("uid", "==", currentUser.uid)
                    .orderBy("timestamp", "desc")
                    .get()
                    .then((snapshot) => {
                        document.getElementById('withdrawCountText').innerText = `${snapshot.size} Requests`;

                        if (snapshot.empty) {
                            renderWithdrawalEmptyState();
                            return;
                        }

                        snapshot.forEach((doc) => {
                            const data = doc.data();
                            const item = createWithdrawalRowElement(data);
                            container.appendChild(item);
                        });
                        lucide.createIcons();
                    })
                    .catch((err) => {
                        console.error("Firestore loading withdrawals failed", err);
                        renderWithdrawalEmptyState();
                    });
            } else {
                const globalWithdrawals = JSON.parse(localStorage.getItem('sandbox_global_withdrawals') || '[]');
                const userWithdrawals = globalWithdrawals.filter(w => w.uid === currentUser.uid);
                
                userWithdrawals.sort((a, b) => b.timestamp - a.timestamp);
                
                document.getElementById('withdrawCountText').innerText = `${userWithdrawals.length} Requests`;

                if (userWithdrawals.length === 0) {
                    renderWithdrawalEmptyState();
                    return;
                }

                userWithdrawals.forEach((data) => {
                    const item = createWithdrawalRowElement(data);
                    container.appendChild(item);
                });
                lucide.createIcons();
            }
        }

        function renderWithdrawalEmptyState() {
            const container = document.getElementById('payoutHistoryContainer');
            container.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-center py-12 text-gray-500">
                    <i data-lucide="wallet" class="w-12 h-12 text-gray-600 mb-2"></i>
                    <p class="text-sm font-semibold">No withdrawals requested yet</p>
                    <p class="text-xs text-gray-600 max-w-xs mt-1">Gain at least 1000 coins and submit your payout form to track processing status.</p>
                </div>
            `;
            lucide.createIcons();
        }

        function createWithdrawalRowElement(data) {
            const date = new Date(data.timestamp).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let statusBadgeClass = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            if (data.status === 'Approved') {
                statusBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            } else if (data.status === 'Rejected') {
                statusBadgeClass = 'bg-red-500/10 text-red-400 border-red-500/20';
            }

            const card = document.createElement('div');
            card.className = "p-4 bg-cosmicBg/80 border border-borderDark rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner";
            card.innerHTML = `
                <div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs text-gray-500 font-bold">${date}</span>
                        <span class="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded border uppercase ${statusBadgeClass}">${data.status}</span>
                    </div>
                    <p class="text-sm font-extrabold text-white mt-1">₹${(data.amount / 100).toFixed(2)} payout valuation</p>
                    <p class="text-xs text-gray-400 font-mono mt-0.5 flex items-center">
                        <i data-lucide="at-sign" class="w-3 h-3 mr-1 text-gray-500"></i> ${data.upiId}
                    </p>
                </div>
                <div class="text-right shrink-0">
                    <span class="text-sm font-bold text-goldPrimary flex items-center"><span class="mr-1">🪙</span>${data.amount} Coins</span>
                    <p class="text-[9px] text-gray-500 mt-1">Req ID: #${data.id.substring(0, 8)}</p>
                </div>
            `;
            return card;
        }

        // Form submit withdrawal transaction request
        function submitWithdrawalRequest() {
            if (!currentUser) return;

            const upiId = document.getElementById('payoutUpiId').value.trim();
            const amountInput = document.getElementById('payoutAmount');
            const amount = parseInt(amountInput.value);

            // Valuations
            if (!upiId) {
                showToast("⚠️ Please enter a valid UPI Address", "error");
                return;
            }
            if (isNaN(amount) || amount < 1000) {
                showToast("⚠️ Minimum payout withdrawal amount is 1000 Coins", "error");
                return;
            }
            if (amount > currentUser.coins) {
                showToast("❌ Insufficient Coin Balance in your ledger!", "error");
                return;
            }

            const requestId = "REQ_" + Math.random().toString(36).substring(2, 11).toUpperCase();
            const requestPayload = {
                id: requestId,
                uid: currentUser.uid,
                displayName: currentUser.displayName,
                email: currentUser.email,
                upiId: upiId,
                amount: amount,
                status: 'Pending',
                timestamp: Date.now()
            };

            if (connectionMode === 'firebase' && db) {
                db.collection("Withdrawals").doc(requestId).set(requestPayload)
                    .then(() => {
                        showToast("💸 Withdrawal Request Submitted! Awaiting Admin Approval.", "success");
                        amountInput.value = '';
                        loadWithdrawalList();
                    })
                    .catch((err) => {
                        showToast("❌ Submission Failed: " + err.message, "error");
                    });
            } else {
                // Save simulated sandbox request
                const globalWithdrawals = JSON.parse(localStorage.getItem('sandbox_global_withdrawals') || '[]');
                globalWithdrawals.push(requestPayload);
                localStorage.setItem('sandbox_global_withdrawals', JSON.stringify(globalWithdrawals));

                showToast("💸 Simulated Payout Request Submitted! Go to Admin Panel to Approve.", "success");
                amountInput.value = '';
                loadWithdrawalList();
                updatePendingAdminBadge();
            }
        }

        // ================= ADMIN PORTAL MODULE =================
        function setupAdminPanelVisibility() {
            const gate = document.getElementById('adminAuthGate');
            const main = document.getElementById('adminPortalMain');

            if (isAdminAuthenticated) {
                gate.classList.add('hidden');
                main.classList.remove('hidden');
                loadAdminGlobalWithdrawals();
            } else {
                gate.classList.remove('hidden');
                main.classList.add('hidden');
            }
        }

        // Login Admin
        function loginAdminPortal() {
            const code = document.getElementById('adminPasscode').value.trim();
            
            if (code === 'ADMIN777' || code === '123456') {
                isAdminAuthenticated = true;
                showToast("🛡️ Admin Authenticated! Welcome to management console.", "success");
                setupAdminPanelVisibility();
            } else {
                showToast("❌ Invalid Passcode. Access Denied.", "error");
            }
        }

        function logoutAdminPortal() {
            isAdminAuthenticated = false;
            document.getElementById('adminPasscode').value = '';
            setupAdminPanelVisibility();
            showToast("🔒 Admin Logged Out", "info");
        }

        function filterAdminRequests(status) {
            adminFilter = status;
            
            const filters = ['all', 'Pending', 'Approved', 'Rejected'];
            filters.forEach(f => {
                const btn = document.getElementById(`adminFilterBtn-${f}`);
                if (btn) {
                    if (f === status) {
                        btn.className = "px-3 py-1 rounded bg-goldPrimary text-cosmicBg text-xs font-bold transition-all";
                    } else {
                        btn.className = "px-3 py-1 rounded bg-cosmicSurfaceVariant text-gray-400 hover:text-white text-xs font-bold transition-all";
                    }
                }
            });

            loadAdminGlobalWithdrawals();
        }

        // Load all system requests for admin control
        function loadAdminGlobalWithdrawals() {
            const tableContainer = document.getElementById('adminGlobalListContainer');
            tableContainer.innerHTML = '';

            if (connectionMode === 'firebase' && db) {
                let query = db.collection("Withdrawals");
                if (adminFilter !== 'all') {
                    query = query.where("status", "==", adminFilter);
                }

                query.orderBy("timestamp", "desc").get()
                    .then((snapshot) => {
                        if (snapshot.empty) {
                            renderAdminEmptyState();
                            return;
                        }

                        renderAdminTable(snapshot.docs.map(doc => doc.data()));
                    })
                    .catch((err) => {
                        console.error("Firestore Admin query failed", err);
                        renderAdminEmptyState();
                    });
            } else {
                // Sandbox requests
                const globalWithdrawals = JSON.parse(localStorage.getItem('sandbox_global_withdrawals') || '[]');
                globalWithdrawals.sort((a, b) => b.timestamp - a.timestamp);

                let filtered = globalWithdrawals;
                if (adminFilter !== 'all') {
                    filtered = globalWithdrawals.filter(w => w.status === adminFilter);
                }

                if (filtered.length === 0) {
                    renderAdminEmptyState();
                    return;
                }

                renderAdminTable(filtered);
            }
        }

        function renderAdminEmptyState() {
            const tableContainer = document.getElementById('adminGlobalListContainer');
            tableContainer.innerHTML = `
                <div class="py-12 text-center text-gray-500 flex flex-col items-center justify-center">
                    <i data-lucide="shield" class="w-12 h-12 text-gray-600 mb-2 animate-pulse"></i>
                    <p class="text-sm font-semibold">No requests found matching criteria</p>
                    <p class="text-xs text-gray-600 mt-1">All user transactions will display here for administrator authorization.</p>
                </div>
            `;
            lucide.createIcons();
        }

        function renderAdminTable(requestsList) {
            const tableContainer = document.getElementById('adminGlobalListContainer');
            
            // Build Table Layout
            const table = document.createElement('table');
            table.className = "min-w-full divide-y divide-borderDark text-left text-sm whitespace-nowrap";
            
            table.innerHTML = `
                <thead>
                    <tr class="text-gray-400 text-xs font-bold uppercase tracking-wider">
                        <th class="py-3 px-4">User Details</th>
                        <th class="py-3 px-4">UPI Address</th>
                        <th class="py-3 px-4">Coins Requested</th>
                        <th class="py-3 px-4">Status</th>
                        <th class="py-3 px-4">Date</th>
                        <th class="py-3 px-4 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-borderDark/40">
                </tbody>
            `;

            const tbody = table.querySelector('tbody');

            requestsList.forEach((data) => {
                const date = new Date(data.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                let statusBadgeClass = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                if (data.status === 'Approved') {
                    statusBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                } else if (data.status === 'Rejected') {
                    statusBadgeClass = 'bg-red-500/10 text-red-400 border-red-500/20';
                }

                let actionsHtml = `<span class="text-xs text-gray-500 italic">No action required</span>`;
                if (data.status === 'Pending') {
                    actionsHtml = `
                        <div class="flex items-center justify-center space-x-1.5">
                            <button onclick="processPayoutAction('${data.id}', 'Approved')" class="px-3 py-1.5 bg-emeraldSuccess/10 hover:bg-emeraldSuccess/25 text-emeraldSuccess border border-emeraldSuccess/30 text-xs font-bold rounded-lg transition-all flex items-center">
                                <i data-lucide="check" class="w-3.5 h-3.5 mr-1"></i> Approve
                            </button>
                            <button onclick="processPayoutAction('${data.id}', 'Rejected')" class="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-bold rounded-lg transition-all flex items-center">
                                <i data-lucide="x" class="w-3.5 h-3.5 mr-1"></i> Reject
                            </button>
                        </div>
                    `;
                }

                const tr = document.createElement('tr');
                tr.className = "hover:bg-cosmicSurfaceVariant/20 transition-colors";
                tr.innerHTML = `
                    <td class="py-3.5 px-4">
                        <div class="font-extrabold text-white">${data.displayName}</div>
                        <div class="text-xs text-gray-400">${data.email}</div>
                    </td>
                    <td class="py-3.5 px-4 font-mono text-xs text-gray-300">
                        ${data.upiId}
                    </td>
                    <td class="py-3.5 px-4">
                        <span class="font-black text-goldPrimary flex items-center"><span class="mr-1">🪙</span>${data.amount}</span>
                        <span class="text-[10px] text-gray-500">Value: ₹${(data.amount / 100).toFixed(2)}</span>
                    </td>
                    <td class="py-3.5 px-4">
                        <span class="text-[9px] font-black px-2 py-0.5 rounded border uppercase ${statusBadgeClass}">${data.status}</span>
                    </td>
                    <td class="py-3.5 px-4 text-xs text-gray-400">
                        ${date}
                    </td>
                    <td class="py-3.5 px-4 text-center">
                        ${actionsHtml}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            tableContainer.appendChild(table);
            lucide.createIcons();
        }

        // Process Withdrawal request (Deduct coins *only* upon approval)
        function processPayoutAction(requestId, targetStatus) {
            showToast(`⚙️ Processing request to ${targetStatus}...`, "info");

            if (connectionMode === 'firebase' && db) {
                const reqRef = db.collection("Withdrawals").doc(requestId);
                
                reqRef.get().then((docSnapshot) => {
                    if (!docSnapshot.exists) {
                        showToast("⚠️ Payout request not found in database", "error");
                        return;
                    }

                    const reqData = docSnapshot.data();

                    if (targetStatus === 'Approved') {
                        // Deduct Coins only after approval
                        const userRef = db.collection("Users").doc(reqData.uid);
                        
                        db.runTransaction((transaction) => {
                            return transaction.get(userRef).then((userDoc) => {
                                if (!userDoc.exists) {
                                    throw new Error("Target User does not exist");
                                }
                                const currentCoins = userDoc.data().coins || 0;
                                if (currentCoins < reqData.amount) {
                                    throw new Error("User has insufficient coin balance to process");
                                }

                                // Update transaction values
                                transaction.update(userRef, { coins: currentCoins - reqData.amount });
                                transaction.update(reqRef, { status: 'Approved' });
                            });
                        }).then(() => {
                            showToast("✅ Withdrawal Approved & Coins deducted!", "success");
                            
                            // Re-sync local state if the admin matches the logged-in user
                            if (currentUser && currentUser.uid === reqData.uid) {
                                currentUser.coins -= reqData.amount;
                                updateDashboardUI();
                            }

                            loadAdminGlobalWithdrawals();
                        }).catch((err) => {
                            showToast("❌ Approval transaction failed: " + err.message, "error");
                        });
                    } else {
                        // Just Reject - no coin deduction!
                        reqRef.update({ status: 'Rejected' })
                            .then(() => {
                                showToast("❌ Payout request rejected. No coins deducted.", "success");
                                loadAdminGlobalWithdrawals();
                            })
                            .catch((err) => {
                                showToast("⚠️ Rejection failed: " + err.message, "error");
                            });
                    }
                });
            } else {
                // Local sandbox data simulation
                const globalWithdrawals = JSON.parse(localStorage.getItem('sandbox_global_withdrawals') || '[]');
                const idx = globalWithdrawals.findIndex(w => w.id === requestId);

                if (idx === -1) {
                    showToast("⚠️ Payout request not found", "error");
                    return;
                }

                const reqData = globalWithdrawals[idx];

                if (targetStatus === 'Approved') {
                    // Check balance for target sandbox user
                    const targetEmail = reqData.email;
                    const savedStats = JSON.parse(localStorage.getItem(`sandbox_stats_${targetEmail}`) || '{}');
                    const currentCoins = savedStats.coins || 0;

                    if (currentCoins < reqData.amount) {
                        showToast("❌ User has insufficient coin balance!", "error");
                        return;
                    }

                    // Deduct
                    savedStats.coins = currentCoins - reqData.amount;
                    localStorage.setItem(`sandbox_stats_${targetEmail}`, JSON.stringify(savedStats));

                    // Update logged-in cache if the current user is target
                    if (currentUser && currentUser.email === targetEmail) {
                        currentUser.coins = savedStats.coins;
                        localStorage.setItem('sandbox_user', JSON.stringify(currentUser));
                        updateDashboardUI();
                    }

                    // Complete request
                    globalWithdrawals[idx].status = 'Approved';
                    localStorage.setItem('sandbox_global_withdrawals', JSON.stringify(globalWithdrawals));
                    showToast("✅ Withdrawal Approved! Sandbox Balance updated.", "success");
                } else {
                    // Rejected
                    globalWithdrawals[idx].status = 'Rejected';
                    localStorage.setItem('sandbox_global_withdrawals', JSON.stringify(globalWithdrawals));
                    showToast("❌ Simulated payout request rejected. No coins deducted.", "success");
                }

                loadAdminGlobalWithdrawals();
                updatePendingAdminBadge();
            }
        }

        // Live check for badges (Admin)
        function updatePendingAdminBadge() {
            const badge = document.getElementById('pendingAdminBadge');
            if (!badge) return;

            const globalWithdrawals = JSON.parse(localStorage.getItem('sandbox_global_withdrawals') || '[]');
            const pending = globalWithdrawals.filter(w => w.status === 'Pending');

            if (pending.length > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        function listenToGlobalWithdrawalsForBadge() {
            if (connectionMode === 'firebase' && db) {
                db.collection("Withdrawals").where("status", "==", "Pending")
                    .onSnapshot((snapshot) => {
                        const badge = document.getElementById('pendingAdminBadge');
                        if (badge) {
                            if (snapshot.size > 0) {
                                badge.classList.remove('hidden');
                            } else {
                                badge.classList.add('hidden');
                            }
                        }
                    });
            }
        }

        // Toast notifications
        function showToast(message, type = 'info') {
            const toast = document.getElementById('toastMessage');
            const text = document.getElementById('toastText');
            const icon = document.getElementById('toastIcon');

            text.innerText = message;

            if (type === 'success') {
                icon.innerText = "🏆";
                toast.className = "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-emeraldSuccess/95 text-cosmicBg px-6 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center space-x-2.5 transition-all duration-300 z-50";
                text.className = "text-cosmicBg";
            } else if (type === 'error') {
                icon.innerText = "⚠️";
                toast.className = "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center space-x-2.5 transition-all duration-300 z-50";
                text.className = "text-white";
            } else {
                icon.innerText = "🪙";
                toast.className = "fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-cosmicSurfaceVariant border border-borderDark px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold flex items-center space-x-2.5 transition-all duration-300 z-50";
                text.className = "text-white";
            }

            toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
            toast.classList.add('opacity-100', 'translate-y-0');

            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
                toast.classList.remove('opacity-100', 'translate-y-0');
            }, 4000);
        }
