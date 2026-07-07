package com.example.ui.components

import androidx.compose.runtime.withFrameMillis
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import kotlin.random.Random

data class ConfettiParticle(
    var x: Float,
    var y: Float,
    var vx: Float,
    var vy: Float,
    val size: Float,
    val color: Color,
    var rotation: Float,
    val rotationSpeed: Float,
    var alpha: Float,
    val shapeType: Int // 0: Circle (Coin), 1: Rectangle (Paper)
)

@Composable
fun ConfettiEffect(
    modifier: Modifier = Modifier,
    trigger: Any?,
    onFinished: () -> Unit = {}
) {
    val particles = remember { mutableStateListOf<ConfettiParticle>() }

    // Spawn particles when trigger changes to non-null
    LaunchedEffect(trigger) {
        if (trigger != null) {
            particles.clear()
            // Spawn 80 golden confetti particles
            repeat(80) {
                val angle = Random.nextFloat() * Math.PI * 2
                val speed = Random.nextFloat() * 12f + 8f
                particles.add(
                    ConfettiParticle(
                        // Spawn at center top or center of the screen
                        x = 0.5f, // normalized, will be scaled in draw
                        y = 0.3f,
                        vx = (cos(angle) * speed).toFloat(),
                        vy = (sin(angle) * speed - 5f).toFloat(), // eject upwards initially
                        size = Random.nextFloat() * 20f + 12f,
                        color = when (Random.nextInt(4)) {
                            0 -> Color(0xFFFFD700) // Pure Gold
                            1 -> Color(0xFFFFA000) // Dark Amber
                            2 -> Color(0xFFFFF176) // Light Yellow Sparkle
                            else -> Color(0xFFE0A900) // Coin Edge Bronze
                        },
                        rotation = Random.nextFloat() * 360f,
                        rotationSpeed = Random.nextFloat() * 10f - 5f,
                        alpha = 1.0f,
                        shapeType = Random.nextInt(2)
                    )
                )
            }
        }
    }

    // Physics Animation Loop
    if (particles.isNotEmpty()) {
        LaunchedEffect(particles) {
            var lastTime = withFrameMillis { it }
            while (particles.isNotEmpty()) {
                val now = withFrameMillis { it }
                val dt = ((now - lastTime) / 16f).coerceIn(0.1f, 2.0f) // normalized frame step
                lastTime = now

                val iterator = particles.iterator()
                while (iterator.hasNext()) {
                    val p = iterator.next()
                    // Update positions with gravity
                    p.x += p.vx * 0.8f * dt
                    p.y += p.vy * 0.8f * dt
                    p.vy += 0.4f * dt // Gravity force
                    p.vx *= 0.98f // Air resistance
                    p.rotation += p.rotationSpeed * dt
                    p.alpha -= 0.015f * dt // Fade out

                    if (p.alpha <= 0f || p.y > 1.2f) {
                        iterator.remove()
                    }
                }
            }
            onFinished()
        }

        Canvas(modifier = modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height

            particles.forEach { p ->
                val drawX = p.x * width
                val drawY = p.y * height

                rotate(p.rotation, pivot = Offset(drawX, drawY)) {
                    if (p.shapeType == 0) {
                        // Golden Coin circle
                        drawCircle(
                            color = p.color.copy(alpha = p.alpha),
                            radius = p.size / 2f,
                            center = Offset(drawX, drawY)
                        )
                        // Draw inner circle for coin detail
                        drawCircle(
                            color = Color(0xFF161B22).copy(alpha = p.alpha * 0.3f),
                            radius = p.size / 3.5f,
                            center = Offset(drawX, drawY)
                        )
                    } else {
                        // Elegant metallic rectangle banner
                        val rectSize = p.size
                        drawRect(
                            color = p.color.copy(alpha = p.alpha),
                            topLeft = Offset(drawX - rectSize / 2f, drawY - rectSize / 4f),
                            size = androidx.compose.ui.geometry.Size(rectSize, rectSize / 2f)
                        )
                    }
                }
            }
        }
    }
}

private fun cos(angle: Double): Double = Math.cos(angle)
private fun sin(angle: Double): Double = Math.sin(angle)
