package com.example.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme =
  darkColorScheme(
    primary = GoldPrimary,
    onPrimary = CosmicBackground,
    secondary = AmberAccent,
    onSecondary = CosmicBackground,
    tertiary = EmeraldTertiary,
    onTertiary = CosmicBackground,
    background = CosmicBackground,
    onBackground = TextPrimaryDark,
    surface = CosmicSurface,
    onSurface = TextPrimaryDark,
    surfaceVariant = CosmicSurfaceVariant,
    onSurfaceVariant = TextSecondaryDark,
    outline = BorderDark
  )

private val LightColorScheme =
  lightColorScheme(
    primary = AmberAccent,
    onPrimary = Color.White,
    secondary = GoldPrimary,
    onSecondary = CosmicBackground,
    tertiary = EmeraldTertiary,
    onTertiary = Color.White,
    background = Color(0xFFFAFAFA),
    onBackground = Color(0xFF1C1B1F),
    surface = Color.White,
    onSurface = Color(0xFF1C1B1F),
    surfaceVariant = Color(0xFFF0F0F0),
    onSurfaceVariant = Color(0xFF49454F),
  )

@Composable
fun MyApplicationTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  // Dynamic color is available on Android 12+
  dynamicColor: Boolean = true,
  content: @Composable () -> Unit,
) {
  val colorScheme =
    when {
      dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
        val context = LocalContext.current
        if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
      }

      darkTheme -> DarkColorScheme
      else -> LightColorScheme
    }

  MaterialTheme(colorScheme = colorScheme, typography = Typography, content = content)
}
