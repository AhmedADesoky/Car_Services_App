plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.carservices.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.carservices.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            // Android emulator reaches the PC's localhost through 10.0.2.2.
            // On a real phone, replace with your PC's Wi-Fi IP, e.g. "http://192.168.1.20:3000/v1/".
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:3000/v1/\"")
            applicationIdSuffix = ".debug"
        }
        release {
            buildConfigField("String", "BASE_URL", "\"https://api.carservices.app/v1/\"")
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(project(":Core_Designsystem"))
    implementation(project(":Core_Network"))
    implementation(project(":Core_Security"))
    implementation(project(":Feature_Auth"))
    implementation(project(":Feature_Home"))
    implementation(project(":Feature_Station"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    debugImplementation(libs.compose.ui.tooling)
}
