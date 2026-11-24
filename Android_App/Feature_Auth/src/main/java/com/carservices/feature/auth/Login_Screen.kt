package com.carservices.feature.auth

import androidx.activity.compose.BackHandler
import androidx.compose.material.icons.outlined.Pin
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.ui.text.input.KeyboardType
import com.carservices.core.designsystem.Glyph
import com.carservices.core.designsystem.l
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.border
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Face
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.carservices.core.designsystem.AppLanguage
import com.carservices.core.designsystem.BrandMark
import com.carservices.core.designsystem.paperBackground
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarPrimaryButton
import com.carservices.core.designsystem.CarTextField
import com.carservices.core.designsystem.LanguageToggle
import com.carservices.core.designsystem.LocalAppLanguage
import com.carservices.core.designsystem.tr

/** 01 - Sign in, following the "01 Sign in" artboard: navy top, white sheet, EN / عربي toggle. */
@Composable
fun LoginScreen(viewModel: LoginViewModel, stationName: String, onSignedIn: () -> Unit, onStationChanged: () -> Unit, onNeedsSetup: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val language = LocalAppLanguage.current
    LaunchedEffect(state.signedIn) { if (state.signedIn) onSignedIn() }
    LaunchedEffect(state.needsSetup) { if (state.needsSetup) { viewModel.setupHandled(); onNeedsSetup() } }
    if (state.mfaToken != null) { CodeStep(viewModel, state, stationName); return }

    Column(Modifier.fillMaxSize().paperBackground(dark = true).statusBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                BrandMark()
                Text("${tr("station")} · $stationName", color = CarColors.TealGlow, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
            }
            LanguageToggle(language, onChange = { viewModel.setLanguage(it.code) })
        }
        Column(Modifier.padding(horizontal = 24.dp, vertical = 40.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(tr("welcome_back"), style = MaterialTheme.typography.displaySmall, color = CarColors.Surface)
            Text(tr("signin_subtitle"), style = MaterialTheme.typography.bodyMedium, color = CarColors.OnNavyMuted)
        }
        Spacer(Modifier.weight(1f))
        Column(
            Modifier.fillMaxWidth()
                .background(CarColors.Background, RoundedCornerShape(topStart = 34.dp, topEnd = 34.dp))
                .navigationBarsPadding()
                .padding(horizontal = 24.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            CarTextField(state.username, viewModel::onUsernameChange, tr("username"), Icons.Outlined.Person)
            CarTextField(state.password, viewModel::onPasswordChange, tr("password"), Icons.Outlined.Lock, isPassword = true)
            errorText(state.errorCode, language == AppLanguage.Arabic)?.let {
                Text(it, color = CarColors.OrangeDark, style = MaterialTheme.typography.bodyMedium)
            }
            CarPrimaryButton(tr("sign_in"), onClick = viewModel::signIn, loading = state.loading)
            Row(verticalAlignment = Alignment.CenterVertically) {
                HorizontalDivider(Modifier.weight(1f), color = CarColors.Divider)
                Text(tr("or"), Modifier.padding(horizontal = 12.dp), color = CarColors.TextSecondary)
                HorizontalDivider(Modifier.weight(1f), color = CarColors.Divider)
            }
            // Face unlock arrives with the face + liveness models (phase P6): shown, not yet active
            Row(
                Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(18.dp)).border(1.dp, CarColors.Teal.copy(alpha = 0.25f), RoundedCornerShape(18.dp)),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Face, contentDescription = null, tint = CarColors.Teal.copy(alpha = 0.6f), modifier = Modifier.size(22.dp))
                Text("  " + tr("unlock_face"), color = CarColors.Teal.copy(alpha = 0.6f), style = MaterialTheme.typography.titleMedium)
            }
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                TextButton(onClick = { viewModel.changeStation(); onStationChanged() }) {
                    Text("${tr("not_your_station")} ${tr("change_station")}", color = CarColors.Navy)
                }
            }
        }
    }
}

/** 01b - 2-step verification: 6-digit code from the authenticator app, or a one-time recovery code. */
@Composable
private fun CodeStep(viewModel: LoginViewModel, state: LoginUiState, stationName: String) {
    val arabic = LocalAppLanguage.current == AppLanguage.Arabic
    BackHandler { viewModel.cancelCode() }
    Column(Modifier.fillMaxSize().paperBackground(dark = true).statusBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                BrandMark()
                Text("${tr("station")} · $stationName", color = CarColors.TealGlow, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
            }
        }
        Column(Modifier.padding(horizontal = 24.dp, vertical = 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Glyph(Icons.Outlined.Shield, size = 64.dp, dark = true, active = true)
            Spacer(Modifier.height(8.dp))
            Text(l("2-step verification", "التحقق بخطوتين"), style = MaterialTheme.typography.displaySmall, color = CarColors.Surface)
            Text(l("Open your authenticator app and type the 6-digit code for this station.", "افتح تطبيق المصادقة واكتب الرمز المكوّن من ٦ أرقام لهذه المحطة."),
                style = MaterialTheme.typography.bodyMedium, color = CarColors.OnNavyMuted)
        }
        Spacer(Modifier.weight(1f))
        Column(
            Modifier.fillMaxWidth()
                .background(CarColors.Background, RoundedCornerShape(topStart = 34.dp, topEnd = 34.dp))
                .navigationBarsPadding()
                .padding(horizontal = 24.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            CarTextField(state.code, viewModel::onCodeChange, l("Code", "الرمز"), Icons.Outlined.Pin, keyboardType = KeyboardType.Ascii)
            Text(l("Lost your phone? Type one of your recovery codes instead (like ABCD-EF23).", "فقدت هاتفك؟ اكتب أحد رموز الاسترداد بدلاً منه (مثل ABCD-EF23)."),
                color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium)
            errorText(state.errorCode, arabic)?.let { Text(it, color = CarColors.OrangeDark, style = MaterialTheme.typography.bodyMedium) }
            CarPrimaryButton(l("Verify", "تحقق"), onClick = viewModel::verifyCode, loading = state.loading, enabled = state.code.length >= 6)
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                TextButton(onClick = viewModel::cancelCode) { Text(l("Back to sign in", "العودة لتسجيل الدخول"), color = CarColors.Navy) }
            }
        }
    }
}
