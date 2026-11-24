package com.carservices.app

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.carservices.app.Navigation.AppNavHost
import com.carservices.core.designsystem.AppLanguage
import com.carservices.core.designsystem.CarTheme
import com.carservices.core.security.Session

class Main_Activity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Spec 12.3: block screenshots / screen recording of receipts, phones and finance in release builds.
        if (!BuildConfig.DEBUG) {
            window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        }
        val container = (application as Car_Services_Application).container
        setContent {
            val session by container.sessions.session.collectAsStateWithLifecycle(initialValue = null as Session?)
            val current = session ?: return@setContent   // first DataStore read, a few ms
            CarTheme(language = AppLanguage.fromCode(current.language)) {
                AppNavHost(container = container, session = current)
            }
        }
    }
}
