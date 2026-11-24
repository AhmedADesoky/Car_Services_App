package com.carservices.app.Navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.carservices.app.AppContainer
import com.carservices.core.security.Session
import com.carservices.feature.auth.BindScreen
import com.carservices.feature.auth.BindViewModel
import com.carservices.feature.auth.LoginScreen
import com.carservices.feature.auth.LoginViewModel
import com.carservices.feature.auth.AccountSetupScreen
import com.carservices.feature.auth.SetupViewModel
import com.carservices.feature.station.StationApp
import com.carservices.feature.home.HomeViewModel

object Routes {
    const val BIND = "bind"     // S1
    const val LOGIN = "login"   // 01
    const val SETUP = "setup"   // S2 - first sign-in: new password + 2-step verification
    const val HOME = "home"     // 02
}

/** Bind -> Login -> Home. The start screen follows the stored session. */
@Composable
fun AppNavHost(container: AppContainer, session: Session, nav: NavHostController = rememberNavController()) {
    val start = remember {
        when {
            session.isSignedIn -> Routes.HOME
            session.isBound -> Routes.LOGIN
            else -> Routes.BIND
        }
    }

    // Token expired or revoked elsewhere -> back to Sign in
    LaunchedEffect(session.isSignedIn, session.isBound) {
        val route = nav.currentDestination?.route
        if (route == Routes.HOME && !session.isSignedIn) nav.goTo(if (session.isBound) Routes.LOGIN else Routes.BIND)
    }

    NavHost(navController = nav, startDestination = start) {
        composable(Routes.BIND) {
            val vm = viewModel { BindViewModel(container.authRepository) }
            BindScreen(vm, onBound = { nav.goTo(Routes.LOGIN) })
        }
        composable(Routes.LOGIN) {
            val vm = viewModel { LoginViewModel(container.authRepository) }
            LoginScreen(
                viewModel = vm,
                stationName = session.stationName ?: "",
                onSignedIn = { nav.goTo(Routes.HOME) },
                onStationChanged = { nav.goTo(Routes.BIND) },
                onNeedsSetup = { nav.navigate(Routes.SETUP) },
            )
        }
        composable(Routes.SETUP) {
            val vm = viewModel { SetupViewModel(container.authRepository) }
            AccountSetupScreen(vm, onDone = { nav.goTo(Routes.HOME) }, onCancel = { nav.goTo(Routes.LOGIN) })
        }
        composable(Routes.HOME) {
            // 02+ : the station shell (UI screens with sample data; each feature wires its logic in its phase).
            // Name and station come from the real signed-in user.
            val vm = viewModel { HomeViewModel(container.api, container.sessions) }
            val state by vm.state.collectAsStateWithLifecycle()
            StationApp(
                userName = state.me?.displayName ?: "",
                stationName = state.me?.stationName ?: session.stationName ?: "",
                onSignOut = { vm.signOut { nav.goTo(Routes.LOGIN) } },
            )
        }
    }
}

private fun NavHostController.goTo(route: String) = navigate(route) {
    popUpTo(graph.id) { inclusive = true }
    launchSingleTop = true
}
