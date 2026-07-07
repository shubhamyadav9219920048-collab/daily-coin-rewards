package com.example.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.RewardRepository
import com.example.data.UserState
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class RewardViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = RewardRepository(application)

    private val _userState = MutableStateFlow<UserState?>(null)
    val userState: StateFlow<UserState?> = _userState.asStateFlow()

    private val _isClaimLoading = MutableStateFlow(false)
    val isClaimLoading: StateFlow<Boolean> = _isClaimLoading.asStateFlow()

    private val _cooldownSeconds = MutableStateFlow(0L)
    val cooldownSeconds: StateFlow<Long> = _cooldownSeconds.asStateFlow()

    private val _claimSuccessTrigger = MutableSharedFlow<Unit>()
    val claimSuccessTrigger: SharedFlow<Unit> = _claimSuccessTrigger.asSharedFlow()

    private val _uiError = MutableStateFlow<String?>(null)
    val uiError: StateFlow<String?> = _uiError.asStateFlow()

    val isFirebaseAvailable: Boolean = repository.isFirebaseAvailable()

    private var countdownJob: Job? = null
    private var observeJob: Job? = null

    init {
        // Automatically sign in sandbox user on start if Firebase is not available
        if (!isFirebaseAvailable) {
            loginSandboxUser()
        }
    }

    private fun loginSandboxUser() {
        viewModelScope.launch {
            val result = repository.signInWithGoogle("")
            result.onSuccess { sandboxUser ->
                _userState.value = sandboxUser
                startObservingUser(sandboxUser.userId)
            }.onFailure { error ->
                _uiError.value = error.message
            }
        }
    }

    fun handleGoogleSignInSuccess(idToken: String) {
        viewModelScope.launch {
            _isClaimLoading.value = true
            val result = repository.signInWithGoogle(idToken)
            result.onSuccess { user ->
                _userState.value = user
                startObservingUser(user.userId)
                _uiError.value = null
            }.onFailure { error ->
                _uiError.value = "Sign in failed: ${error.localizedMessage ?: "Unknown error"}"
            }
            _isClaimLoading.value = false
        }
    }

    fun loginSandboxWithCustomName(username: String, email: String) {
        viewModelScope.launch {
            val currentCoins = _userState.value?.coins ?: 0
            val currentLastClaim = _userState.value?.lastClaimedTimestamp ?: 0L
            val customUser = UserState(
                userId = "sandbox_user_id",
                displayName = username.ifEmpty { "Sandbox Explorer" },
                email = email.ifEmpty { "sandbox@example.com" },
                coins = currentCoins,
                lastClaimedTimestamp = currentLastClaim
            )
            repository.saveLocalUser(customUser)
            _userState.value = customUser
            startObservingUser(customUser.userId)
        }
    }

    private fun startObservingUser(userId: String) {
        observeJob?.cancel()
        observeJob = viewModelScope.launch {
            repository.observeUserState(userId).collectLatest { updatedUser ->
                _userState.value = updatedUser
                if (updatedUser != null) {
                    startCountdownTimer(updatedUser.lastClaimedTimestamp)
                } else {
                    stopCountdownTimer()
                }
            }
        }
    }

    private fun startCountdownTimer(lastClaimed: Long) {
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            val cooldownMs = 24L * 60 * 60 * 1000 // 24 hours
            while (true) {
                val now = System.currentTimeMillis()
                val elapsed = now - lastClaimed
                val remainingMs = cooldownMs - elapsed
                if (remainingMs > 0) {
                    _cooldownSeconds.value = remainingMs / 1000
                } else {
                    _cooldownSeconds.value = 0L
                }
                delay(1000)
            }
        }
    }

    private fun stopCountdownTimer() {
        countdownJob?.cancel()
        _cooldownSeconds.value = 0L
    }

    fun claimReward() {
        val user = _userState.value ?: return
        if (_cooldownSeconds.value > 0L) {
            _uiError.value = "Reward is on cooldown."
            return
        }

        viewModelScope.launch {
            _isClaimLoading.value = true
            _uiError.value = null
            val result = repository.claimDailyReward(user.userId)
            result.onSuccess {
                _claimSuccessTrigger.emit(Unit)
            }.onFailure { error ->
                _uiError.value = error.message ?: "Failed to claim reward. Try again."
            }
            _isClaimLoading.value = false
        }
    }

    fun clearError() {
        _uiError.value = null
    }

    fun logout() {
        repository.logout()
        _userState.value = null
        stopCountdownTimer()
        observeJob?.cancel()
        // If local sandbox, auto-sign back in so sandbox is immediately interactive
        if (!isFirebaseAvailable) {
            loginSandboxUser()
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopCountdownTimer()
        observeJob?.cancel()
    }
}
