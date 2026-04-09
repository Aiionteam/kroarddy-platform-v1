import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:geolocator/geolocator.dart";

import "../../../core/auth/jwt_claims.dart";
import "../../../core/network/api_client.dart";
import "../../profile/data/profile_repository.dart";

/// 웹 `buildGuideContext()` 대응 — 프로필·위치·날씨(모바일에서는 미연동) 직렬화 가능 구조.
Future<Map<String, dynamic>> buildGuideAskContext(WidgetRef ref) async {
  final token = await ref.read(tokenStoreProvider).readAccessToken();
  final appUserId = token != null ? getAppUserIdFromToken(token) : null;

  Map<String, dynamic> profile = {};
  if (appUserId != null) {
    try {
      final p = await ref.read(profileRepositoryProvider).fetchTravelProfile(appUserId);
      if (p != null) {
        profile = {
          "dietary_pref": p.dietaryPref ?? "",
          "age_band": p.ageBand ?? "",
          "gender": p.gender ?? "",
          "religion": p.religion ?? "",
          "nationality": p.nationality ?? "",
        };
      }
    } catch (_) {
      profile = {"load_error": "profile_unavailable"};
    }
  }

  Map<String, dynamic> location;
  try {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied ||
        perm == LocationPermission.deniedForever) {
      location = {
        "available": false,
        "reason": "geolocation_denied_or_unavailable",
      };
    } else {
      final pos = await Geolocator.getCurrentPosition();
      location = {
        "lat": pos.latitude,
        "lng": pos.longitude,
        "available": true,
      };
    }
  } catch (_) {
    location = {"available": false, "reason": "geolocation_error"};
  }

  final weather = <String, dynamic>{
    "available": false,
    "reason": location["available"] == true
        ? "weather_not_available_on_mobile"
        : "no_location_for_weather",
  };

  return {
    "user": {
      "app_user_id": appUserId,
      "profile": profile,
    },
    "location": location,
    "weather": weather,
  };
}
