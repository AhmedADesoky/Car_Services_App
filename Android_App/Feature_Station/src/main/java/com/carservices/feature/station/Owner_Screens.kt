package com.carservices.feature.station

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Money
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Percent
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carservices.core.designsystem.Avatar
import com.carservices.core.designsystem.BarChart
import com.carservices.core.designsystem.BigNumber
import com.carservices.core.designsystem.CarButton
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarDropdown
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.CarRow
import com.carservices.core.designsystem.FloatingActionBar
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.GlassIconButton
import com.carservices.core.designsystem.HairDivider
import com.carservices.core.designsystem.KeyValue
import com.carservices.core.designsystem.MeterBar
import com.carservices.core.designsystem.NavyCard
import com.carservices.core.designsystem.PillTabs
import com.carservices.core.designsystem.RingProgress
import com.carservices.core.designsystem.SectionTitle
import com.carservices.core.designsystem.SegmentedTabs
import com.carservices.core.designsystem.SoftField
import com.carservices.core.designsystem.Sparkline
import com.carservices.core.designsystem.StatTile
import com.carservices.core.designsystem.StatusPill
import com.carservices.core.designsystem.l

/* ========================================================================== 16 owner dashboard */

@Composable
fun DashboardScreen(nav: StationNav, userName: String, stationName: String, isRoot: Boolean) {
    var range by remember { mutableIntStateOf(1) }
    var branch by remember { mutableStateOf<String?>(null) }
    CarPage(
        title = if (isRoot) listOf(l("Hello", "أهلاً"), userName.substringBefore(' ')).filter { it.isNotBlank() }.joinToString(", ") else Screen.Dashboard.title(),
        subtitle = if (isRoot) stationName.ifBlank { l("Owner dashboard", "لوحة المالك") } else null,
        onBack = if (isRoot) null else nav::back,
        actions = { GlassIconButton(Icons.Outlined.Notifications, l("Notifications", "الإشعارات"), { nav.open(Screen.Notifications) }, badge = true) },
    ) {
        item { SegmentedTabs(listOf(l("Today", "اليوم"), l("Week", "الأسبوع"), l("Month", "الشهر")), range, { range = it }) }
        item {
            NavyCard(onClick = { nav.open(Screen.Finance) }) {
                Text(l("Revenue this week", "إيراد هذا الأسبوع"), color = CarColors.TealGlow, style = MaterialTheme.typography.labelMedium)
                Row(verticalAlignment = Alignment.Bottom) {
                    BigNumber(money(4_850_000), Color.White, 32)
                    Spacer(Modifier.width(10.dp))
                    Text("+12.4%", color = CarColors.Amber, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 6.dp))
                }
                Spacer(Modifier.height(6.dp))
                Sparkline(Mock.trend, color = CarColors.TealGlow)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile("128", l("Cars served", "سيارات"), Icons.Outlined.DirectionsCar, Modifier.weight(1f), delta = "+9%")
                StatTile(money(37_900), l("Avg bill", "متوسط الفاتورة"), Icons.AutoMirrored.Outlined.ReceiptLong, Modifier.weight(1f), delta = "+4%")
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile("14/16", l("On site now", "في المحطة الآن"), Icons.Outlined.Groups, Modifier.weight(1f).let { it }, accent = CarColors.Teal)
                StatTile("27 ${l("min", "د")}", l("Avg job time", "متوسط وقت العمل"), Icons.Outlined.Timer, Modifier.weight(1f), accent = CarColors.Amber, delta = "-3%")
            }
        }
        item { CarDropdown(l("Branch", "الفرع"), listOf(l("All branches", "كل الفروع"), l("Shuwaikh", "الشويخ"), l("Salmiya", "السالمية")), branch ?: l("All branches", "كل الفروع"), { branch = it }, { it }) }
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(l("Daily revenue", "الإيراد اليومي"), style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk, modifier = Modifier.weight(1f))
                    Text(l("hundred KWD", "مئة د.ك"), style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary)
                }
                Spacer(Modifier.height(10.dp))
                BarChart(Mock.weekRevenue, if (isAr()) Mock.weekDaysAr else Mock.weekDays, highlight = 5)
            }
        }
        item { SectionTitle(l("Top services", "أكثر الخدمات")) }
        item {
            GlassCard {
                listOf(Triple(l("Oil change", "تغيير زيت"), 0.82f, 46), Triple(l("Full wash", "غسيل كامل"), 0.64f, 38), Triple(l("Brake pads", "فحمات فرامل"), 0.41f, 19), Triple(l("AC recharge", "شحن تكييف"), 0.27f, 11)).forEach { (name, p, n) ->
                    Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(name, color = CarColors.NavyInk, modifier = Modifier.width(110.dp), maxLines = 1)
                        MeterBar(p, Modifier.weight(1f))
                        Text("$n", color = CarColors.TextSecondary, modifier = Modifier.padding(start = 10.dp).width(28.dp), fontSize = 13.sp)
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf(Screen.Attendance, Screen.Performance, Screen.Drawer).forEach { s ->
                    GlassCard(Modifier.weight(1f), onClick = { nav.open(s) }, padding = 14.dp) {
                        com.carservices.core.designsystem.Glyph(s.icon, size = 36.dp)
                        Spacer(Modifier.height(8.dp))
                        Text(s.title(), style = MaterialTheme.typography.labelMedium, color = CarColors.NavyInk, maxLines = 2)
                    }
                }
            }
        }
    }
}

