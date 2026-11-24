package com.carservices.core.designsystem

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val CarColorScheme = lightColorScheme(
    primary = CarColors.Navy,
    onPrimary = CarColors.Surface,
    secondary = CarColors.Teal,
    onSecondary = CarColors.Surface,
    secondaryContainer = CarColors.TealLight,
    onSecondaryContainer = CarColors.TealDark,
    tertiary = CarColors.Amber,
    background = CarColors.Background,
    onBackground = CarColors.NavyInk,
    surface = CarColors.Surface,
    onSurface = CarColors.NavyInk,
    onSurfaceVariant = CarColors.TextSecondary,
    outline = CarColors.Outline,
    error = CarColors.OrangeDark,
    errorContainer = CarColors.OrangeLight,
)

// Roboto Flex + Noto Kufi Arabic are the design fonts. Until the font files are added under
// res/font (phase P1, design-system task), the system sans-serif is used; Arabic falls back
// to the system Arabic font automatically.
private val CarFont = FontFamily.SansSerif

private val CarTypography = Typography(
    displaySmall = TextStyle(fontFamily = CarFont, fontWeight = FontWeight.ExtraBold, fontSize = 32.sp, lineHeight = 38.sp, letterSpacing = (-0.8).sp),
    headlineMedium = TextStyle(fontFamily = CarFont, fontWeight = FontWeight.ExtraBold, fontSize = 26.sp, lineHeight = 32.sp, letterSpacing = (-0.5).sp),
    headlineSmall = TextStyle(fontFamily = CarFont, fontWeight = FontWeight.ExtraBold, fontSize = 21.sp, letterSpacing = (-0.3).sp),
    titleMedium = TextStyle(fontFamily = CarFont, fontWeight = FontWeight.Bold, fontSize = 16.sp, letterSpacing = (-0.1).sp),
    bodyLarge = TextStyle(fontFamily = CarFont, fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontFamily = CarFont, fontSize = 14.sp, lineHeight = 21.sp),
    labelMedium = TextStyle(fontFamily = CarFont, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, letterSpacing = 0.2.sp),
)

private val CarShapes = Shapes(
    small = RoundedCornerShape(16.dp),   // fields
    medium = RoundedCornerShape(18.dp),  // buttons
    large = RoundedCornerShape(22.dp),   // cards
    extraLarge = RoundedCornerShape(28.dp), // sheets
)

/** App theme. Arabic switches the WHOLE layout to right-to-left. */
@Composable
fun CarTheme(language: AppLanguage = AppLanguage.English, content: @Composable () -> Unit) {
    val direction = if (language == AppLanguage.Arabic) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(
        LocalLayoutDirection provides direction,
        LocalAppLanguage provides language,
    ) {
        MaterialTheme(colorScheme = CarColorScheme, typography = CarTypography, shapes = CarShapes, content = content)
    }
}
