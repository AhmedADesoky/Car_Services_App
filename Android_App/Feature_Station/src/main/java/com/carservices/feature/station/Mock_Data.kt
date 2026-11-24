package com.carservices.feature.station

import androidx.compose.ui.graphics.Color
import com.carservices.core.designsystem.CarColors

/* Sample data for the UI-only screens. Replaced by repositories in each feature's phase. */

data class MockWorker(val name: String, val role: String, val roleAr: String, val branch: String, val status: WorkerStatus, val jobs: Int, val rating: Float, val since: String)
enum class WorkerStatus(val en: String, val ar: String, val color: Color) {
    OnSite("On site", "في المحطة", CarColors.Teal), Late("Late", "متأخر", CarColors.Amber), Off("Off today", "إجازة", CarColors.Outline), Suspended("Suspended", "موقوف", CarColors.Orange),
}

data class MockOrder(val number: String, val letters: String, val digits: String, val car: String, val customer: String, val services: String, val worker: String, val minutes: Int, val total: Int, val stage: OrderStage)
enum class OrderStage(val en: String, val ar: String, val color: Color) {
    Working("In progress", "قيد التنفيذ", CarColors.Teal), Ready("Ready to pay", "جاهز للدفع", CarColors.Orange), Paid("Paid", "مدفوع", CarColors.Navy), Waiting("Waiting", "في الانتظار", CarColors.Amber),
}

data class MockService(val name: String, val nameAr: String, val price: Int, val minutes: Int)
data class MockCustomer(val name: String, val phone: String, val cars: Int, val visits: Int, val last: String, val letters: String, val digits: String, val car: String)

object Mock {
    val workers = listOf(
        MockWorker("Karim Adel", "Mechanic", "ميكانيكي", "Nasr City", WorkerStatus.OnSite, 7, 4.8f, "2024"),
        MockWorker("Mahmoud Saeed", "Washer", "غسيل", "Nasr City", WorkerStatus.OnSite, 11, 4.6f, "2025"),
        MockWorker("Omar Fathy", "Electrician", "كهربائي", "Heliopolis", WorkerStatus.Late, 3, 4.5f, "2023"),
        MockWorker("Youssef Nabil", "Cashier", "كاشير", "Nasr City", WorkerStatus.OnSite, 0, 4.9f, "2025"),
        MockWorker("Hassan Ali", "Tyres", "إطارات", "Heliopolis", WorkerStatus.Off, 0, 4.2f, "2022"),
        MockWorker("Ahmed Reda", "Mechanic", "ميكانيكي", "Nasr City", WorkerStatus.Suspended, 0, 3.9f, "2024"),
    )

    val orders = listOf(
        MockOrder("A-1042", "ق ر ب", "٤٥٦٧", "Hyundai Elantra 2021", "Mostafa Hamdy", "Oil change · Filter", "Karim Adel", 24, 1450, OrderStage.Working),
        MockOrder("A-1041", "س م ع", "١٢٣٤", "Kia Sportage 2023", "Nour El-Din", "Full wash · Polish", "Mahmoud Saeed", 41, 650, OrderStage.Ready),
        MockOrder("A-1040", "ب ط و", "٩٨٧", "Toyota Corolla 2019", "Salma Khaled", "Brake pads (front)", "Omar Fathy", 55, 2100, OrderStage.Working),
        MockOrder("A-1039", "ن ه ـ", "٥٥٢١", "Nissan Sunny 2018", "Tarek Mostafa", "AC recharge", "Karim Adel", 0, 900, OrderStage.Waiting),
        MockOrder("A-1038", "ر ع د", "٣٣١٠", "Chevrolet Optra 2016", "Ali Hassan", "Battery replace", "Omar Fathy", 32, 3200, OrderStage.Paid),
    )

    val services = listOf(
        MockService("Oil change", "تغيير زيت", 850, 25), MockService("Oil filter", "فلتر زيت", 250, 10),
        MockService("Full wash", "غسيل كامل", 300, 30), MockService("Interior cleaning", "تنظيف داخلي", 450, 40),
        MockService("Brake pads (front)", "تيل فرامل أمامي", 1600, 60), MockService("Wheel alignment", "ضبط زوايا", 400, 30),
        MockService("AC recharge", "شحن تكييف", 900, 45), MockService("Battery replace", "تغيير بطارية", 3200, 20),
    )

    val customers = listOf(
        MockCustomer("Mostafa Hamdy", "+20 100 123 4567", 2, 14, "Today", "ق ر ب", "٤٥٦٧", "Hyundai Elantra"),
        MockCustomer("Nour El-Din", "+20 111 555 0199", 1, 6, "Today", "س م ع", "١٢٣٤", "Kia Sportage"),
        MockCustomer("Salma Khaled", "+20 122 909 1180", 1, 9, "Yesterday", "ب ط و", "٩٨٧", "Toyota Corolla"),
        MockCustomer("Tarek Mostafa", "+20 109 777 2233", 3, 22, "3 days ago", "ن ه ـ", "٥٥٢١", "Nissan Sunny"),
        MockCustomer("Ali Hassan", "+20 128 456 7788", 1, 3, "Last week", "ر ع د", "٣٣١٠", "Chevrolet Optra"),
    )

    val weekRevenue = listOf(18.2f, 21.5f, 16.9f, 24.8f, 27.1f, 31.4f, 22.6f)
    val weekDays = listOf("Sa", "Su", "Mo", "Tu", "We", "Th", "Fr")
    val weekDaysAr = listOf("سبت", "أحد", "اثن", "ثلا", "أرب", "خمي", "جمع")
    val trend = listOf(12f, 14f, 13f, 17f, 16f, 19f, 22f, 21f, 25f, 27f, 26f, 31f)
}

/** Formats EGP amounts like "1,450 EGP". */
fun egp(amount: Int, arabic: Boolean = false): String {
    val n = "%,d".format(amount)
    return if (arabic) "$n ج.م" else "$n EGP"
}
