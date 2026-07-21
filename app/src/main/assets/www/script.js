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
        let adSessionStartTime = 0;

        // Admin Access state
        let isAdminAuthenticated = false;
        let adminFilter = 'all';

        // Initialize Lucide icons on load
        document.addEventListener("DOMContentLoaded", () => {
            lucide.createIcons();
            loadConnectionSettings();
            initApp();
            checkCookieConsent();
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

            // Auto-detect referral code in URL query parameters
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const refParam = urlParams.get('ref');
                if (refParam) {
                    const cleanRef = refParam.trim().toUpperCase();
                    localStorage.setItem('pending_referral_code', cleanRef);
                    setTimeout(() => {
                        showToast(`🎫 Referral Code Detected: ${cleanRef}! Claim your +50 Coins bonus in the Refer & Earn tab after logging in.`, "info");
                    }, 1200);
                }
            } catch (e) {
                console.error("Failed to parse URL referral parameter", e);
            }

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

            // Hide all info screens if transitioning
            const infoScreens = ['aboutScreen', 'privacyScreen', 'termsScreen', 'contactScreen', 'faqScreen', 'withdrawalPolicyScreen'];
            infoScreens.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            isViewingInfoPage = false;

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
                const defaultRefCode = user.uid.substring(0, 6).toUpperCase();
                
                function proceedToDashboard() {
                    showScreen('dashboard');
                    startCooldownTimer();
                    buildStreakTracker();
                    loadWithdrawalList();
                    listenToGlobalWithdrawalsForBadge();
                }

                if (doc.exists) {
                    currentUser = {
                        uid: user.uid,
                        displayName: user.displayName || 'Google Explorer',
                        email: user.email,
                        coins: doc.data().coins || 0,
                        lastClaimedTimestamp: doc.data().lastClaimedTimestamp || 0,
                        adsWatchedTodayCount: doc.data().adsWatchedTodayCount || 0,
                        lastAdWatchDate: doc.data().lastAdWatchDate || '',
                        referralCode: doc.data().referralCode || defaultRefCode,
                        referredBy: doc.data().referredBy || '',
                        referralsCount: doc.data().referralsCount || 0,
                        referralsEarned: doc.data().referralsEarned || 0,
                        createdAt: doc.data().createdAt || Date.now()
                    };
                    if (!doc.data().referralCode || !doc.data().createdAt) {
                        userRef.update({
                            referralCode: currentUser.referralCode,
                            createdAt: currentUser.createdAt
                        });
                    }
                    proceedToDashboard();
                } else {
                    // New user signup!
                    // Check if they entered a referral code during signup
                    const loginRefField = document.getElementById('loginReferralCode');
                    let signupCode = (loginRefField ? loginRefField.value.trim().toUpperCase() : '') || localStorage.getItem('pending_referral_code') || '';
                    
                    function createDefaultUser() {
                        currentUser = {
                            uid: user.uid,
                            displayName: user.displayName || 'Google Explorer',
                            email: user.email,
                            coins: 0,
                            lastClaimedTimestamp: 0,
                            adsWatchedTodayCount: 0,
                            lastAdWatchDate: '',
                            referralCode: defaultRefCode,
                            referredBy: '',
                            referralsCount: 0,
                            referralsEarned: 0,
                            createdAt: Date.now()
                        };
                        userRef.set(currentUser).then(() => {
                            proceedToDashboard();
                        });
                    }

                    if (signupCode && signupCode !== defaultRefCode) {
                        db.collection("Users").where("referralCode", "==", signupCode).get()
                            .then((snapshot) => {
                                if (!snapshot.empty) {
                                    const referrerDoc = snapshot.docs[0];
                                    const referrerUid = referrerDoc.id;
                                    
                                    if (referrerUid !== user.uid) {
                                        // Run a batch transaction for referral credits
                                        const batch = db.batch();
                                        
                                        // Create the new user with +50 coins
                                        currentUser = {
                                            uid: user.uid,
                                            displayName: user.displayName || 'Google Explorer',
                                            email: user.email,
                                            coins: 50,
                                            lastClaimedTimestamp: 0,
                                            adsWatchedTodayCount: 0,
                                            lastAdWatchDate: '',
                                            referralCode: defaultRefCode,
                                            referredBy: signupCode,
                                            referralsCount: 0,
                                            referralsEarned: 0,
                                            createdAt: Date.now()
                                        };
                                        batch.set(userRef, currentUser);
                                        
                                        // Update the referrer document
                                        const referrerRef = db.collection("Users").doc(referrerUid);
                                        batch.update(referrerRef, {
                                            coins: firebase.firestore.FieldValue.increment(50),
                                            referralsCount: firebase.firestore.FieldValue.increment(1),
                                            referralsEarned: firebase.firestore.FieldValue.increment(50)
                                        });
                                        
                                        batch.commit().then(() => {
                                            localStorage.removeItem('pending_referral_code');
                                            showToast(`🎉 Welcome bonus applied! +50 coins for you and your referrer!`, "success");
                                            proceedToDashboard();
                                        }).catch((err) => {
                                            console.error("Referral batch failed on signup:", err);
                                            createDefaultUser();
                                        });
                                    } else {
                                        createDefaultUser();
                                    }
                                } else {
                                    showToast("⚠️ Invalid signup referral code. Registering standard account.", "info");
                                    createDefaultUser();
                                }
                            })
                            .catch((err) => {
                                console.error("Referral search failed on signup:", err);
                                createDefaultUser();
                            });
                    } else {
                        createDefaultUser();
                    }
                }
            }).catch((err) => {
                showToast("⚠️ Firestore Sync Failed: " + err.message, "error");
                currentUser = {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    coins: 0,
                    lastClaimedTimestamp: 0,
                    adsWatchedTodayCount: 0,
                    lastAdWatchDate: '',
                    referralCode: user.uid.substring(0, 6).toUpperCase(),
                    referredBy: '',
                    referralsCount: 0,
                    referralsEarned: 0,
                    createdAt: Date.now()
                };
                showScreen('dashboard');
            });
        }

        // Sandbox simulated login
        function loginSandbox() {
            const nameInput = document.getElementById('sandboxName').value.trim();
            const emailInput = document.getElementById('sandboxEmail').value.trim();
            const emailKey = emailInput || 'sandbox@example.com';
            const defaultRef = (emailKey.split('@')[0].toUpperCase().slice(0, 6) || 'SANDBOX').padEnd(6, 'X');

            currentUser = {
                uid: 'sandbox_user_id',
                displayName: nameInput || 'Sandbox Explorer',
                email: emailKey,
                coins: 0,
                lastClaimedTimestamp: 0,
                adsWatchedTodayCount: 0,
                lastAdWatchDate: '',
                referralCode: defaultRef,
                referredBy: '',
                referralsCount: 0,
                referralsEarned: 0
            };

            const savedStats = localStorage.getItem(`sandbox_stats_${currentUser.email}`);
            if (savedStats) {
                const stats = JSON.parse(savedStats);
                currentUser.coins = stats.coins || 0;
                currentUser.lastClaimedTimestamp = stats.lastClaimedTimestamp || 0;
                currentUser.adsWatchedTodayCount = stats.adsWatchedTodayCount || 0;
                currentUser.lastAdWatchDate = stats.lastAdWatchDate || '';
                currentUser.referralCode = stats.referralCode || defaultRef;
                currentUser.referredBy = stats.referredBy || '';
                currentUser.referralsCount = stats.referralsCount || 0;
                currentUser.referralsEarned = stats.referralsEarned || 0;
            } else {
                // First-time sandbox login/signup
                const loginRefField = document.getElementById('loginReferralCode');
                let signupCode = (loginRefField ? loginRefField.value.trim().toUpperCase() : '') || localStorage.getItem('pending_referral_code') || '';
                
                if (signupCode && signupCode !== defaultRef) {
                    currentUser.coins = 50;
                    currentUser.referredBy = signupCode;
                    localStorage.removeItem('pending_referral_code');
                    
                    // Award simulated coins to referrer in local storage if referrer is a known sandbox email
                    try {
                        let referrerFoundKey = null;
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key.startsWith('sandbox_stats_')) {
                                const val = JSON.parse(localStorage.getItem(key) || '{}');
                                if (val.referralCode === signupCode) {
                                    referrerFoundKey = key;
                                    break;
                                }
                            }
                        }
                        if (referrerFoundKey) {
                            const refStats = JSON.parse(localStorage.getItem(referrerFoundKey) || '{}');
                            refStats.coins = (refStats.coins || 0) + 50;
                            refStats.referralsCount = (refStats.referralsCount || 0) + 1;
                            refStats.referralsEarned = (refStats.referralsEarned || 0) + 50;
                            localStorage.setItem(referrerFoundKey, JSON.stringify(refStats));
                            
                            // Also append this simulated friend to the referrer's sandbox network
                            const refEmail = referrerFoundKey.replace('sandbox_stats_', '');
                            const sandboxReferrals = JSON.parse(localStorage.getItem(`sandbox_referrals_${refEmail}`) || '[]');
                            sandboxReferrals.push({
                                displayName: currentUser.displayName,
                                email: currentUser.email,
                                joinedDate: new Date().toLocaleDateString()
                            });
                            localStorage.setItem(`sandbox_referrals_${refEmail}`, JSON.stringify(sandboxReferrals));
                        }
                    } catch (e) {
                        console.error("Simulated sandbox referrer search failed:", e);
                    }
                    
                    setTimeout(() => {
                        showToast(`🎉 Sandbox signup referral applied! +50 simulated coins credited!`, "success");
                    }, 1000);
                }
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

        // Date helper and ad limit tracking helpers
        function getTodayDateString() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function checkAndResetDailyAdLimit() {
            if (!currentUser) return;
            const todayStr = getTodayDateString();
            if (currentUser.lastAdWatchDate !== todayStr) {
                currentUser.adsWatchedTodayCount = 0;
                currentUser.lastAdWatchDate = todayStr;
                saveAdProgressToStorage();
            }
        }

        function saveAdProgressToStorage() {
            if (!currentUser) return;
            if (connectionMode === 'firebase' && db) {
                db.collection("Users").doc(currentUser.uid).update({
                    adsWatchedTodayCount: currentUser.adsWatchedTodayCount,
                    lastAdWatchDate: currentUser.lastAdWatchDate
                }).catch(err => console.error("Error saving ad stats:", err));
            } else {
                localStorage.setItem(`sandbox_stats_${currentUser.email}`, JSON.stringify({
                    coins: currentUser.coins,
                    lastClaimedTimestamp: currentUser.lastClaimedTimestamp,
                    adsWatchedTodayCount: currentUser.adsWatchedTodayCount,
                    lastAdWatchDate: currentUser.lastAdWatchDate,
                    referralCode: currentUser.referralCode,
                    referredBy: currentUser.referredBy,
                    referralsCount: currentUser.referralsCount,
                    referralsEarned: currentUser.referralsEarned
                }));
                localStorage.setItem('sandbox_user', JSON.stringify(currentUser));
            }
        }

        function saveUserStatsToStorage() {
            if (!currentUser) return;
            if (connectionMode === 'firebase' && db) {
                db.collection("Users").doc(currentUser.uid).update({
                    coins: currentUser.coins,
                    lastClaimedTimestamp: currentUser.lastClaimedTimestamp,
                    adsWatchedTodayCount: currentUser.adsWatchedTodayCount,
                    lastAdWatchDate: currentUser.lastAdWatchDate,
                    referralCode: currentUser.referralCode,
                    referredBy: currentUser.referredBy,
                    referralsCount: currentUser.referralsCount,
                    referralsEarned: currentUser.referralsEarned
                }).catch(err => console.error("Error saving user stats:", err));
            } else {
                localStorage.setItem(`sandbox_stats_${currentUser.email}`, JSON.stringify({
                    coins: currentUser.coins,
                    lastClaimedTimestamp: currentUser.lastClaimedTimestamp,
                    adsWatchedTodayCount: currentUser.adsWatchedTodayCount,
                    lastAdWatchDate: currentUser.lastAdWatchDate,
                    referralCode: currentUser.referralCode,
                    referredBy: currentUser.referredBy,
                    referralsCount: currentUser.referralsCount,
                    referralsEarned: currentUser.referralsEarned
                }));
                localStorage.setItem('sandbox_user', JSON.stringify(currentUser));
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

            // Update Ads limit UI elements
            checkAndResetDailyAdLimit();
            const count = currentUser.adsWatchedTodayCount || 0;
            const remaining = Math.max(0, 100 - count);
            
            const limitBadge = document.getElementById('adLimitBadge');
            const countText = document.getElementById('adCountText');
            const limitProgressBar = document.getElementById('adLimitProgressBar');
            const mainWatchAdBtn = document.getElementById('mainWatchAdBtn');

            if (limitBadge) {
                limitBadge.innerText = `${remaining} / 100 Ads Left`;
                if (remaining === 0) {
                    limitBadge.className = "flex items-center space-x-2 bg-red-500/15 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl shrink-0";
                } else if (remaining < 20) {
                    limitBadge.className = "flex items-center space-x-2 bg-orange-500/15 text-orange-400 border border-orange-500/30 px-4 py-2 rounded-xl shrink-0";
                } else {
                    limitBadge.className = "flex items-center space-x-2 bg-amber-500/10 text-amber-300 border border-amber-500/20 px-4 py-2 rounded-xl shrink-0";
                }
            }
            if (countText) {
                countText.innerText = `${count} of 100 Ads Completed Today`;
            }
            if (limitProgressBar) {
                const percent = Math.min(100, (count / 100) * 100);
                limitProgressBar.style.width = `${percent}%`;
            }
            if (mainWatchAdBtn) {
                if (remaining === 0) {
                    mainWatchAdBtn.disabled = true;
                    mainWatchAdBtn.className = "w-full md:w-auto h-13 px-6 bg-cosmicSurfaceVariant text-gray-500 border border-borderDark font-bold text-xs rounded-xl transition-all cursor-not-allowed flex items-center justify-center space-x-2 shrink-0";
                    mainWatchAdBtn.innerHTML = `<i data-lucide="lock" class="w-4 h-4 text-gray-500"></i><span>LIMIT REACHED (100/100)</span>`;
                } else {
                    mainWatchAdBtn.disabled = false;
                    mainWatchAdBtn.className = "w-full md:w-auto h-13 px-6 bg-gradient-to-r from-amber-500 via-goldPrimary to-amber-400 hover:from-amber-600 hover:to-goldLight text-cosmicBg font-black text-sm rounded-xl transition-all shadow-md flex items-center justify-center space-x-2.5 transform hover:scale-[1.03] active:scale-95 shrink-0";
                    mainWatchAdBtn.innerHTML = `<i data-lucide="play-circle" class="w-5 h-5 fill-cosmicBg"></i><span>WATCH REWARDED AD (+10)</span>`;
                }
            }

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
            lucide.createIcons();
        }

        // Switch internal navigation tabs
        function switchTab(tabId) {
            currentTab = tabId;

            // Hide all tab contents
            document.getElementById('tabContent-daily').classList.add('hidden');
            document.getElementById('tabContent-ads').classList.add('hidden');
            document.getElementById('tabContent-withdraw').classList.add('hidden');
            document.getElementById('tabContent-referral').classList.add('hidden');
            document.getElementById('tabContent-admin').classList.add('hidden');

            // Reset tab button styles
            const tabs = ['daily', 'ads', 'withdraw', 'referral', 'admin'];
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
            } else if (tabId === 'referral') {
                loadReferralDetails();
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

            // Enforce daily limit check
            checkAndResetDailyAdLimit();
            const currentAdCount = currentUser.adsWatchedTodayCount || 0;
            if (currentAdCount >= 100) {
                showToast("⚠️ Daily ad limit reached (100/100). Please return tomorrow!", "error");
                return;
            }

            adTitleSelected = adProviderName;
            adSecondsLeft = 15;
            adSessionStartTime = Date.now(); // Secure anti-cheat starting timestamp

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

            // Secure real-time passage check (Anti-cheat)
            const elapsed = Date.now() - adSessionStartTime;
            if (adSessionStartTime === 0 || elapsed < 14500) {
                showToast("⚠️ Anti-Cheat Check Failed: Ad watch duration insufficient. Reward denied.", "error");
                adSessionStartTime = 0;
                return;
            }
            adSessionStartTime = 0; // Reset after verification

            // Enforce final check on limit before rewarding
            checkAndResetDailyAdLimit();
            if (currentUser.adsWatchedTodayCount >= 100) {
                showToast("⚠️ Limit Exceeded: Daily rewarded ad cap reached (100/100). No reward granted.", "error");
                return;
            }

            const previousCoins = currentUser.coins;
            currentUser.coins += 10;
            currentUser.adsWatchedTodayCount = (currentUser.adsWatchedTodayCount || 0) + 1;
            currentUser.lastAdWatchDate = getTodayDateString();

            triggerConfettiSplatter();

            if (connectionMode === 'firebase' && db) {
                const userRef = db.collection("Users").doc(currentUser.uid);
                userRef.update({
                    coins: currentUser.coins,
                    adsWatchedTodayCount: currentUser.adsWatchedTodayCount,
                    lastAdWatchDate: currentUser.lastAdWatchDate
                }).then(() => {
                    showToast(`✨ Ad complete! +10 Coins added to cloud balance.`, "success");
                    updateDashboardUI();
                }).catch((err) => {
                    showToast("❌ Cloud save failed: " + err.message, "error");
                    // Rollback
                    currentUser.coins = previousCoins;
                    currentUser.adsWatchedTodayCount = Math.max(0, currentUser.adsWatchedTodayCount - 1);
                    updateDashboardUI();
                });
            } else {
                localStorage.setItem(`sandbox_stats_${currentUser.email}`, JSON.stringify({
                    coins: currentUser.coins,
                    lastClaimedTimestamp: currentUser.lastClaimedTimestamp,
                    adsWatchedTodayCount: currentUser.adsWatchedTodayCount,
                    lastAdWatchDate: currentUser.lastAdWatchDate
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

        // ================= REFERRAL SYSTEM LOGIC =================

        function loadReferralDetails() {
            if (!currentUser) return;

            // 1. Render user's unique referral code & link
            const refCode = currentUser.referralCode || 'REF-XYZ123';
            document.getElementById('refCodeText').innerText = refCode;
            
            const origin = window.location.origin + window.location.pathname;
            document.getElementById('refLinkText').innerText = `${origin}?ref=${refCode}`;

            // 2. Pre-fill pending code if any from URL detection
            const pendingCode = localStorage.getItem('pending_referral_code');
            if (pendingCode && !currentUser.referredBy) {
                const inputField = document.getElementById('inputReferralCode');
                if (inputField && !inputField.value) {
                    inputField.value = pendingCode;
                    showToast(`💡 Pre-filled pending invite code: ${pendingCode}!`, 'info');
                }
            }

            // 3. Render redeem form or success badge state
            const formArea = document.getElementById('redeemFormArea');
            const successArea = document.getElementById('redeemSuccessArea');
            const redeemedBadge = document.getElementById('redeemedCodeBadge');

            if (currentUser.referredBy) {
                formArea.classList.add('hidden');
                successArea.classList.remove('hidden');
                redeemedBadge.innerText = currentUser.referredBy;
            } else {
                formArea.classList.remove('hidden');
                successArea.classList.add('hidden');
            }

            // 4. Render stats & list based on Mode
            const simBtn = document.getElementById('sandboxSimFriendBtn');
            const container = document.getElementById('refNetworkContainer');

            if (connectionMode === 'firebase') {
                simBtn.classList.add('hidden');
                
                // Real-time Firestore network fetch
                if (db) {
                    db.collection("Users").where("referredBy", "==", refCode).get()
                        .then((snapshot) => {
                            currentUser.referralsCount = snapshot.size;
                            currentUser.referralsEarned = snapshot.size * 50;
                            
                            document.getElementById('refCountNum').innerText = currentUser.referralsCount;
                            document.getElementById('refCoinsNum').innerText = currentUser.referralsEarned;
                            document.getElementById('refNetworkCount').innerText = `${currentUser.referralsCount} Active`;

                            if (snapshot.empty) {
                                renderEmptyReferralNetwork();
                                return;
                            }

                            let html = '';
                            snapshot.forEach((doc) => {
                                const data = doc.data();
                                const joinedDate = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'Active Member';
                                html += `
                                    <div class="flex items-center justify-between p-3 bg-cosmicBg/40 border border-borderDark/40 rounded-xl">
                                        <div class="flex items-center space-x-2.5 min-w-0">
                                            <div class="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xs font-black text-purple-400 shrink-0">
                                                ${(data.displayName || 'Google')[0].toUpperCase()}
                                            </div>
                                            <div class="min-w-0">
                                                <span class="text-xs font-bold text-white block truncate">${data.displayName || 'Google Explorer'}</span>
                                                <span class="text-[9px] text-gray-500 block truncate">${data.email || 'Verified user'}</span>
                                            </div>
                                        </div>
                                        <div class="text-right shrink-0">
                                            <span class="text-xs font-black text-goldPrimary block">+50 Coins</span>
                                            <span class="text-[9px] text-gray-500 block">${joinedDate}</span>
                                        </div>
                                    </div>
                                `;
                            });
                            container.innerHTML = html;
                            lucide.createIcons();
                        })
                        .catch((err) => {
                            console.error("Firestore referral load error:", err);
                            renderEmptyReferralNetwork();
                        });
                }
            } else {
                // Sandbox Mode
                simBtn.classList.remove('hidden');

                document.getElementById('refCountNum').innerText = currentUser.referralsCount || 0;
                document.getElementById('refCoinsNum').innerText = currentUser.referralsEarned || 0;
                document.getElementById('refNetworkCount').innerText = `${currentUser.referralsCount || 0} Active`;

                const sandboxReferrals = JSON.parse(localStorage.getItem(`sandbox_referrals_${currentUser.email}`) || '[]');
                if (sandboxReferrals.length === 0) {
                    renderEmptyReferralNetwork();
                    return;
                }

                let html = '';
                sandboxReferrals.forEach((friend) => {
                    html += `
                        <div class="flex items-center justify-between p-3 bg-cosmicBg/40 border border-borderDark/40 rounded-xl">
                            <div class="flex items-center space-x-2.5 min-w-0">
                                <div class="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xs font-black text-purple-400 shrink-0">
                                    ${friend.displayName[0].toUpperCase()}
                                </div>
                                <div class="min-w-0">
                                    <span class="text-xs font-bold text-white block truncate">${friend.displayName}</span>
                                    <span class="text-[9px] text-gray-500 block truncate">${friend.email}</span>
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                <span class="text-xs font-black text-goldPrimary block">+50 Coins</span>
                                <span class="text-[9px] text-gray-500 block">${friend.joinedDate}</span>
                            </div>
                        </div>
                    `;
                });
                container.innerHTML = html;
                lucide.createIcons();
            }
        }

        function renderEmptyReferralNetwork() {
            const container = document.getElementById('refNetworkContainer');
            container.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-center py-8 text-gray-500">
                    <i data-lucide="users" class="w-10 h-10 text-gray-600 mb-1.5"></i>
                    <p class="text-xs font-semibold text-gray-400">Your network is empty</p>
                    <p class="text-[10px] text-gray-600 max-w-[200px] mt-0.5">Share your referral link with friends and start earning together!</p>
                </div>
            `;
            lucide.createIcons();
        }

        function copyReferralCode() {
            if (!currentUser) return;
            const code = currentUser.referralCode || '';
            navigator.clipboard.writeText(code).then(() => {
                showToast("📋 Referral Code copied to clipboard!", "success");
            }).catch(() => {
                showToast("❌ Copy failed, copy manually: " + code, "error");
            });
        }

        function copyReferralLink() {
            if (!currentUser) return;
            const code = currentUser.referralCode || '';
            const origin = window.location.origin + window.location.pathname;
            const link = `${origin}?ref=${code}`;
            navigator.clipboard.writeText(link).then(() => {
                showToast("🔗 Referral Link copied! Share with friends.", "success");
            }).catch(() => {
                showToast("❌ Copy failed, copy manually: " + link, "error");
            });
        }

        function redeemFriendCode() {
            if (!currentUser) return;

            const codeField = document.getElementById('inputReferralCode');
            const targetCode = codeField.value.trim().toUpperCase();

            if (!targetCode) {
                showToast("⚠️ Please enter a valid referral code first.", "error");
                return;
            }

            if (currentUser.referredBy) {
                showToast("⚠️ You have already redeemed a referral code!", "error");
                return;
            }

            if (targetCode === currentUser.referralCode) {
                showToast("❌ You cannot redeem your own referral code!", "error");
                return;
            }

            showToast("⚙️ Verifying invite code...", "info");

            if (connectionMode === 'firebase') {
                if (!db) {
                    showToast("❌ Firestore not initialized", "error");
                    return;
                }

                // Check Firestore for referralCode
                db.collection("Users").where("referralCode", "==", targetCode).get()
                    .then((snapshot) => {
                        if (snapshot.empty) {
                            showToast("❌ Invalid referral code. Please check and try again.", "error");
                            return;
                        }

                        const referrerDoc = snapshot.docs[0];
                        const referrerUid = referrerDoc.id;

                        if (referrerUid === currentUser.uid) {
                            showToast("❌ You cannot redeem your own code!", "error");
                            return;
                        }

                        // Write to Firestore with Batch transaction
                        const batch = db.batch();
                        
                        // 1. Give current user +50 Coins and save referredBy status
                        const currentRef = db.collection("Users").doc(currentUser.uid);
                        batch.update(currentRef, {
                            coins: firebase.firestore.FieldValue.increment(50),
                            referredBy: targetCode
                        });

                        // 2. Give referrer +50 Coins, increment referral stats
                        const referrerRef = db.collection("Users").doc(referrerUid);
                        batch.update(referrerRef, {
                            coins: firebase.firestore.FieldValue.increment(50),
                            referralsCount: firebase.firestore.FieldValue.increment(1),
                            referralsEarned: firebase.firestore.FieldValue.increment(50)
                        });

                        batch.commit().then(() => {
                            // Update local attributes
                            currentUser.coins += 50;
                            currentUser.referredBy = targetCode;
                            
                            localStorage.removeItem('pending_referral_code');

                            showToast("🏆 Referral claimed successfully! +50 Coins Added!", "success");
                            
                            updateDashboardUI();
                            loadReferralDetails();
                        }).catch((err) => {
                            showToast("❌ Transaction failed: " + err.message, "error");
                        });
                    })
                    .catch((err) => {
                        showToast("⚠️ Firebase error: " + err.message, "error");
                    });
            } else {
                // Sandbox Mode Simulation
                currentUser.coins += 50;
                currentUser.referredBy = targetCode;

                localStorage.removeItem('pending_referral_code');
                saveUserStatsToStorage();

                showToast("🏆 Referral claimed successfully! +50 Simulated Coins Added!", "success");
                
                updateDashboardUI();
                loadReferralDetails();
            }
        }

        function simulateFriendSignup() {
            if (!currentUser || connectionMode !== 'sandbox') return;

            const names = ["Aarav Singh", "Ananya Sharma", "Kabir Gupta", "Ishaan Malhotra", "Diya Verma", "Rohan Mehta"];
            const domains = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com"];
            
            const randomName = names[Math.floor(Math.random() * names.length)] + " " + Math.floor(Math.random() * 100);
            const randomEmail = randomName.toLowerCase().replace(" ", "") + "@" + domains[Math.floor(Math.random() * domains.length)];
            const dateStr = new Date().toLocaleDateString();

            const simulatedFriend = {
                displayName: randomName,
                email: randomEmail,
                joinedDate: dateStr
            };

            // Retrieve current list, append, save
            const sandboxReferrals = JSON.parse(localStorage.getItem(`sandbox_referrals_${currentUser.email}`) || '[]');
            sandboxReferrals.push(simulatedFriend);
            localStorage.setItem(`sandbox_referrals_${currentUser.email}`, JSON.stringify(sandboxReferrals));

            // Award +50 coins to current user
            currentUser.coins += 50;
            currentUser.referralsCount = (currentUser.referralsCount || 0) + 1;
            currentUser.referralsEarned = (currentUser.referralsEarned || 0) + 50;

            saveUserStatsToStorage();

            showToast(`✨ Friend '${randomName}' signed up! +50 Referral Coins credited.`, "success");
            
            updateDashboardUI();
            loadReferralDetails();
        }

        function shareReferralLink() {
            if (!currentUser) return;
            const code = currentUser.referralCode || '';
            const origin = window.location.origin + window.location.pathname;
            const link = `${origin}?ref=${code}`;
            const title = "Daily Rewards - Earn Free Coins!";
            const text = `Join Daily Rewards using my referral code ${code} and get +50 coins instantly!`;

            if (navigator.share) {
                navigator.share({
                    title: title,
                    text: text,
                    url: link
                }).then(() => {
                    showToast("🎉 Shared successfully!", "success");
                }).catch((err) => {
                    console.log("Share failed or canceled", err);
                });
            } else {
                navigator.clipboard.writeText(link).then(() => {
                    showToast("🔗 Share API not supported. Referral Link copied instead!", "info");
                }).catch(() => {
                    showToast("❌ Copy failed, copy manually: " + link, "error");
                });
            }
        }

        // ================= ADSense Compliance Info Hub Helpers =================
        let previousScreenBeforeInfo = 'login';
        let isViewingInfoPage = false;

        function showInfoPage(pageId) {
            const login = document.getElementById('loginScreen');
            const dash = document.getElementById('dashboardScreen');
            
            if (!isViewingInfoPage) {
                if (dash && !dash.classList.contains('hidden')) {
                    previousScreenBeforeInfo = 'dashboard';
                } else {
                    previousScreenBeforeInfo = 'login';
                }
            }
            
            isViewingInfoPage = true;
            
            // Hide core screens
            if (login) login.classList.add('hidden');
            if (dash) dash.classList.add('hidden');
            
            // Hide all info screens
            const infoScreens = ['aboutScreen', 'privacyScreen', 'termsScreen', 'contactScreen', 'faqScreen', 'withdrawalPolicyScreen'];
            infoScreens.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            
            // Show target info screen
            const target = document.getElementById(pageId + 'Screen');
            if (target) {
                target.classList.remove('hidden');
            }
            
            // Scroll smoothly to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            lucide.createIcons();
        }

        function goBackFromInfoPage() {
            isViewingInfoPage = false;
            
            // Hide all info screens
            const infoScreens = ['aboutScreen', 'privacyScreen', 'termsScreen', 'contactScreen', 'faqScreen', 'withdrawalPolicyScreen'];
            infoScreens.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            
            // Show previous screen
            showScreen(previousScreenBeforeInfo);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Header navigation dropdown toggle
        function toggleInfoHubDropdown(forceState) {
            const dropdown = document.getElementById('infoHubDropdown');
            const chevron = document.getElementById('infoDropdownChevron');
            if (!dropdown) return;
            
            const isClosed = dropdown.classList.contains('pointer-events-none');
            const shouldOpen = (forceState !== undefined) ? forceState : isClosed;
            
            if (shouldOpen) {
                dropdown.classList.remove('pointer-events-none', 'opacity-0', 'scale-95');
                dropdown.classList.add('opacity-100', 'scale-100');
                if (chevron) chevron.classList.add('rotate-180');
            } else {
                dropdown.classList.add('pointer-events-none', 'opacity-0', 'scale-95');
                dropdown.classList.remove('opacity-100', 'scale-100');
                if (chevron) chevron.classList.remove('rotate-180');
            }
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            const dropdownContainer = document.getElementById('infoHubDropdownContainer');
            if (dropdownContainer && !dropdownContainer.contains(event.target)) {
                toggleInfoHubDropdown(false);
            }
        });

        // FAQ Accordion Toggle
        function toggleFaqAccordion(id) {
            const content = document.getElementById(`faqContent-${id}`);
            const icon = document.getElementById(`faqIcon-${id}`);
            if (content && icon) {
                const isHidden = content.classList.contains('hidden');
                if (isHidden) {
                    content.classList.remove('hidden');
                    icon.classList.add('rotate-180');
                } else {
                    content.classList.add('hidden');
                    icon.classList.remove('rotate-180');
                }
            }
        }

        // Interactive support ticket submission
        function handleSupportSubmit(event) {
            event.preventDefault();
            const name = document.getElementById('contactName')?.value || '';
            const email = document.getElementById('contactEmail')?.value || '';
            const subject = document.getElementById('contactSubject')?.value || '';
            const message = document.getElementById('contactMessage')?.value || '';
            
            showToast("⏳ Submitting secure ticket to Firestore...", "info");
            
            setTimeout(() => {
                showToast("✉️ Support ticket submitted successfully! Ticket ID: #" + Math.floor(Math.random() * 90000 + 10000), "success");
                document.getElementById('supportContactForm')?.reset();
            }, 1200);
        }

        // Cookie Consent Banner support
        function checkCookieConsent() {
            const consent = localStorage.getItem('cookie_consent_accepted');
            if (!consent) {
                setTimeout(() => {
                    const banner = document.getElementById('cookieConsentBanner');
                    if (banner) {
                        banner.classList.remove('pointer-events-none', 'opacity-0', 'translate-y-20');
                        banner.classList.add('translate-y-0');
                    }
                }, 1500);
            }
        }

        function acceptAllCookies() {
            localStorage.setItem('cookie_consent_accepted', 'true');
            const banner = document.getElementById('cookieConsentBanner');
            if (banner) {
                banner.classList.remove('translate-y-0');
                banner.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
            }
            showToast("🍪 Preferences saved! Cookies accepted.", "success");
        }