/* ======================================================================== 17 attendance board */

@Composable
fun AttendanceBoardScreen(nav: StationNav) {
    var filter by remember { mutableIntStateOf(0) }
    CarPage(title = Screen.Attendance.title(), subtitle = l("Today · Shuwaikh", "اليوم · الشويخ"), onBack = nav::back) {
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RingProgress(14 / 16f, size = 90.dp) { Text("14/16", fontWeight = FontWeight.ExtraBold, color = CarColors.Navy) }
                    Spacer(Modifier.width(16.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        StatusPill("12 ${l("on time", "في الموعد")}", CarColors.Teal)
                        StatusPill("2 ${l("late", "متأخر")}", CarColors.Amber)
                        StatusPill("2 ${l("absent", "غائب")}", CarColors.Orange)
                    }
                }
            }
        }
        item { PillTabs(listOf(l("Everyone", "الكل"), l("On site", "في المحطة"), l("Late", "متأخر"), l("Off", "إجازة")), filter, { filter = it }) }
        items(Mock.workers.filter { filter == 0 || it.status.ordinal == filter - 1 }) { w ->
            GlassCard(padding = 10.dp) {
                CarRow(w.name, "${l(w.role, w.roleAr)} · ${if (w.status == WorkerStatus.OnSite) "08:5${w.jobs % 10}" else "—"}", avatar = w.name, onClick = { nav.open(Screen.W3) }) { StatusPill(l(w.status.en, w.status.ar), w.status.color) }
            }
        }
    }
}

/* ========================================================================== 18 performance */

@Composable
fun PerformanceScreen(nav: StationNav) {
    var range by remember { mutableIntStateOf(1) }
    CarPage(title = Screen.Performance.title(), onBack = nav::back) {
        item { SegmentedTabs(listOf(l("Week", "أسبوع"), l("Month", "شهر"), l("Quarter", "ربع سنة")), range, { range = it }) }
        items(Mock.workers.filter { it.status != WorkerStatus.Suspended }.sortedByDescending { it.rating }) { w ->
            GlassCard(onClick = { nav.open(Screen.W3) }, padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(w.name)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) { Text(w.name, style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk); Text(l(w.role, w.roleAr), color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium) }
                    Text("${w.rating} ★", color = CarColors.Amber, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${w.jobs * 19} ${l("jobs", "عمل")}", style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary, modifier = Modifier.width(80.dp))
                    MeterBar(w.rating / 5f, Modifier.weight(1f))
                }
            }
        }
    }
}

/* ============================================================================ 23 finance */

@Composable
fun FinanceScreen(nav: StationNav) {
    CarPage(title = Screen.Finance.title(), subtitle = l("November 2026", "نوفمبر ٢٠٢٦"), onBack = nav::back) {
        item {
            NavyCard {
                Text(l("Net revenue", "صافي الإيراد"), color = CarColors.TealGlow, style = MaterialTheme.typography.labelMedium)
                BigNumber(money(18_400_000), Color.White, 32)
                Spacer(Modifier.height(10.dp))
                Row { FinanceMini(l("Cash", "نقدي"), money(6_200_000), Modifier.weight(1f)); FinanceMini(l("KNET & card", "كي نت وبطاقة"), money(12_200_000), Modifier.weight(1f)) }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile("66%", l("Paid by KNET", "مدفوع بـ كي نت"), Icons.Outlined.CreditCard, Modifier.weight(1f))
                StatTile(money(125_000), l("Refunds", "مرتجعات"), Icons.AutoMirrored.Outlined.Undo, Modifier.weight(1f), accent = CarColors.Orange)
            }
        }
        item { GlassCard { Text(l("Revenue trend", "اتجاه الإيراد"), style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk); Spacer(Modifier.height(10.dp)); Sparkline(Mock.trend) } }
        item {
            GlassCard(padding = 8.dp) {
                CarRow(Screen.Payments.title(), l("38 today · 1 refund", "٣٨ اليوم · مرتجع واحد"), icon = Icons.Outlined.CreditCard, onClick = { nav.open(Screen.Payments) })
                CarRow(Screen.Drawer.title(), l("Not closed yet today", "لم تُغلق اليوم بعد"), icon = Icons.Outlined.AccountBalanceWallet, onClick = { nav.open(Screen.Drawer) })
                CarRow(l("Export for accountant", "تصدير للمحاسب"), "Excel · PDF", icon = Icons.Outlined.TrendingUp, onClick = { nav.open(Screen.Excel) })
            }
        }
    }
}

