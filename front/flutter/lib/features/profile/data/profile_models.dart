class UserModel {
  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.nickname,
    required this.provider,
    required this.honor,
    required this.tier,
  });

  final int? id;
  final String? name;
  final String? email;
  final String? nickname;
  final String? provider;
  final int? honor;
  final String? tier;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: (json["id"] as num?)?.toInt(),
      name: json["name"]?.toString(),
      email: json["email"]?.toString(),
      nickname: json["nickname"]?.toString(),
      provider: json["provider"]?.toString(),
      honor: (json["honor"] as num?)?.toInt(),
      tier: json["tier"]?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      "id": id,
      "name": name,
      "email": email,
      "nickname": nickname,
      "provider": provider,
      "honor": honor,
      "tier": tier,
    };
  }
}

class TravelProfile {
  TravelProfile({
    required this.userId,
    required this.gender,
    required this.ageBand,
    required this.dietaryPref,
    required this.religion,
    required this.nationality,
    required this.isComplete,
  });

  final int userId;
  final String? gender;
  final String? ageBand;
  final String? dietaryPref;
  final String? religion;
  final String? nationality;
  final bool isComplete;

  factory TravelProfile.fromJson(Map<String, dynamic> json) {
    return TravelProfile(
      userId: (json["user_id"] as num?)?.toInt() ?? 0,
      gender: json["gender"]?.toString(),
      ageBand: json["age_band"]?.toString(),
      dietaryPref: json["dietary_pref"]?.toString(),
      religion: json["religion"]?.toString(),
      nationality: json["nationality"]?.toString(),
      isComplete: json["is_complete"] == true,
    );
  }
}

class ProfileForm {
  const ProfileForm({
    required this.gender,
    required this.ageBand,
    required this.dietaryPref,
    required this.religion,
    required this.nationality,
  });

  factory ProfileForm.empty() {
    return const ProfileForm(
      gender: "",
      ageBand: "",
      dietaryPref: "",
      religion: "",
      nationality: "",
    );
  }

  final String gender;
  final String ageBand;
  final String dietaryPref;
  final String religion;
  final String nationality;

  ProfileForm copyWith({
    String? gender,
    String? ageBand,
    String? dietaryPref,
    String? religion,
    String? nationality,
  }) {
    return ProfileForm(
      gender: gender ?? this.gender,
      ageBand: ageBand ?? this.ageBand,
      dietaryPref: dietaryPref ?? this.dietaryPref,
      religion: religion ?? this.religion,
      nationality: nationality ?? this.nationality,
    );
  }
}

const genderOptions = ["남성", "여성", "기타", "무응답"];
const ageBandOptions = ["10대", "20대", "30대", "40대", "50대", "60대이상"];
const dietaryOptions = ["일반", "채식", "비건", "할랄", "알레르기있음"];
const religionOptions = ["없음", "기독교", "불교", "천주교", "이슬람", "기타"];
const nationalityOptions = [
  "한국",
  "USA",
  "日本",
  "中国",
  "United Kingdom",
  "France",
  "Deutschland",
  "Canada",
  "Australia",
  "Việt Nam",
  "Thailand",
  "Philippines",
  "Indonesia",
  "Singapore",
  "Malaysia",
  "India",
  "Other",
];
