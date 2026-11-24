package com.carservices.core.designsystem

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf

enum class AppLanguage(val code: String) {
    English("en"), Arabic("ar");

    companion object {
        fun fromCode(code: String?): AppLanguage = if (code == "ar") Arabic else English
    }
}

val LocalAppLanguage = staticCompositionLocalOf { AppLanguage.English }

/**
 * In-app strings so the EN / عربي toggle on Sign in switches instantly, without restarting
 * the activity. Move to Android string resources (values-ar) when translations grow.
 */
object AppStrings {
    private val en = mapOf(
        "station" to "Station",
        "bind_title" to "Connect this phone",
        "bind_subtitle" to "Type the station code your owner gave you, or scan the station QR.",
        "station_code" to "Station code",
        "continue" to "Continue",
        "welcome_back" to "Welcome back",
        "signin_subtitle" to "Sign in to start your day at the station.",
        "username" to "Username",
        "password" to "Password",
        "forgot_password" to "Forgot password?",
        "sign_in" to "Sign in",
        "or" to "or",
        "unlock_face" to "Unlock with face",
        "not_your_station" to "Not your station?",
        "change_station" to "Change station",
        "good_morning" to "Good morning",
        "server" to "Server",
        "server_ok" to "Connected",
        "server_down" to "Not reachable",
        "active_orders" to "Active orders",
        "jobs_done" to "Jobs done today",
        "ready_checkout" to "Ready to check out",
        "scan_plate" to "Scan plate",
        "sign_out" to "Sign out",
        "roles" to "Roles",
        "not_checked_in" to "Not checked in yet",
        "check_in_hint" to "Check in with your face at the station to start your shift.",
        "check_in" to "Check in",
        "error_network" to "Cannot reach the server. Check Wi-Fi and that the backend is running.",
    )
    private val ar = mapOf(
        "station" to "المحطة",
        "bind_title" to "ربط هذا الهاتف",
        "bind_subtitle" to "اكتب كود المحطة الذي أعطاك إياه المالك، أو امسح رمز QR.",
        "station_code" to "كود المحطة",
        "continue" to "متابعة",
        "welcome_back" to "مرحبًا بعودتك",
        "signin_subtitle" to "سجّل الدخول لبدء يومك في المحطة.",
        "username" to "اسم المستخدم",
        "password" to "كلمة المرور",
        "forgot_password" to "نسيت كلمة المرور؟",
        "sign_in" to "تسجيل الدخول",
        "or" to "أو",
        "unlock_face" to "الدخول بالوجه",
        "not_your_station" to "ليست محطتك؟",
        "change_station" to "تغيير المحطة",
        "good_morning" to "صباح الخير",
        "server" to "الخادم",
        "server_ok" to "متصل",
        "server_down" to "غير متاح",
        "active_orders" to "الطلبات النشطة",
        "jobs_done" to "أعمال اليوم",
        "ready_checkout" to "جاهز للدفع",
        "scan_plate" to "مسح اللوحة",
        "sign_out" to "تسجيل الخروج",
        "roles" to "الأدوار",
        "not_checked_in" to "لم تسجّل الحضور بعد",
        "check_in_hint" to "سجّل حضورك بالوجه في المحطة لبدء ورديتك.",
        "check_in" to "تسجيل الحضور",
        "error_network" to "تعذّر الوصول إلى الخادم. تحقق من الشبكة وتشغيل الخادم.",
    )

    fun get(key: String, language: AppLanguage): String =
        (if (language == AppLanguage.Arabic) ar[key] else en[key]) ?: en[key] ?: key
}

/** Usage inside composables: `tr("sign_in")`. */
@Composable
@ReadOnlyComposable
fun tr(key: String): String = AppStrings.get(key, LocalAppLanguage.current)

/** Inline bilingual text for UI screens: `l("Orders", "الطلبات")`. */
@Composable
@ReadOnlyComposable
fun l(en: String, ar: String): String = if (LocalAppLanguage.current == AppLanguage.Arabic) ar else en