@Composable
private fun FinanceMini(label: String, value: String, modifier: Modifier) = Column(modifier) {
    Text(label, color = Color.White.copy(alpha = 0.6f), style = MaterialTheme.typography.labelMedium)
    Text(value, color = Color.White, fontWeight = FontWeight.Bold)
}

/* ================================================================= 24 payments & corrections */

@Composable
fun PaymentsScreen(nav: StationNav) {
    var filter by remember { mutableIntStateOf(0) }
    CarPage(title = Screen.Payments.title(), onBack = nav::back) {
        item { PillTabs(listOf(l("All", "الكل"), l("Cash", "نقدي"), l("KNET", "كي نت"), l("Card", "بطاقة"), l("Refunds", "مرتجعات")), filter, { filter = it }) }
        items(Mock.orders) { o ->
            GlassCard(padding = 10.dp) {
                CarRow("#INV-${o.number}", "${o.customer} · 10:4${o.minutes % 10}", icon = if (o.total > 15000) Icons.Outlined.CreditCard else Icons.Outlined.Money, onClick = {}) {
                    Column(horizontalAlignment = Alignment.End) {
                        Text(money(o.total), fontWeight = FontWeight.Bold, color = CarColors.Navy)
                        Text(if (o.total > 15000) l("KNET", "كي نت") else l("Cash", "نقدي"), style = MaterialTheme.typography.labelMedium, color = CarColors.TextSecondary)
                    }
                }
            }
        }
        item {
            GlassCard(padding = 10.dp) {
                CarRow("#INV-A-1031", l("Refund · wrong service charged", "مرتجع · خدمة خاطئة"), icon = Icons.AutoMirrored.Outlined.Undo) { Text("-" + money(12_000), color = CarColors.Orange, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

/* ========================================================================= S11 cash drawer */

@Composable
fun CashDrawerScreen(nav: StationNav) {
    var counted by remember { mutableStateOf("548.500") }
    CarPage(title = Screen.Drawer.title(), subtitle = l("Today · Shuwaikh", "اليوم · الشويخ"), onBack = nav::back,
        bottomBar = { FloatingActionBar { CarButton(l("Close the drawer", "إغلاق الخزينة"), { nav.back() }, icon = Icons.Outlined.Lock) } }) {
        item {
            GlassCard {
                KeyValue(l("Opening float", "رصيد الافتتاح"), money(30_000))
                KeyValue(l("Cash sales", "مبيعات نقدية"), money(532_000))
                KeyValue(l("Cash refunds", "مرتجعات نقدية"), "-" + money(12_000))
                HairDivider()
                KeyValue(l("Expected in drawer", "المتوقع في الخزينة"), money(550_000), strong = true)
            }
        }
        item { SoftField(l("Counted cash", "النقد المعدود"), counted, { counted = it }, icon = Icons.Outlined.Money) }
        item {
            GlassCard(padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(l("Difference", "الفرق"), color = CarColors.TextSecondary, modifier = Modifier.weight(1f))
                    Text("-" + money(1_500), color = CarColors.Orange, fontWeight = FontWeight.ExtraBold)
                }
                Text(l("A note is required for differences over 1 KWD.", "يلزم كتابة ملاحظة للفروق أكبر من ١ د.ك."), style = MaterialTheme.typography.bodyMedium, color = CarColors.TextSecondary)
            }
        }
        item { SoftField(l("Note", "ملاحظة"), "", {}, placeholder = l("e.g. change given to customer", "مثال: فكة للعميل"), singleLine = false) }
    }
}

