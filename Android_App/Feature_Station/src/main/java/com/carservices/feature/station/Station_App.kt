package com.carservices.feature.station

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.DocumentScanner
import androidx.compose.material.icons.outlined.Face
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Percent
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.TableView
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material.icons.outlined.Build
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.carservices.core.designsystem.FloatingNavBar
import com.carservices.core.designsystem.NavItem
import com.carservices.core.designsystem.l

/** Every station screen from the mobile spec (UI only for now). Code = the design / spec screen number. */
enum class Screen(val code: String, val en: String, val ar: String, val icon: ImageVector, val group: Group) {
    S2("S2", "Password & 2-step", "كلمة المرور والتحقق", Icons.Outlined.Lock, Group.Account),
    W7("W7", "My profile", "ملفي", Icons.Outlined.Person, Group.Account),
    CheckIn("03", "Check in", "تسجيل الحضور", Icons.Outlined.Face, Group.Day),
    CheckInOk("04", "Check-in confirmed", "تم تسجيل الحضور", Icons.Outlined.CheckCircle, Group.Day),
    CheckInRefused("05", "Check-in refused", "تم رفض الحضور", Icons.Outlined.Block, Group.Day),
    CheckOut("06", "Check-out summary", "ملخص الانصراف", Icons.Outlined.Schedule, Group.Day),
    Scan("07", "Scan plate", "مسح اللوحة", Icons.Outlined.DocumentScanner, Group.Cars),
    NewCar("08", "New car", "سيارة جديدة", Icons.Outlined.DirectionsCar, Group.Cars),
    Returning("09", "Returning car", "سيارة عائدة", Icons.Outlined.Verified, Group.Cars),
    History("10", "Car history", "سجل السيارة", Icons.Outlined.History, Group.Cars),
    Repairs("11", "Problem & repairs", "المشكلة والإصلاحات", Icons.Outlined.Build, Group.Cars),
    InProgress("12", "Order in progress", "طلب قيد التنفيذ", Icons.Outlined.Timer, Group.Cars),
    Checkout("13", "Checkout", "الدفع", Icons.AutoMirrored.Outlined.ReceiptLong, Group.Cars),
    Payment("14", "Payment & WhatsApp", "الدفع وواتساب", Icons.Outlined.Payments, Group.Cars),
    Paid("15", "Paid", "تم الدفع", Icons.Outlined.CheckCircle, Group.Cars),
    Customer("22", "Customer & car map", "العميل وخريطة السيارة", Icons.Outlined.DirectionsCar, Group.Cars),
    Dashboard("16", "Owner dashboard", "لوحة المالك", Icons.Outlined.Insights, Group.Owner),
    Attendance("17", "Attendance board", "لوحة الحضور", Icons.Outlined.Groups, Group.Owner),
    Performance("18", "Employee performance", "أداء الموظفين", Icons.Outlined.BarChart, Group.Owner),
    Finance("23", "Finance", "المالية", Icons.Outlined.AccountBalanceWallet, Group.Owner),
    Payments("24", "Payments & corrections", "المدفوعات والتصحيحات", Icons.Outlined.Payments, Group.Owner),
    Drawer("S11", "Cash drawer close", "إغلاق الخزينة", Icons.Outlined.PointOfSale, Group.Owner),
    W1("W1", "Workers", "العمال", Icons.Outlined.People, Group.Team),
    W2("W2", "Add worker", "إضافة عامل", Icons.Outlined.PersonAdd, Group.Team),
    W3("W3", "Worker profile", "ملف العامل", Icons.Outlined.Badge, Group.Team),
    W4("W4", "Face enrollment", "تسجيل الوجه", Icons.Outlined.Face, Group.Team),
    W5("W5", "Account & security", "الحساب والأمان", Icons.Outlined.ManageAccounts, Group.Team),
    W6("W6", "Deactivate worker", "إيقاف عامل", Icons.Outlined.Block, Group.Team),
    S3("S3", "Station setup", "إعداد المحطة", Icons.Outlined.Storefront, Group.Setup),
    S4("S4", "Branches & geofence", "الفروع والنطاق", Icons.Outlined.Map, Group.Setup),
    Acc19("19", "Worker account & location", "حساب وموقع العامل", Icons.Outlined.ManageAccounts, Group.Setup),
    Services("20", "Services & prices", "الخدمات والأسعار", Icons.Outlined.Tune, Group.Setup),
    Tax("21", "Tax & permissions", "الضريبة والصلاحيات", Icons.Outlined.Percent, Group.Setup),
    Roles("S12", "Custom roles", "أدوار مخصصة", Icons.Outlined.AdminPanelSettings, Group.Setup),
    Excel("25", "Excel import & export", "استيراد وتصدير Excel", Icons.Outlined.TableView, Group.System),
    Activity("26", "Activity log", "سجل النشاط", Icons.Outlined.History, Group.System),
    Notifications("S5", "Notifications", "الإشعارات", Icons.Outlined.Notifications, Group.System),
    Settings("S6", "Settings", "الإعدادات", Icons.Outlined.Settings, Group.System),
    Plan("S7", "Plan & usage", "الباقة والاستخدام", Icons.Outlined.WorkspacePremium, Group.System),
    Ai("S8", "Station AI", "ذكاء المحطة", Icons.Outlined.AutoAwesome, Group.System),
    Support("S9", "Support access", "وصول الدعم", Icons.Outlined.SupportAgent, Group.System),
    Offline("S10", "Offline & sync", "العمل دون اتصال", Icons.Outlined.CloudOff, Group.System),
}

