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
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Face
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Login
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.TableView
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material.icons.outlined.WarningAmber
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
import com.carservices.core.designsystem.BigNumber
import com.carservices.core.designsystem.CarButton
import com.carservices.core.designsystem.CarColors
import com.carservices.core.designsystem.CarDropdown
import com.carservices.core.designsystem.CarPage
import com.carservices.core.designsystem.CarRow
import com.carservices.core.designsystem.FloatingActionBar
import com.carservices.core.designsystem.GhostButton
import com.carservices.core.designsystem.GlassCard
import com.carservices.core.designsystem.Glyph
import com.carservices.core.designsystem.KeyValue
import com.carservices.core.designsystem.LiveDot
import com.carservices.core.designsystem.MeterBar
import com.carservices.core.designsystem.NavyCard
import com.carservices.core.designsystem.PillTabs
import com.carservices.core.designsystem.RingProgress
import com.carservices.core.designsystem.SectionTitle
import com.carservices.core.designsystem.SegmentedTabs
import com.carservices.core.designsystem.Sparkline
import com.carservices.core.designsystem.StatusPill
import com.carservices.core.designsystem.ToggleRow
import com.carservices.core.designsystem.l

/* ====================================================================== 25 Excel import/export */

@Composable
fun ExcelScreen(nav: StationNav) {
    var mode by remember { mutableIntStateOf(0) }
    var what by remember { mutableStateOf<String?>("Customers") }
    CarPage(title = Screen.Excel.title(), onBack = nav::back,
        bottomBar = { FloatingActionBar { CarButton(if (mode == 0) l("Confirm import", "تأكيد الاستيراد") else l("Download file", "تنزيل الملف"), { nav.back() }, icon = if (mode == 0) Icons.Outlined.UploadFile else Icons.Outlined.Download) } }) {
        item { SegmentedTabs(listOf(l("Import", "استيراد"), l("Export", "تصدير")), mode, { mode = it }) }
        item { CarDropdown(l("Data", "البيانات"), listOf("Customers", "Price list", "Workers", "Payments", "Orders"), what, { what = it }, { it }, icon = Icons.Outlined.TableView) }
        if (mode == 0) {
            item {
                GlassCard {
                    CarRow("customers_nov.xlsx", l("412 rows · 38 KB", "٤١٢ صف · ٣٨ ك.ب"), icon = Icons.Outlined.TableView)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatusPill(l("398 new", "٣٩٨ جديد"), CarColors.Teal); StatusPill(l("11 updates", "١١ تحديث"), CarColors.Navy); StatusPill(l("3 errors", "٣ أخطاء"), CarColors.Orange)
                    }
                }
            }
            item { SectionTitle(l("Rows with errors", "صفوف بها أخطاء")) }
            items(listOf("Row 18 · phone missing" to "الصف ١٨ · الهاتف مفقود", "Row 92 · plate format" to "الصف ٩٢ · صيغة اللوحة", "Row 310 · duplicate phone" to "الصف ٣١٠ · هاتف مكرر")) { (en, ar) ->
                GlassCard(padding = 8.dp) { CarRow(l(en, ar), icon = Icons.Outlined.WarningAmber, onClick = {}) }
            }
            item { Text(l("You can undo an import within 24 hours.", "يمكنك التراجع عن الاستيراد خلال ٢٤ ساعة."), color = CarColors.TextSecondary) }
        } else {
            item { GlassCard(padding = 8.dp) { ToggleRow(l("Include archived", "تضمين المؤرشف"), initial = false); ToggleRow(l("Arabic column names", "أسماء أعمدة عربية")) } }
            item { GlassCard(padding = 8.dp) { CarRow(l("Last export", "آخر تصدير"), l("Payments · yesterday by you", "المدفوعات · أمس بواسطتك"), icon = Icons.Outlined.Download) } }
        }
    }
}

/* ========================================================================== 26 activity log */

@Composable
fun ActivityScreen(nav: StationNav) {
    var filter by remember { mutableIntStateOf(0) }
    data class Entry(val en: String, val ar: String, val who: String, val time: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)
    val entries = listOf(
        Entry("Price changed: Oil change 12.000 → 12.500 KWD", "تغيير سعر: تغيير زيت ١٢٫٠٠٠ ← ١٢٫٥٠٠ د.ك", "You", "10:42", Icons.Outlined.Edit),
        Entry("Refund 12.000 KWD on #A-1031", "مرتجع ١٢٫٠٠٠ د.ك على #A-1031", "Youssef N.", "10:15", Icons.AutoMirrored.Outlined.Undo),
        Entry("Worker suspended: Ahmed Reda", "إيقاف عامل: أحمد رضا", "You", "09:30", Icons.Outlined.People),
        Entry("Sign in from new phone", "دخول من هاتف جديد", "Karim A.", "08:51", Icons.Outlined.Login),
        Entry("Face re-enrolled", "إعادة تسجيل وجه", "Omar F.", "Yesterday", Icons.Outlined.Face),
    )
    CarPage(title = Screen.Activity.title(), onBack = nav::back) {
        item { PillTabs(listOf(l("All", "الكل"), l("Money", "المال"), l("Team", "الفريق"), l("Sign-ins", "الدخول")), filter, { filter = it }) }
        items(entries) { e -> GlassCard(padding = 8.dp) { CarRow(l(e.en, e.ar), "${e.who} · ${e.time}", icon = e.icon) } }
    }
}

