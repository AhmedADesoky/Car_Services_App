package com.carservices.feature.station

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Face
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carservices.core.designsystem.AppLanguage
import com.carservices.core.designsystem.Avatar
import com.carservices.core.designsystem.CarButton
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.CarRow
import com.carservices.core.designsystem.KuwaitPlate
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.GlassIconButton
import com.carservices.core.designsystem.Glyph
import com.carservices.core.designsystem.LiveDot
import com.carservices.core.designsystem.LocalAppLanguage
import com.carservices.core.designsystem.NavyCard
import com.carservices.core.designsystem.PillTabs
import com.carservices.core.designsystem.RingProgress
import com.carservices.core.designsystem.SectionTitle
import com.carservices.core.designsystem.SegmentedTabs
import com.carservices.core.designsystem.SoftField
import com.carservices.core.designsystem.StatTile
import com.carservices.core.designsystem.StatusPill
import com.carservices.core.designsystem.l

@Composable @ReadOnlyComposable
fun isAr() = LocalAppLanguage.current == AppLanguage.Arabic

@Composable @ReadOnlyComposable
fun money(fils: Int) = kwd(fils, isAr())

/* ===================================================================================== 02 home */

@Composable
fun WorkerHomeScreen(nav: StationNav, userName: String, stationName: String) {
    CarPage(
        title = listOf(l("Good morning", "صباح الخير"), userName.substringBefore(' ')).filter { it.isNotBlank() }.joinToString(", "),
        subtitle = stationName.ifBlank { l("Your station", "محطتك") },
        actions = { GlassIconButton(Icons.Outlined.Notifications, l("Notifications", "الإشعارات"), { nav.open(Screen.Notifications) }, badge = true) },
    ) {
        item { ShiftCard(onCheckIn = { nav.open(Screen.CheckIn) }) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile("3", l("Active orders", "طلبات نشطة"), Icons.Outlined.Timer, Modifier.weight(1f))
                StatTile("7", l("Jobs today", "أعمال اليوم"), Icons.Outlined.CheckCircle, Modifier.weight(1f), delta = "+2")
                StatTile("1", l("To pay", "للدفع"), Icons.Outlined.DirectionsCar, Modifier.weight(1f), accent = CarColors.Orange)
            }
        }
        item {
            var mine by remember { mutableIntStateOf(0) }
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionTitle(l("Active orders", "الطلبات النشطة"), action = l("See all", "عرض الكل"))
                SegmentedTabs(listOf(l("Mine", "طلباتي"), l("All branch", "كل الفرع")), mine, { mine = it })
            }
        }
        items(Mock.orders.filter { it.stage != OrderStage.Paid }.take(3)) { OrderCard(it) { nav.open(if (it.stage == OrderStage.Ready) Screen.Checkout else Screen.InProgress) } }
    }
}

@Composable
fun OrderCard(order: MockOrder, onClick: () -> Unit) {
    GlassCard(onClick = onClick, padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            KuwaitPlate(order.plateCode, order.plateNumber, scale = 0.5f)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(order.car, style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk, maxLines = 1)
                Text(order.services, style = MaterialTheme.typography.bodyMedium, color = CarColors.TextSecondary, maxLines = 1)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            StatusPill(l(order.stage.en, order.stage.ar), order.stage.color)
            Spacer(Modifier.width(8.dp))
            if (order.minutes > 0 && order.stage == OrderStage.Working) {
                Icon(Icons.Outlined.Timer, null, tint = CarColors.TextSecondary, modifier = Modifier.size(14.dp))
                Text(" ${order.minutes} ${l("min", "د")}", style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary)
            }
            Spacer(Modifier.weight(1f))
            Text(money(order.total), style = MaterialTheme.typography.titleMedium, color = CarColors.Navy)
        }
    }
}

