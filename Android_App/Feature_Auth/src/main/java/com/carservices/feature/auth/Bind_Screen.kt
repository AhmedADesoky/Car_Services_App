package com.carservices.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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

/** S1 - bind this phone to a station once (QR scan arrives with CameraX in P1). */
@Composable
fun BindScreen(viewModel: BindViewModel, onBound: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val language = LocalAppLanguage.current
    LaunchedEffect(state.bound) { if (state.bound) onBound() }

    Column(Modifier.fillMaxSize().background(CarColors.Navy).statusBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.End) {
            LanguageToggle(language, onChange = { viewModel.setLanguage(it.code) })
        }
        Column(Modifier.padding(horizontal = 24.dp, vertical = 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(tr("bind_title"), style = MaterialTheme.typography.displaySmall, color = CarColors.Surface)
            Text(tr("bind_subtitle"), style = MaterialTheme.typography.bodyMedium, color = CarColors.OnNavyMuted)
        }
        Spacer(Modifier.weight(1f))
        Column(
            Modifier.fillMaxWidth()
                .background(CarColors.Surface, RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            CarTextField(state.stationCode, viewModel::onCodeChange, tr("station_code"), Icons.Outlined.Store)
            errorText(state.errorCode, language == AppLanguage.Arabic)?.let {
                Text(it, color = CarColors.OrangeDark, style = MaterialTheme.typography.bodyMedium)
            }
            CarPrimaryButton(tr("continue"), onClick = viewModel::bind, loading = state.loading)
            Spacer(Modifier.height(8.dp))
        }
    }
}
