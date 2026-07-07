package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.UserState

@Composable
fun DashboardScreen(
    modifier: Modifier = Modifier,
    userState: UserState,
    isClaimLoading: Boolean,
    isFirebaseAvailable: Boolean,
    cooldownSeconds: Long,
    onClaimReward: () -> Unit,
    onLogout: () -> Unit
) {
    val scrollState = rememberScrollState()

    // Breathing effect for the main claim button
    val infiniteTransition = rememberInfiniteTransition(label = "pulse_button")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    // Spinning glow effect for the background of the coin
    val spinAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(20000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "spin_angle"
    )

    val claimAvailable = cooldownSeconds <= 0L
    val progress = if (cooldownSeconds > 0) {
        // Calculate fraction of 24h passed
        val totalSecsInDay = 24f * 60f * 60f
        ((totalSecsInDay - cooldownSeconds) / totalSecsInDay).coerceIn(0f, 1f)
    } else {
        1.0f
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.background,
                        Color(0xFF0F1524),
                        Color(0xFF080B13)
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(24.dp))

            // 1. HEADER SECTION
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Profile picture avatar placeholder with custom background and initials
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(
                                        MaterialTheme.colorScheme.primary,
                                        MaterialTheme.colorScheme.secondary
                                    )
                                )
                            )
                            .border(BorderStroke(1.5.dp, Color.White), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = userState.displayName.take(2).uppercase(),
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column {
                        Text(
                            text = "Welcome back,",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = userState.displayName,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        )
                    }
                }

                // Logout button
                IconButton(
                    onClick = onLogout,
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.08f))
                        .testTag("logout_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                        contentDescription = "Log out",
                        tint = Color.White
                    )
                }
            }

            // 2. MAIN COIN VAULT CARD (COIN DISK AND BALANCE)
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        // Coin illustration container with subtle radial glowing backdrop
                        Box(
                            modifier = Modifier.size(120.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(90.dp)
                                    .background(
                                        brush = Brush.radialGradient(
                                            colors = listOf(
                                                MaterialTheme.colorScheme.primary.copy(alpha = 0.25f),
                                                Color.Transparent
                                            )
                                        )
                                    )
                            )
                            Image(
                                painter = painterResource(id = R.drawable.img_gold_chest), // we reuse the chest / coin art
                                contentDescription = "Gold Coin Stack",
                                modifier = Modifier.size(84.dp),
                                contentScale = ContentScale.Fit
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Text(
                            text = "GOLD COIN VAULT",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            letterSpacing = 1.5.sp
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        // Large coin balance
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "🪙",
                                fontSize = 34.sp,
                                modifier = Modifier.padding(end = 8.dp)
                            )
                            Text(
                                text = "${userState.coins}",
                                fontSize = 48.sp,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.testTag("coin_balance_text")
                            )
                            Text(
                                text = " coins",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White.copy(alpha = 0.7f),
                                modifier = Modifier.padding(top = 16.dp, start = 4.dp)
                            )
                        }
                    }
                }
            }

            // 3. DAILY REWARDS TIMER & CLAIM SECTION
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2638)),
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(
                    1.dp,
                    if (claimAvailable) MaterialTheme.colorScheme.primary.copy(alpha = 0.4f) else Color.Transparent
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "DAILY REWARD",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        letterSpacing = 1.5.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (claimAvailable) "Your daily bonus is ready!" else "Next reward loading...",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Claim +10 coins every 24 hours to keep your streak alive.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    if (!claimAvailable) {
                        // Countdown state
                        Text(
                            text = formatCooldown(cooldownSeconds),
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = Color.White,
                            modifier = Modifier
                                .testTag("cooldown_timer_text")
                                .padding(vertical = 4.dp)
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        // Progress bar towards next claim
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = MaterialTheme.colorScheme.primary,
                            trackColor = Color.White.copy(alpha = 0.1f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Claimed",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "${(progress * 100).toInt()}% towards next bonus",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    } else {
                        // Reward is claimable! Show a grand pulsating CTA Button
                        Button(
                            onClick = onClaimReward,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(60.dp)
                                .scale(if (isClaimLoading) 1.0f else pulseScale)
                                .testTag("claim_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                            shape = RoundedCornerShape(16.dp),
                            elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp),
                            enabled = !isClaimLoading
                        ) {
                            if (isClaimLoading) {
                                CircularProgressIndicator(
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    modifier = Modifier.size(24.dp)
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onPrimary
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "CLAIM REWARD (+10 🪙)",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                            }
                        }
                    }
                }
            }

            // 4. WEEKLY STREAK REWARD PROGRESSION
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        text = "WEEKLY REWARDS STREAK",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        letterSpacing = 1.5.sp,
                        modifier = Modifier.padding(bottom = 14.dp)
                    )

                    // A beautiful 7-day grid showing claims
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        val currentDay = ((userState.coins / 10) % 7) + 1
                        val isFullyCompleted = userState.coins > 0 && userState.coins % 70 == 0
                        
                        for (day in 1..7) {
                            val isClaimed = day < currentDay || (isFullyCompleted && day <= 7)
                            val isCurrent = day == currentDay && !isFullyCompleted && claimAvailable

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                isClaimed -> MaterialTheme.colorScheme.tertiary.copy(alpha = 0.15f)
                                                isCurrent -> MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                                                else -> Color.White.copy(alpha = 0.05f)
                                            }
                                        )
                                        .border(
                                            border = BorderStroke(
                                                width = if (isCurrent) 1.5.dp else 1.dp,
                                                color = when {
                                                    isClaimed -> MaterialTheme.colorScheme.tertiary
                                                    isCurrent -> MaterialTheme.colorScheme.primary
                                                    else -> Color.White.copy(alpha = 0.15f)
                                                }
                                            ),
                                            shape = CircleShape
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isClaimed) {
                                        Icon(
                                            imageVector = Icons.Default.CheckCircle,
                                            contentDescription = "Day $day Claimed",
                                            tint = MaterialTheme.colorScheme.tertiary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    } else {
                                        Text(
                                            text = "+10",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isCurrent) MaterialTheme.colorScheme.primary else Color.White.copy(alpha = 0.5f)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Day $day",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (isCurrent) MaterialTheme.colorScheme.primary else Color.White.copy(alpha = 0.5f)
                                )
                            }
                        }
                    }
                }
            }

            // 5. FIRESTORE SETUP GUIDE / INTEGRATION BANNER
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isFirebaseAvailable) {
                        MaterialTheme.colorScheme.tertiary.copy(alpha = 0.06f)
                    } else {
                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.06f)
                    }
                ),
                shape = RoundedCornerShape(20.dp),
                border = BorderStroke(
                    1.dp,
                    if (isFirebaseAvailable) {
                        MaterialTheme.colorScheme.tertiary.copy(alpha = 0.25f)
                    } else {
                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.25f)
                    }
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = "Status info",
                        tint = if (isFirebaseAvailable) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = if (isFirebaseAvailable) "Firebase Cloud Connected" else "Developer Sandbox Mode Active",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isFirebaseAvailable) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.secondary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isFirebaseAvailable) {
                                "Coin ledger and claim timers are synced in real-time under the Firestore 'Users' collection for safety."
                            } else {
                                "The app is ready for production cloud sync! Connect your Firebase project:\n" +
                                        "1. Register package com.aistudio.dailyrewards.clvxp in Firebase Console.\n" +
                                        "2. Put your download google-services.json in the /app folder.\n" +
                                        "3. Enable Firestore and create the 'Users' collection with 'Coin' (int) and lastClaimedTimestamp (long) fields."
                            },
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            lineHeight = 16.sp
                        )
                    }
                }
            }
        }
    }
}

private fun formatCooldown(totalSeconds: Long): String {
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return String.format("%02d : %02d : %02d", h, m, s)
}
