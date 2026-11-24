pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Car_Services_App"

include(":App")
include(":Core_Designsystem")
include(":Core_Network")
include(":Core_Security")
include(":Feature_Auth")
include(":Feature_Home")
include(":Feature_Station")