/* ========================================================================= S5 notifications */

@Composable
fun NotificationsScreen(nav: StationNav) {
    val notes = listOf(
            Triple(Icons.Outlined.DirectionsCar, l("Car ready to pay · Kia Sportage", "سيارة جاهزة للدفع · كيا سبورتاج"), "2 min"),
            Triple(Icons.Outlined.Schedule, l("Omar Fathy checked in late (09:07)", "عمر فتحي سجل حضور متأخر (٠٩:٠٧)"), "1 h"),
            Triple(Icons.AutoMirrored.Outlined.Chat, l("WhatsApp receipt failed · retrying", "فشل إيصال واتساب · إعادة المحاولة"), "2 h"),
            Triple(Icons.Outlined.Payments, l("Cash drawer not closed yesterday", "لم تُغلق الخزينة أمس"), "8 h"),
    )
    CarPage(title = Screen.Notifications.title(), onBack = nav::back) {
        item { SectionTitle(l("Today", "اليوم"), action = l("Mark all read", "تعليم الكل كمقروء")) }
        items(notes) { (icon, text, time) -> GlassCard(padding = 8.dp) { CarRow(text, time, icon = icon, onClick = {}) } }
    }
}

/* ============================================================================== S6 settings */

@Composable
fun SettingsScreen(nav: StationNav) {
    var lang by remember { mutableStateOf<String?>("English") }
    CarPage(title = Screen.Settings.title(), onBack = nav::back) {
        item { CarDropdown(l("App language", "لغة التطبيق"), listOf("English", "العربية"), lang, { lang = it }, { it }, icon = Icons.Outlined.Language) }
        item { SectionTitle(l("Receipts", "الإيصالات")) }
        item { GlassCard(padding = 8.dp) { ToggleRow(l("Logo on receipts", "الشعار على الإيصالات"), icon = Icons.AutoMirrored.Outlined.ReceiptLong); ToggleRow(l("Ask for rating after payment", "طلب تقييم بعد الدفع"), icon = Icons.Outlined.Tune) } }
        item { SectionTitle(l("Connections", "الاتصالات")) }
        item {
            GlassCard(padding = 8.dp) {
                CarRow("WhatsApp Business", "+965 2245 1234", icon = Icons.AutoMirrored.Outlined.Chat) { StatusPill(l("Connected", "متصل"), CarColors.Teal) }
                CarRow(l("KNET terminal", "جهاز كي نت"), l("Manual reference", "مرجع يدوي"), icon = Icons.Outlined.CreditCard) { StatusPill(l("Manual", "يدوي"), CarColors.Amber) }
            }
        }
        item { GlassCard(padding = 8.dp) { CarRow(Screen.Support.title(), l("Off", "متوقف"), icon = Icons.Outlined.SupportAgent, onClick = { nav.open(Screen.Support) }); CarRow(Screen.Offline.title(), l("All synced", "تمت المزامنة"), icon = Icons.Outlined.CloudDone, onClick = { nav.open(Screen.Offline) }) } }
    }
}

/* ========================================================================== S7 plan & usage */