enum class Group(val en: String, val ar: String) {
    Day("My day", "يومي"), Cars("Cars & orders", "السيارات والطلبات"), Owner("Owner & money", "المالك والمال"),
    Team("Team", "الفريق"), Setup("Station setup", "إعداد المحطة"), System("Data & system", "البيانات والنظام"), Account("My account", "حسابي"),
}

enum class Role { Worker, Owner }

private data class Key(val screen: Screen?, val tab: Int, val depth: Int)

/** Tiny back stack for the UI-only screens (real navigation graph replaces it when logic lands). */
class StationNav(val stack: SnapshotStateList<Screen>) {
    fun open(screen: Screen) { stack.add(screen) }
    fun back() { if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) }
    fun replace(screen: Screen) { back(); open(screen) }
    fun home() { stack.clear() }
}

/**
 * Signed-in shell: four tabs + the floating scan orb. Pushed screens slide in from the side
 * (mirrored automatically in Arabic). `userName` / `stationName` come from the real session.
 */
@Composable
fun StationApp(userName: String, stationName: String, onSignOut: () -> Unit) {
    val stack = remember { mutableStateListOf<Screen>() }
    val nav = remember { StationNav(stack) }
    var tab by remember { mutableIntStateOf(0) }
    var role by remember { mutableStateOf(Role.Owner) }

    BackHandler(enabled = stack.isNotEmpty() || tab != 0) { if (stack.isNotEmpty()) nav.back() else tab = 0 }

    Box(Modifier.fillMaxSize()) {
        val top = stack.lastOrNull()
        AnimatedContent(
            targetState = Key(top, tab, stack.size),
            transitionSpec = {
                when {
                    targetState.depth == initialState.depth && targetState.screen == null ->
                        fadeIn(tween(220)) togetherWith fadeOut(tween(160))
                    targetState.depth >= initialState.depth ->
                        (slideInHorizontally(tween(320)) { it / 3 } + fadeIn(tween(260))) togetherWith (slideOutHorizontally(tween(320)) { -it / 6 } + fadeOut(tween(200)))
                    else ->
                        (slideInHorizontally(tween(320)) { -it / 6 } + fadeIn(tween(260))) togetherWith (slideOutHorizontally(tween(320)) { it / 3 } + fadeOut(tween(200)))
                }
            },
            label = "screens",
        ) { (screen, currentTab, _) ->
            if (screen != null) ScreenHost(screen, nav, userName)
            else when (currentTab) {
                0 -> if (role == Role.Owner) DashboardScreen(nav, userName, stationName, isRoot = true) else WorkerHomeScreen(nav, userName, stationName)
                1 -> OrdersScreen(nav)
                2 -> CustomersScreen(nav)
                else -> MoreScreen(nav, userName, stationName, role, onRole = { role = it; tab = 0 }, onSignOut = onSignOut)
            }
        }

        AnimatedVisibility(
            visible = top == null, modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically { it } + fadeIn(), exit = slideOutVertically { it } + fadeOut(),
        ) {
            FloatingNavBar(
                items = listOf(
                    NavItem(l("Home", "الرئيسية"), Icons.Outlined.Home),
                    NavItem(l("Orders", "الطلبات"), Icons.AutoMirrored.Outlined.ReceiptLong),
                    NavItem(l("Cars", "السيارات"), Icons.Outlined.DirectionsCar),
                    NavItem(l("More", "المزيد"), Icons.Outlined.GridView),
                ),
                selected = tab, onSelect = { tab = it }, onCenter = { nav.open(Screen.Scan) }, centerLabel = l("Scan", "مسح"),
            )
        }
    }
}

