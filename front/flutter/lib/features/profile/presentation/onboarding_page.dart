import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../data/profile_models.dart";
import "../data/profile_repository.dart";

class OnboardingPage extends ConsumerStatefulWidget {
  const OnboardingPage({super.key});

  @override
  ConsumerState<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends ConsumerState<OnboardingPage> {
  int step = 0;
  bool loading = false;
  String message = "";
  ProfileForm form = ProfileForm.empty();

  static const steps = <({String key, String title, List<String> options})>[
    (key: "nationality", title: "어느 나라에서 오셨나요?", options: nationalityOptions),
    (key: "gender", title: "성별을 알려주세요", options: genderOptions),
    (key: "age_band", title: "나이대를 선택해주세요", options: ageBandOptions),
    (key: "dietary_pref", title: "식습관을 알려주세요", options: dietaryOptions),
    (key: "religion", title: "종교가 있으신가요?", options: religionOptions),
  ];

  @override
  Widget build(BuildContext context) {
    final repo = ref.read(profileRepositoryProvider);
    final current = steps[step];
    final isLast = step == steps.length - 1;
    final selected = _valueByKey(current.key);

    return Scaffold(
      appBar: AppBar(title: const Text("여행 취향 설정")),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LinearProgressIndicator(value: (step + 1) / steps.length),
            const SizedBox(height: 16),
            Text(current.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: current.options
                  .map(
                    (opt) => ChoiceChip(
                      label: Text(opt),
                      selected: selected == opt,
                      onSelected: (_) => setState(() => _setByKey(current.key, selected == opt ? "" : opt)),
                    ),
                  )
                  .toList(),
            ),
            const Spacer(),
            if (message.isNotEmpty) Text(message),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: loading
                        ? null
                        : () {
                            if (step == 0) {
                              context.pop();
                            } else {
                              setState(() => step -= 1);
                            }
                          },
                    child: const Text("이전"),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: loading
                        ? null
                        : () async {
                            if (!isLast) {
                              setState(() => step += 1);
                              return;
                            }
                            setState(() {
                              loading = true;
                              message = "저장 중...";
                            });
                            try {
                              final ids = await repo.resolveIds();
                              await repo.upsertTravelProfile(
                                appUserId: ids.$2,
                                form: form,
                              );
                              if (!context.mounted) return;
                              context.go("/profile");
                            } catch (e) {
                              setState(() {
                                loading = false;
                                message = "저장 실패: $e";
                              });
                            }
                          },
                    child: Text(isLast ? "완료" : "다음"),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _valueByKey(String key) {
    switch (key) {
      case "nationality":
        return form.nationality;
      case "gender":
        return form.gender;
      case "age_band":
        return form.ageBand;
      case "dietary_pref":
        return form.dietaryPref;
      case "religion":
        return form.religion;
      default:
        return "";
    }
  }

  void _setByKey(String key, String value) {
    switch (key) {
      case "nationality":
        form = form.copyWith(nationality: value);
        return;
      case "gender":
        form = form.copyWith(gender: value);
        return;
      case "age_band":
        form = form.copyWith(ageBand: value);
        return;
      case "dietary_pref":
        form = form.copyWith(dietaryPref: value);
        return;
      case "religion":
        form = form.copyWith(religion: value);
        return;
      default:
        return;
    }
  }
}
