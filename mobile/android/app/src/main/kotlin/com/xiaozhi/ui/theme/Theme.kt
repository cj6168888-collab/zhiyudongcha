package com.xiaozhi.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val GoldAccent = Color(0xFFFFB300)
private val DeepBlue = Color(0xFF0A1628)
private val TitaniumBlack = Color(0xFF030712)

private val DarkColorScheme = darkColorScheme(
    primary = GoldAccent,
    onPrimary = TitaniumBlack,
    primaryContainer = Color(0xFF3D2E00),
    onPrimaryContainer = Color(0xFFFFE08A),
    secondary = Color(0xFF64B5F6),
    onSecondary = TitaniumBlack,
    tertiary = Color(0xFFCE93D8),
    onTertiary = TitaniumBlack,
    background = TitaniumBlack,
    onBackground = Color(0xFFE1E3E5),
    surface = DeepBlue,
    onSurface = Color(0xFFE1E3E5),
    surfaceVariant = Color(0xFF1A2435),
    onSurfaceVariant = Color(0xFFC4C6CF),
    outline = Color(0xFF8E9099),
    error = Color(0xFFCF6679),
    onError = TitaniumBlack
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFFB8860B),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFE082),
    onPrimaryContainer = Color(0xFF3D2E00),
    secondary = Color(0xFF1976D2),
    onSecondary = Color.White,
    tertiary = Color(0xFF7B1FA2),
    onTertiary = Color.White,
    background = Color(0xFFFFFBFE),
    onBackground = Color(0xFF1C1B1F),
    surface = Color(0xFFFFFBFE),
    onSurface = Color(0xFF1C1B1F),
    surfaceVariant = Color(0xFFE7E0EC),
    onSurfaceVariant = Color(0xFF49454F),
    outline = Color(0xFF79747E),
    error = Color(0xFFB3261E),
    onError = Color.White
)

@Composable
fun XiaoZhiTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }
    
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }
    
    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

val Typography = Typography()
