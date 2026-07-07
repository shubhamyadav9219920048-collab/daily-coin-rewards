package com.example.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class RewardRepository(private val context: Context) {

    private val sharedPrefs: SharedPreferences = context.getSharedPreferences("daily_rewards_prefs", Context.MODE_PRIVATE)
    private var isFirebaseInit: Boolean = false
    
    // Auth and Firestore instances (will be initialized only if Firebase is available)
    private var firebaseAuth: FirebaseAuth? = null
    private var firestore: FirebaseFirestore? = null

    init {
        checkFirebaseAvailability()
    }

    fun isFirebaseAvailable(): Boolean = isFirebaseInit

    private fun checkFirebaseAvailability() {
        try {
            // Check if Firebase is already initialized or can be initialized
            val apps = FirebaseApp.getApps(context)
            if (apps.isNotEmpty()) {
                firebaseAuth = FirebaseAuth.getInstance()
                firestore = FirebaseFirestore.getInstance()
                isFirebaseInit = true
                Log.d("RewardRepository", "Firebase is successfully connected and available.")
            } else {
                // Try initializing
                FirebaseApp.initializeApp(context)
                firebaseAuth = FirebaseAuth.getInstance()
                firestore = FirebaseFirestore.getInstance()
                isFirebaseInit = true
                Log.d("RewardRepository", "Firebase initialized successfully.")
            }
        } catch (e: Exception) {
            isFirebaseInit = false
            Log.w("RewardRepository", "Firebase not initialized. Running in local sandbox mode. Error: ${e.message}")
        }
    }

    // Observe user state either from Firestore or Local SharedPreferences
    fun observeUserState(userId: String): Flow<UserState?> = callbackFlow {
        if (!isFirebaseInit || firestore == null) {
            // Fallback: Local Sandbox mode
            val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
                if (key != null && key.startsWith(userId)) {
                    trySend(getLocalUserState(userId))
                }
            }
            sharedPrefs.registerOnSharedPreferenceChangeListener(listener)
            trySend(getLocalUserState(userId))
            awaitClose { sharedPrefs.unregisterOnSharedPreferenceChangeListener(listener) }
        } else {
            // Real Firebase Firestore integration
            val docRef = firestore!!.collection("Users").document(userId)
            val registration = docRef.addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e("RewardRepository", "Firestore listener error", error)
                    return@addSnapshotListener
                }
                if (snapshot != null && snapshot.exists()) {
                    val coin = snapshot.getLong("Coin")?.toInt() ?: 0
                    val lastClaim = snapshot.getLong("lastClaimedTimestamp") ?: 0L
                    val name = snapshot.getString("displayName") ?: "Firebase User"
                    val email = snapshot.getString("email") ?: ""
                    trySend(UserState(userId, name, email, coin, lastClaim))
                } else {
                    // Create default user document if it does not exist
                    val currentAuthUser = firebaseAuth?.currentUser
                    val defaultUser = UserState(
                        userId = userId,
                        displayName = currentAuthUser?.displayName ?: "User",
                        email = currentAuthUser?.email ?: "",
                        coins = 0,
                        lastClaimedTimestamp = 0L
                    )
                    docRef.set(
                        mapOf(
                            "Coin" to defaultUser.coins,
                            "lastClaimedTimestamp" to defaultUser.lastClaimedTimestamp,
                            "displayName" to defaultUser.displayName,
                            "email" to defaultUser.email
                        ),
                        SetOptions.merge()
                    )
                    trySend(defaultUser)
                }
            }
            awaitClose { registration.remove() }
        }
    }

    // Claim reward of 10 coins
    suspend fun claimDailyReward(userId: String): Result<UserState> {
        val now = System.currentTimeMillis()
        if (!isFirebaseInit || firestore == null) {
            // Fallback Sandbox logic
            val currentUser = getLocalUserState(userId) ?: return Result.failure(Exception("User not found"))
            val timeElapsed = now - currentUser.lastClaimedTimestamp
            if (timeElapsed < 24 * 60 * 60 * 1000) {
                val remainingMs = (24 * 60 * 60 * 1000) - timeElapsed
                val hours = remainingMs / (1000 * 60 * 60)
                val minutes = (remainingMs / (1000 * 60)) % 60
                return Result.failure(Exception("Already claimed. Try again in ${hours}h ${minutes}m"))
            }

            val updatedUser = currentUser.copy(
                coins = currentUser.coins + 10,
                lastClaimedTimestamp = now
            )
            saveLocalUser(updatedUser)
            return Result.success(updatedUser)
        } else {
            // Real Firestore transaction
            val docRef = firestore!!.collection("Users").document(userId)
            return try {
                val updatedState = firestore!!.runTransaction { transaction ->
                    val snapshot = transaction.get(docRef)
                    if (!snapshot.exists()) {
                        throw Exception("User document does not exist.")
                    }

                    val currentCoins = snapshot.getLong("Coin")?.toInt() ?: 0
                    val lastClaim = snapshot.getLong("lastClaimedTimestamp") ?: 0L
                    val name = snapshot.getString("displayName") ?: "User"
                    val email = snapshot.getString("email") ?: ""

                    val elapsed = now - lastClaim
                    if (elapsed < 24 * 60 * 60 * 1000) {
                        throw Exception("Cooldown active")
                    }

                    val newCoins = currentCoins + 10
                    transaction.update(docRef, "Coin", newCoins)
                    transaction.update(docRef, "lastClaimedTimestamp", now)

                    UserState(userId, name, email, newCoins, now)
                }.await()
                Result.success(updatedState)
            } catch (e: Exception) {
                if (e.message == "Cooldown active") {
                    Result.failure(Exception("Daily reward already claimed. Cooldown active!"))
                } else {
                    Result.failure(e)
                }
            }
        }
    }

    // Google Sign in authentication setup
    suspend fun signInWithGoogle(idToken: String): Result<UserState> {
        if (!isFirebaseInit || firebaseAuth == null) {
            // Return dummy user for Sandbox simulation
            val defaultSandboxUser = UserState(
                userId = "sandbox_user_id",
                displayName = "Sandbox Explorer",
                email = "sandbox@example.com",
                coins = sharedPrefs.getInt("sandbox_user_id_coins", 0),
                lastClaimedTimestamp = sharedPrefs.getLong("sandbox_user_id_lastClaimed", 0L)
            )
            saveLocalUser(defaultSandboxUser)
            return Result.success(defaultSandboxUser)
        } else {
            return try {
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                val authResult = firebaseAuth!!.signInWithCredential(credential).await()
                val firebaseUser = authResult.user ?: throw Exception("Auth returned empty user")
                
                val userState = UserState(
                    userId = firebaseUser.uid,
                    displayName = firebaseUser.displayName ?: "User",
                    email = firebaseUser.email ?: "",
                    coins = 0,
                    lastClaimedTimestamp = 0L
                )
                
                // Write user on firestore
                val docRef = firestore!!.collection("Users").document(firebaseUser.uid)
                val doc = docRef.get().await()
                if (!doc.exists()) {
                    docRef.set(
                        mapOf(
                            "Coin" to userState.coins,
                            "lastClaimedTimestamp" to userState.lastClaimedTimestamp,
                            "displayName" to userState.displayName,
                            "email" to userState.email
                        )
                    ).await()
                }

                Result.success(userState)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    // Local Helper Methods
    private fun getLocalUserState(userId: String): UserState? {
        val email = sharedPrefs.getString("${userId}_email", "") ?: ""
        val name = sharedPrefs.getString("${userId}_name", "") ?: ""
        if (name.isEmpty() && email.isEmpty() && userId != "sandbox_user_id") {
            return null
        }
        val finalName = if (name.isEmpty()) "Sandbox User" else name
        val finalEmail = if (email.isEmpty()) "sandbox@example.com" else email
        val coins = sharedPrefs.getInt("${userId}_coins", 0)
        val lastClaim = sharedPrefs.getLong("${userId}_lastClaimed", 0L)
        return UserState(userId, finalName, finalEmail, coins, lastClaim)
    }

    fun saveLocalUser(user: UserState) {
        sharedPrefs.edit()
            .putString("${user.userId}_email", user.email)
            .putString("${user.userId}_name", user.displayName)
            .putInt("${user.userId}_coins", user.coins)
            .putLong("${user.userId}_lastClaimed", user.lastClaimedTimestamp)
            .apply()
    }

    fun logout() {
        if (isFirebaseInit) {
            firebaseAuth?.signOut()
        }
    }
}
