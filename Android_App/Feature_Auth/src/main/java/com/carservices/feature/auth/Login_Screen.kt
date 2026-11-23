package com.carservices.feature.auth

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Face
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.ButtonDefaults
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
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarPrimaryButton
import com.carservices.core.designsystem.CarTextField
import com.carservices.core.designsystem.LanguageToggle
import com.carservices.core.designsystem.LocalAppLanguage
import com.carservices.core.designsystem.tr

/** 01 - Sign in, following the "01 Sign in" artboard: navy top, white sheet, EN / عربي toggle. */
@Composable
fun LoginScreen(viewModel: LoginViewModel, stationName: String, onSignedIn: () -> Unit, onStationChanged: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val language = LocalAppLanguage.current
    LaunchedEffect(state.signedIn) { if (state.signedIn) onSignedIn() }

    Column(Modifier.fillMaxSize().background(CarColors.Navy).statusBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(tr("station"), color = CarColors.OnNavyMuted, style = MaterialTheme.typography.labelMedium)
                Text(stationName, color = CarColors.Surface, style = MaterialTheme.typography.titleMedium)
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
                .background(CarColors.Surface, RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
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
            // Face unlock arrives with the face + liveness models (phase P6)
            FilledTonalButton(
                onClick = {},
                enabled = false,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.filledTonalButtonColors(containerColor = CarColors.TealLight, contentColor = CarColors.TealDark),
            ) {
                Icon(Icons.Outlined.Face, contentDescription = null, modifier = Modifier.size(22.dp))
                Text("  " + tr("unlock_face"))
            }
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                TextButton(onClick = { viewModel.changeStation(); onStationChanged() }) {
                    Text("${tr("not_your_station")} ${tr("change_station")}", color = CarColors.Navy)
                }
            }
        }
    }
}