/** Worker's shift card: light glass, matches the rest of the app. Status, face badge, shift timeline, one clear action. */
@Composable
fun ShiftCard(onCheckIn: () -> Unit) {
    val spin = rememberInfiniteTransition(label = "badge")
    val angle by spin.animateFloat(0f, 360f, infiniteRepeatable(tween(3200, easing = LinearEasing)), label = "angle")
    GlassCard(padding = 0.dp, onClick = onCheckIn) {
        // thin brand accent along the top edge
        Box(Modifier.fillMaxWidth().height(3.dp).background(Brush.horizontalGradient(listOf(CarColors.Teal, CarColors.TealGlow, CarColors.Amber))))
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        LiveDot(CarColors.Amber); Spacer(Modifier.width(8.dp))
                        Text(l("Not checked in yet", "لم تسجّل الحضور بعد"), color = Color(0xFFB7791F), style = MaterialTheme.typography.labelMedium)
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(l("Morning shift", "الوردية الصباحية"), style = MaterialTheme.typography.headlineSmall, color = CarColors.Navy)
                    Spacer(Modifier.height(6.dp))
                    StatusPill(l("Shuwaikh · inside · 40 m", "الشويخ · داخل النطاق · ٤٠ م"), CarColors.Teal)
                }
                // face badge with an orbiting scan arc
                Box(Modifier.size(70.dp), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.fillMaxSize()) {
                        drawCircle(CarColors.Navy.copy(alpha = 0.07f), style = Stroke(1.dp.toPx()))
                        rotate(angle) {
                            drawArc(Brush.sweepGradient(listOf(Color.Transparent, CarColors.Teal.copy(alpha = 0.9f), Color.Transparent)), 0f, 110f, false, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
                        }
                    }
                    Box(Modifier.size(50.dp).clip(CircleShape).background(Brush.radialGradient(listOf(CarColors.TealLight, Color.White))), contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Face, null, tint = CarColors.Navy, modifier = Modifier.size(26.dp))
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            ShiftTimeline()
            Spacer(Modifier.height(16.dp))
            CarButton(l("Check in with my face", "سجّل الحضور بوجهك"), onCheckIn, icon = Icons.Outlined.Face)
        }
    }
}

/** 09:00 ──●───── 17:00 with the "now" marker and how long until the shift starts. */
@Composable
private fun ShiftTimeline() {
    val pulse = rememberInfiniteTransition(label = "now")
    val r by pulse.animateFloat(1f, 1.8f, infiniteRepeatable(tween(1200), RepeatMode.Restart), label = "r")
    val a by pulse.animateFloat(0.5f, 0f, infiniteRepeatable(tween(1200), RepeatMode.Restart), label = "a")
    Column {
        Row(Modifier.fillMaxWidth()) {
            Text("09:00", style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary)
            Spacer(Modifier.weight(1f))
            Text(l("Starts in 8 min", "تبدأ بعد ٨ دقائق"), style = MaterialTheme.typography.labelMedium, color = CarColors.Teal)
            Spacer(Modifier.weight(1f))
            Text("17:00", style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary)
        }
        Spacer(Modifier.height(8.dp))
        Canvas(Modifier.fillMaxWidth().height(14.dp)) {
            val y = size.height / 2
            val track = 6.dp.toPx()
            drawLine(CarColors.Navy.copy(alpha = 0.07f), Offset(0f, y), Offset(size.width, y), track, StrokeCap.Round)
            // hour ticks
            for (h in 1 until 8) { val x = size.width * h / 8f; drawCircle(CarColors.Navy.copy(alpha = 0.18f), 1.6.dp.toPx(), Offset(x, y)) }
            // "now" marker just before the start
            val now = Offset(size.width * 0.02f + 4.dp.toPx(), y)
            drawCircle(CarColors.Amber.copy(alpha = a), 6.dp.toPx() * r, now)
            drawCircle(Color.White, 6.dp.toPx(), now)
            drawCircle(CarColors.Amber, 4.dp.toPx(), now)
        }
    }
}

/* ================================================================================== orders tab */