@Composable
private fun ScreenHost(screen: Screen, nav: StationNav, userName: String) {
    when (screen) {
        Screen.S2 -> PasswordScreen(nav)
        Screen.W7 -> MyProfileScreen(nav, userName)
        Screen.CheckIn -> CheckInScreen(nav)
        Screen.CheckInOk -> CheckInResultScreen(nav, ok = true)
        Screen.CheckInRefused -> CheckInResultScreen(nav, ok = false)
        Screen.CheckOut -> CheckOutScreen(nav)
        Screen.Scan -> ScanPlateScreen(nav)
        Screen.NewCar -> NewCarScreen(nav)
        Screen.Returning -> ReturningCarScreen(nav)
        Screen.History -> HistoryScreen(nav)
        Screen.Repairs -> RepairsScreen(nav)
        Screen.InProgress -> InProgressScreen(nav)
        Screen.Checkout -> CheckoutScreen(nav)
        Screen.Payment -> PaymentScreen(nav)
        Screen.Paid -> PaidScreen(nav)
        Screen.Customer -> CustomerProfileScreen(nav)
        Screen.Dashboard -> DashboardScreen(nav, userName, "", isRoot = false)
        Screen.Attendance -> AttendanceBoardScreen(nav)
        Screen.Performance -> PerformanceScreen(nav)
        Screen.Finance -> FinanceScreen(nav)
        Screen.Payments -> PaymentsScreen(nav)
        Screen.Drawer -> CashDrawerScreen(nav)
        Screen.W1 -> WorkersScreen(nav)
        Screen.W2 -> AddWorkerScreen(nav)
        Screen.W3 -> WorkerProfileScreen(nav)
        Screen.W4 -> FaceEnrollScreen(nav)
        Screen.W5 -> AccountSecurityScreen(nav)
        Screen.W6 -> DeactivateScreen(nav)
        Screen.S3 -> SetupWizardScreen(nav)
        Screen.S4 -> BranchesScreen(nav)
        Screen.Acc19 -> WorkerAccountScreen(nav)
        Screen.Services -> ServicesScreen(nav)
        Screen.Tax -> TaxPermissionsScreen(nav)
        Screen.Roles -> RolesScreen(nav)
        Screen.Excel -> ExcelScreen(nav)
        Screen.Activity -> ActivityScreen(nav)
        Screen.Notifications -> NotificationsScreen(nav)
        Screen.Settings -> SettingsScreen(nav)
        Screen.Plan -> PlanScreen(nav)
        Screen.Ai -> AiScreen(nav)
        Screen.Support -> SupportScreen(nav)
        Screen.Offline -> OfflineScreen(nav)
    }
}

/** Title helper for a screen. */
@Composable
fun Screen.title(): String = l(en, ar)

