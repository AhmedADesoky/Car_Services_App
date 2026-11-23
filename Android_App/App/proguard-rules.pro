# kotlinx.serialization + Retrofit
-keepattributes *Annotation*, InnerClasses, Signature, Exceptions
-keep,includedescriptorclasses class com.carservices.**$$serializer { *; }
-keepclassmembers class com.carservices.** { *** Companion; kotlinx.serialization.KSerializer serializer(...); }
-keep interface com.carservices.core.network.Car_Services_Api { *; }
