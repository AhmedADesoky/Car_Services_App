package com.carservices.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Primary navy button (same as `CarButton`) with a loading state for network actions. */
@Composable
fun CarPrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, loading: Boolean = false, enabled: Boolean = true) {
    if (!loading) CarButton(text, onClick, modifier, enabled = enabled)
    else Box(modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(18.dp)).background(CarColors.Navy), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(Modifier.size(22.dp), color = CarColors.Amber, strokeWidth = 2.dp)
    }
}

/** Text field used by the auth screens; same soft style as the rest of the app. */
@Composable
fun CarTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
) = SoftField(label, value, onValueChange, modifier, icon = icon, isPassword = isPassword, keyboardType = keyboardType)

/** EN / عربي glass pill toggle (works on dark backgrounds). */
@Composable
fun LanguageToggle(language: AppLanguage, onChange: (AppLanguage) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.08f)).border(1.dp, Color.White.copy(alpha = 0.14f), CircleShape).padding(3.dp)) {
        listOf(AppLanguage.English to "EN", AppLanguage.Arabic to "عربي").forEach { (lang, label) ->
            val active = language == lang
            val bg by animateColorAsState(if (active) Color.White else Color.Transparent, label = "lang")
            Box(Modifier.width(58.dp).height(34.dp).clip(CircleShape).background(bg).softClick { onChange(lang) }, contentAlignment = Alignment.Center) {
                Text(label, color = if (active) CarColors.Navy else Color.White.copy(alpha = 0.75f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/** Brand mark: amber crescent glyph + wordmark, as on the website header. */
@Composable
fun BrandMark(modifier: Modifier = Modifier, dark: Boolean = true) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(36.dp).shadow(10.dp, CircleShape, spotColor = CarColors.Amber).clip(CircleShape).background(CarColors.Amber), contentAlignment = Alignment.Center) {
            Box(Modifier.size(18.dp).clip(CircleShape).background(CarColors.Navy))
        }
        Text("  GarageOS", color = if (dark) Color.White else CarColors.Navy, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, style = MaterialTheme.typography.titleMedium)
    }
}

/** Small status line. */
@Composable
fun StatusChip(text: String, ok: Boolean, modifier: Modifier = Modifier) =
    StatusPill(text, if (ok) CarColors.Teal else CarColors.Orange, modifier.padding(vertical = 4.dp))