@Composable
fun OrdersScreen(nav: StationNav) {
    var filter by remember { mutableIntStateOf(0) }
    val stages = listOf(null, OrderStage.Working, OrderStage.Ready, OrderStage.Waiting, OrderStage.Paid)
    CarPage(title = l("Orders", "الطلبات"), subtitle = l("Today · 5 cars", "اليوم · ٥ سيارات"), actions = { GlassIconButton(Icons.Outlined.Search, l("Search", "بحث"), {}) }) {
        item { PillTabs(listOf(l("All", "الكل"), l("In progress", "قيد التنفيذ"), l("Ready", "جاهز"), l("Waiting", "انتظار"), l("Paid", "مدفوع")), filter, { filter = it }) }
        items(Mock.orders.filter { stages[filter] == null || it.stage == stages[filter] }) { o ->
            OrderCard(o) { nav.open(when (o.stage) { OrderStage.Ready -> Screen.Checkout; OrderStage.Paid -> Screen.Paid; else -> Screen.InProgress }) }
        }
    }
}

/* =============================================================================== customers tab */

@Composable
fun CustomersScreen(nav: StationNav) {
    var query by remember { mutableStateOf("") }
    CarPage(title = l("Cars & customers", "السيارات والعملاء"), subtitle = l("1,284 customers", "١٬٢٨٤ عميل")) {
        item { SoftField(l("Search", "بحث"), query, { query = it }, icon = Icons.Outlined.Search, placeholder = l("Name, phone or plate", "الاسم أو الهاتف أو اللوحة")) }
        items(Mock.customers.filter { query.isBlank() || it.name.contains(query, true) || it.phone.contains(query) }) { c ->
            GlassCard(onClick = { nav.open(Screen.Customer) }, padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(c.name)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(c.name, style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk)
                        Text("${c.car} · ${c.visits} ${l("visits", "زيارة")}", style = MaterialTheme.typography.bodyMedium, color = CarColors.TextSecondary)
                    }
                    KuwaitPlate(c.plateCode, c.plateNumber, scale = 0.42f)
                }
            }
        }
    }
}

/* ==================================================================================== more tab */

@Composable
fun MoreScreen(nav: StationNav, userName: String, stationName: String, role: Role, onRole: (Role) -> Unit, onSignOut: () -> Unit) {
    CarPage(title = l("More", "المزيد"), subtitle = stationName.ifBlank { null }) {
        item {
            GlassCard(onClick = { nav.open(Screen.W7) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(userName.ifBlank { "Me" }, size = 54.dp)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(userName, style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk)
                        Text(l("View my profile", "عرض ملفي"), style = MaterialTheme.typography.bodyMedium, color = CarColors.Teal)
                    }
                    RingProgress(0.62f, size = 46.dp, stroke = 4.dp) { Text("62%", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = CarColors.Navy) }
                }
            }
        }
        item {
            GlassCard(padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Glyph(Icons.Outlined.SwapHoriz, size = 36.dp)
                    Spacer(Modifier.width(10.dp))
                    Text(l("Preview the app as", "معاينة التطبيق كـ"), style = MaterialTheme.typography.bodyMedium, color = CarColors.TextSecondary, modifier = Modifier.weight(1f))
                }
                Spacer(Modifier.height(10.dp))
                SegmentedTabs(listOf(l("Worker", "عامل"), l("Owner", "مالك")), role.ordinal, { onRole(Role.entries[it]) })
            }
        }
        Group.entries.forEach { group ->
            item { SectionTitle(l(group.en, group.ar)) }
            item {
                GlassCard(padding = 8.dp) {
                    Screen.entries.filter { it.group == group }.forEach { s ->
                        CarRow(s.title(), subtitle = s.code, icon = s.icon, onClick = { nav.open(s) })
                    }
                }
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).border(1.dp, CarColors.Orange.copy(alpha = 0.3f), RoundedCornerShape(18.dp)).padding(vertical = 2.dp),
                horizontalArrangement = Arrangement.Center,
            ) { CarRow(l("Sign out", "تسجيل الخروج"), icon = Icons.AutoMirrored.Outlined.Logout, onClick = onSignOut) {} }
        }
        item { Text("GarageOS · v0.1.0", style = MaterialTheme.typography.labelMedium, color = CarColors.Outline, modifier = Modifier.fillMaxWidth().padding(8.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
    }
}

/* small shared bits used by several files */

@Composable
fun InfoLine(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, color: Color = CarColors.TextSecondary) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 3.dp)) {
        Icon(icon, null, tint = color, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(8.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = color)
    }
}

@Composable
fun Dot(color: Color) = Box(Modifier.size(8.dp).background(color, CircleShape))

