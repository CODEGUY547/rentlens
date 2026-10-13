package com.rentlens.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Forest = Color(0xFF176B3A)
val DeepForest = Color(0xFF123E29)
val Cream = Color(0xFFF7F4EC)
val Ink = Color(0xFF16251C)
val Muted = Color(0xFF607068)
val Amber = Color(0xFFB46A09)

private val LightColors = lightColorScheme(
    primary = Forest, onPrimary = Color.White, primaryContainer = Color(0xFFE3F2E8),
    onPrimaryContainer = DeepForest, secondary = DeepForest, background = Cream,
    onBackground = Ink, surface = Color.White, onSurface = Ink,
    surfaceVariant = Color(0xFFF0F3EF), onSurfaceVariant = Muted,
    outline = Color(0xFF7B8980), outlineVariant = Color(0xFFDDE5DF), tertiary = Amber,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF83D69B), onPrimary = Color(0xFF07391C),
    primaryContainer = Color(0xFF205D36), onPrimaryContainer = Color(0xFFC3F2CE),
    secondary = Color(0xFFF2D48A), background = Color(0xFF0E1711),
    onBackground = Color(0xFFE1EAE2), surface = Color(0xFF17211A),
    onSurface = Color(0xFFE1EAE2), surfaceVariant = Color(0xFF263229),
    onSurfaceVariant = Color(0xFFBBC9BD), outline = Color(0xFF89968B),
    outlineVariant = Color(0xFF3B493E), tertiary = Color(0xFFFFB86F),
)

@Composable
fun RentLensTheme(darkTheme: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, content = content)
}
