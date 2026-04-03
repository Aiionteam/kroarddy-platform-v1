plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

import java.io.FileInputStream
import java.util.Properties

android {
    namespace = "site.kroaddy.kroaddy_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "site.kroaddy.kroaddy_app"
        // Flutter 기본 최소 OS는 API 24(Android 7.0). 그보다 낮은 기기는 “호환되지 않음”이 정상입니다.
        // minSdk를 21~23으로 두면 `flutter build` 시 마이그레이션으로 다시 flutter.minSdkVersion으로 바뀝니다.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // Release signing (Play Console 업로드용)
    val keystoreProperties = Properties()
    // key.properties / keystore는 flutter 프로젝트 루트(front/flutter)에 둔다
    val keystorePropertiesFile = rootProject.file("../key.properties")
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(FileInputStream(keystorePropertiesFile))
    }

    signingConfigs {
        // key.properties가 있을 때만 release signingConfig를 구성
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"]?.toString()
                keyPassword = keystoreProperties["keyPassword"]?.toString()
                val storePath = keystoreProperties["storeFile"]?.toString() ?: ""
                storeFile = rootProject.file("../$storePath")
                storePassword = keystoreProperties["storePassword"]?.toString()
            }
        }
    }

    buildTypes {
        release {
            // Play Console 업로드는 반드시 release 키로 서명되어야 함
            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

flutter {
    source = "../.."
}
