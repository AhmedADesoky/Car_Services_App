package com.carservices.core.designsystem

import androidx.compose.ui.graphics.Color

/** Colours from Design_Tokens/Design_Tokens.json (taken from the Android design canvas). */
object CarColors {
    val Navy = Color(0xFF0B2545)
    val NavyInk = Color(0xFF0B1B2E)
    val Teal = Color(0xFF0E8A86)
    val TealDark = Color(0xFF08534F)
    val TealLight = Color(0xFFDDF2F1)
    val TealGlow = Color(0xFF7FD3CF)
    val Amber = Color(0xFFF2B544)
    val Orange = Color(0xFFE8833A)
    val OrangeDark = Color(0xFF8A3D0C)
    val OrangeLight = Color(0xFFFFE9D8)
    val BlueLight = Color(0xFFCFE0F1)
    val BlueTint = Color(0xFFDCE7F3)
    val Background = Color(0xFFF3F6FA)
    val Surface = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFF5A6B7D)
    val TextTertiary = Color(0xFF3E5368)
    val Outline = Color(0xFF8A9AAD)
    val Divider = Color(0xFFE3E9EF)
    val OnNavyMuted = Color(0xFFC9D6E5)

    // Status colours never change per station (design note "Language & station branding")
    val StatusRepaired = Teal
    val StatusReplaced = Navy
    val StatusAttention = Orange
}
