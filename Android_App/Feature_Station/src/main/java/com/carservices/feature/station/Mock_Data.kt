package com.carservices.feature.station

import androidx.compose.ui.graphics.Color
import com.carservices.core.designsystem.CarColors

/* Sample data for the UI-only screens. Replaced by repositories in each feature's phase. */

data class MockWorker(val name: String, val role: String, val roleAr: String, val branch: String, val status: WorkerStatus, val jobs: Int, val rating: Float, val since: String)
enum class WorkerStatus(val en: String, val ar: String, val color: Color) {
    OnSite("On site", "في المحطة", CarColors.Teal), Late("Late", "متأخر", CarColors.Amber), Off("Off today", "إجازة", CarColors.Outline), Suspended("Suspended", "موقوف", CarColors.Orange),
}

data class MockOrder(val number: String, val plateCode: String, val plateNumber: String, val car: String, val customer: String, val services: String, val worker: String, val minutes: Int, val total: Int, val stage: OrderStage)
enum class OrderStage(val en: String, val ar: String, val color: Color) {
    Working("In progress", "قيد التنفيذ", CarColors.Teal), Ready("Ready to pay", "جاهز للدفع", CarColors.Orange), Paid("Paid", "مدفوع", CarColors.Navy), Waiting("Waiting", "في الانتظار", CarColors.Amber),
}

data class MockService(val name: String, val nameAr: String, val price: Int, val minutes: Int)
data class MockCustomer(val name: String, val phone: String, val cars: Int, val visits: Int, val last: String, val plateCode: String, val plateNumber: String, val car: String)

object Mock {
    val workers = listOf(
        MockWorker("Karim Adel", "Mechanic", "ميكانيكي", "Shuwaikh", WorkerStatus.OnSite, 7, 4.8f, "2024"),
        MockWorker("Mahmoud Saeed", "Washer", "غسيل", "Shuwaikh", WorkerStatus.OnSite, 11, 4.6f, "2025"),
        MockWorker("Omar Fathy", "Electrician", "كهربائي", "Salmiya", WorkerStatus.Late, 3, 4.5f, "2023"),
        MockWorker("Youssef Nabil", "Cashier", "كاشير", "Shuwaikh", WorkerStatus.OnSite, 0, 4.9f, "2025"),
        MockWorker("Hassan Ali", "Tyres", "إطارات", "Salmiya", WorkerStatus.Off, 0, 4.2f, "2022"),
        MockWorker("Ahmed Reda", "Mechanic", "ميكانيكي", "Shuwaikh", WorkerStatus.Suspended, 0, 3.9f, "2024"),
    )

    val orders = listOf(
        MockOrder("A-1042", "12", "34567", "Toyota Land Cruiser 2022", "Abdullah Al-Mutairi", "Oil change · Filter", "Karim Adel", 24, 16000, OrderStage.Working),
        MockOrder("A-1041", "5", "8812", "Nissan Patrol 2023", "Fahad Al-Azmi", "Full wash · Polish", "Mahmoud Saeed", 41, 10000, OrderStage.Ready),
        MockOrder("A-1040", "18", "40219", "Toyota Camry 2021", "Maryam Al-Kandari", "Brake pads (front)", "Omar Fathy", 55, 35000, OrderStage.Working),
        MockOrder("A-1039", "7", "66103", "GMC Yukon 2020", "Yousef Al-Rashidi", "AC recharge", "Karim Adel", 0, 15000, OrderStage.Waiting),
        MockOrder("A-1038", "2", "90555", "Chevrolet Tahoe 2019", "Ali Hussain", "Battery replace", "Omar Fathy", 32, 32000, OrderStage.Paid),
    )

    val services = listOf(
        MockService("Oil change", "تغيير زيت", 12500, 25), MockService("Oil filter", "فلتر زيت", 3500, 10),
        MockService("Full wash", "غسيل كامل", 4000, 30), MockService("Interior cleaning", "تنظيف داخلي", 6000, 40),
        MockService("Brake pads (front)", "فحمات فرامل أمامية", 35000, 60), MockService("Wheel alignment", "ضبط زوايا", 8000, 30),
        MockService("AC recharge", "شحن تكييف", 15000, 45), MockService("Battery replace", "تغيير بطارية", 32000, 20),
    )

    val customers = listOf(
        MockCustomer("Abdullah Al-Mutairi", "+965 9876 5432", 2, 14, "Today", "12", "34567", "Toyota Land Cruiser"),
        MockCustomer("Fahad Al-Azmi", "+965 6655 0199", 1, 6, "Today", "5", "8812", "Nissan Patrol"),
        MockCustomer("Maryam Al-Kandari", "+965 5090 1180", 1, 9, "Yesterday", "18", "40219", "Toyota Camry"),
        MockCustomer("Yousef Al-Rashidi", "+965 9977 2233", 3, 22, "3 days ago", "7", "66103", "GMC Yukon"),
        MockCustomer("Ali Hussain", "+965 6456 7788", 1, 3, "Last week", "2", "90555", "Chevrolet Tahoe"),
    )

    val weekRevenue = listOf(18.2f, 21.5f, 16.9f, 24.8f, 27.1f, 31.4f, 22.6f)
    val weekDays = listOf("Sa", "Su", "Mo", "Tu", "We", "Th", "Fr")
    val weekDaysAr = listOf("سبت", "أحد", "اثن", "ثلا", "أرب", "خمي", "جمع")
    val trend = listOf(12f, 14f, 13f, 17f, 16f, 19f, 22f, 21f, 25f, 27f, 26f, 31f)
}

/** Kuwaiti dinar has 1000 fils: amounts are kept in fils and shown with 3 decimals, e.g. 16000 -> "16.000 KWD". */
fun kwd(fils: Int, arabic: Boolean = false): String {
    val n = "%,.3f".format(fils / 1000.0)
    return if (arabic) "$n د.ك" else "$n KWD"
}
