package com.carservices.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DocumentScanner
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.StatusChip
import com.carservices.core.designsystem.tr

/** 02 - Worker home (shell). Orders, check-in and the plate scanner plug in during P4-P6. */
@Composable
fun HomeScreen(viewModel: HomeViewModel, onSignedOut: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val name = state.me?.displayName ?: "…"

    Scaffold(
        containerColor = CarColors.Background,
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { /* P4: open Scan plate */ },
                containerColor = CarColors.Teal,
                contentColor = Color.White,
                icon = { Icon(Icons.Outlined.DocumentScanner, contentDescription = null) },
                text = { Text(tr("scan_plate")) },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).statusBarsPadding(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 8.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(44.dp).background(CarColors.BlueLight, CircleShape), contentAlignment = Alignment.Center) {
                    Text(name.take(2).uppercase(), color = CarColors.Navy, style = MaterialTheme.typography.titleMedium)
                }
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(state.me?.stationName ?: "", color = CarColors.TextSecondary, style = MaterialTheme.typography.labelMedium)
                    Text("${tr("good_morning")}, $name", style = MaterialTheme.typography.headlineSmall)
                }
                IconButton(onClick = { viewModel.signOut(onSignedOut) }) {
                    Icon(Icons.Outlined.Logout, contentDescription = tr("sign_out"), tint = CarColors.Navy)
                }
            }

            Column(
                Modifier.padding(horizontal = 16.dp).fillMaxWidth()
                    .background(CarColors.Navy, RoundedCornerShape(28.dp)).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(tr("server"), color = CarColors.OnNavyMuted, style = MaterialTheme.typography.labelMedium)
                StatusChip("API: " + if (state.serverOk) tr("server_ok") else tr("server_down"), ok = state.serverOk)
                StatusChip("Supabase DB: " + if (state.databaseOk) tr("server_ok") else tr("server_down"), ok = state.databaseOk)
                state.me?.let {
                    Text("${tr("roles")}: ${it.roles.joinToString()}", color = Color.White, style = MaterialTheme.typography.bodyMedium)
                }
            }

            Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("0", tr("active_orders"), CarColors.Surface, CarColors.NavyInk, Modifier.weight(1f))
                StatCard("0", tr("jobs_done"), CarColors.Surface, CarColors.NavyInk, Modifier.weight(1f))
                StatCard("0", tr("ready_checkout"), CarColors.OrangeLight, CarColors.OrangeDark, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun StatCard(value: String, label: String, background: Color, foreground: Color, modifier: Modifier = Modifier) {
    Column(modifier.background(background, RoundedCornerShape(20.dp)).padding(14.dp)) {
        Text(value, color = foreground, style = MaterialTheme.typography.headlineSmall)
        Text(label, color = foreground, style = MaterialTheme.typography.labelMedium)
    }
}
