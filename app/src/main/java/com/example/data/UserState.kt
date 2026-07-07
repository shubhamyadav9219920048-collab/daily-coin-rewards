package com.example.data

data class UserState(
    val userId: String,
    val displayName: String,
    val email: String,
    val coins: Int,
    val lastClaimedTimestamp: Long
)