@Composable
fun PlanScreen(nav: StationNav) {
    CarPage(title = Screen.Plan.title(), onBack = nav::back) {
        item {
            NavyCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(l("Current plan", "الباقة الحالية"), color = CarColors.TealGlow, style = MaterialTheme.typography.labelMedium)
                        BigNumber("Pro", Color.White, 34)
                        Text(l("Renews 1 Dec 2026", "تتجدد ١ ديسمبر ٢٠٢٦"), color = Color.White.copy(alpha = 0.6f))
                    }
                    RingProgress(0.62f, size = 86.dp, color = CarColors.Amber, track = Color.White.copy(alpha = 0.1f)) { Text("62%", color = Color.White, fontWeight = FontWeight.Bold) }
                }
            }
        }
        item {
            GlassCard {
                UsageLine(l("Plate scans", "مسح اللوحات"), "9,310 / 15,000", 0.62f)
                UsageLine(l("Branches", "الفروع"), "2 / 5", 0.4f)
                UsageLine(l("Workers", "العمال"), "8 / 50", 0.16f)
            }
        }
        item { GhostButton(l("Talk to us about Enterprise", "تواصل معنا بخصوص Enterprise"), {}, Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun UsageLine(label: String, value: String, p: Float) {
    Column(Modifier.padding(vertical = 8.dp)) {
        Row { Text(label, color = CarColors.NavyInk, modifier = Modifier.weight(1f)); Text(value, color = CarColors.TextSecondary, style = MaterialTheme.typography.labelMedium) }
        Spacer(Modifier.height(6.dp)); MeterBar(p, color = if (p > 0.85f) CarColors.Orange else CarColors.Teal)
    }
}

/* ============================================================================== S8 station AI */

@Composable
fun AiScreen(nav: StationNav) {
    CarPage(title = Screen.Ai.title(), onBack = nav::back) {
        item {
            NavyCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Glyph(Icons.Outlined.AutoAwesome, size = 52.dp, dark = true, active = true)
                    Spacer(Modifier.width(14.dp))
                    Column { Text(l("Your plate model", "نموذج اللوحات الخاص بك"), color = Color.White, style = MaterialTheme.typography.titleMedium); Text("v3 · 96.8% ${l("exact match", "تطابق تام")}", color = CarColors.TealGlow) }
                }
                Spacer(Modifier.height(10.dp))
                Sparkline(listOf(91f, 92.5f, 93f, 94.2f, 95.1f, 96.8f), color = CarColors.Amber)
            }
        }
        item {
            GlassCard {
                KeyValue(l("Corrections collected", "تصحيحات مجمعة"), "214 / 300")
                MeterBar(214 / 300f)
                Spacer(Modifier.height(6.dp))
                Text(l("At 300 corrections we train a new version for your station. It goes live only if it beats v3.", "عند ٣٠٠ تصحيح ندرب نسخة جديدة لمحطتك. تُفعّل فقط إذا تفوقت على v3."), color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium)
            }
        }
        item { GlassCard(padding = 8.dp) { CarRow("v3", l("Active since 2 Oct", "مفعلة منذ ٢ أكتوبر"), icon = Icons.Outlined.AutoAwesome) { StatusPill(l("Live", "مفعلة"), CarColors.Teal) }; CarRow("v2", "94.1%", icon = Icons.Outlined.AutoAwesome) { Text(l("Roll back", "رجوع"), color = CarColors.Teal) } } }
    }
}

/* =========================================================================== S9 support access */

@Composable
fun SupportScreen(nav: StationNav) {
    var hours by remember { mutableStateOf<String?>("2 hours") }
    CarPage(title = Screen.Support.title(), onBack = nav::back,
        bottomBar = { FloatingActionBar { CarButton(l("Grant access", "منح الوصول"), { nav.back() }, icon = Icons.Outlined.Shield) } }) {
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Glyph(Icons.Outlined.Shield, size = 52.dp, active = true)
                    Spacer(Modifier.width(14.dp))
                    Text(l("Our team can't see your data unless you allow it here. Every action they take is logged.", "فريقنا لا يرى بياناتك إلا إذا سمحت هنا. كل ما يفعلونه مسجل."), color = CarColors.NavyInk, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item { CarDropdown(l("For how long?", "لأي مدة؟"), listOf("30 minutes", "2 hours", "24 hours"), hours, { hours = it }, { it }, icon = Icons.Outlined.Schedule) }
        item { GlassCard(padding = 8.dp) { ToggleRow(l("Read-only", "للقراءة فقط")); ToggleRow(l("Include money screens", "تضمين شاشات المال"), initial = false) } }
    }
}

/* ========================================================================== S10 offline & sync */

@Composable
fun OfflineScreen(nav: StationNav) {
    CarPage(title = Screen.Offline.title(), onBack = nav::back) {
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Glyph(Icons.Outlined.CloudDone, size = 52.dp, active = true)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) { Text(l("Everything is synced", "تمت مزامنة كل شيء"), style = MaterialTheme.typography.titleMedium, color = CarColors.NavyInk); Text(l("Last sync 12 seconds ago", "آخر مزامنة منذ ١٢ ثانية"), color = CarColors.TextSecondary) }
                    LiveDot()
                }
            }
        }
        item { SectionTitle(l("Waiting to send", "في انتظار الإرسال")) }
        item { GlassCard(padding = 8.dp) { CarRow(l("No pending changes", "لا توجد تغييرات معلقة"), icon = Icons.Outlined.CloudUpload) } }
        item {
            GlassCard(padding = 14.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Glyph(Icons.Outlined.CloudOff, size = 36.dp, tint = CarColors.Amber); Spacer(Modifier.width(12.dp))
                    Text(l("Without internet, orders and jobs keep working. Check-in and payments wait for the connection.", "بدون إنترنت تستمر الطلبات والأعمال. الحضور والدفع ينتظران الاتصال."), color = CarColors.TextSecondary, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item { GhostButton(l("Sync now", "زامن الآن"), {}, Modifier.fillMaxWidth(), icon = Icons.Outlined.Sync) }
    }
}
