package com.carservices.core.designsystem

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Icon

/** Primary navy button, 58 dp tall, as on the Sign in design. */
@Composable
fun CarPrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, loading: Boolean = false, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(58.dp),
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(containerColor = CarColors.Navy, contentColor = CarColors.Surface),
    ) {
        if (loading) {
            CircularProgressIndicator(modifier = Modifier.size(22.dp), color = CarColors.Surface, strokeWidth = 2.dp)
        } else {
            Text(text, style = MaterialTheme.typography.titleMedium)
        }
    }
}

/** Outlined field with a leading icon, 16 dp corners. */
@Composable
fun CarTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        leadingIcon = { Icon(icon, contentDescription = null, tint = CarColors.TextTertiary) },
        singleLine = true,
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (isPassword) KeyboardType.Password else keyboardType),
        shape = MaterialTheme.shapes.small,
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = CarColors.Navy, unfocusedBorderColor = CarColors.Outline),
        modifier = modifier.fillMaxWidth(),
    )
}

/** EN / عربي toggle from the Sign in design. */
@Composable
fun LanguageToggle(language: AppLanguage, onChange: (AppLanguage) -> Unit, modifier: Modifier = Modifier) {
    SingleChoiceSegmentedButtonRow(modifier = modifier) {
        listOf(AppLanguage.English to "EN", AppLanguage.Arabic to "عربي").forEachIndexed { index, (lang, label) ->
            SegmentedButton(
                selected = language == lang,
                onClick = { onChange(lang) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = 2),
                colors = SegmentedButtonDefaults.colors(
                    activeContainerColor = CarColors.Surface,
                    activeContentColor = CarColors.Navy,
                    inactiveContainerColor = CarColors.Navy,
                    inactiveContentColor = CarColors.OnNavyMuted,
                ),
                icon = {},
                modifier = Modifier.width(72.dp),
            ) { Text(label) }
        }
    }
}

/** Small status line, e.g. server connection on Home. */
@Composable
fun StatusChip(text: String, ok: Boolean, modifier: Modifier = Modifier) {
    Row(modifier = modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = (if (ok) "● " else "○ ") + text,
            color = if (ok) CarColors.TealGlow else CarColors.Orange,
            style = MaterialTheme.typography.labelMedium,
        )
    }
}
