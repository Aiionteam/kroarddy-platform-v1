import "dart:async";

import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/locale/locale_from_nationality.dart";
import "../../../core/preferences/onboarding_prefs.dart";
import "../data/profile_models.dart";
import "../data/profile_option_labels.dart";
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

  List<({String key, String title, List<String> options})> get _steps => [
        (key: "nationality", title: "onboarding.steps.nationality".tr(), options: nationalityOptions),
        (key: "gender", title: "onboarding.steps.gender".tr(), options: genderOptions),
        (key: "age_band", title: "onboarding.steps.age_band".tr(), options: ageBandOptions),
        (key: "dietary_pref", title: "onboarding.steps.dietary_pref".tr(), options: dietaryOptions),
        (key: "religion", title: "onboarding.steps.religion".tr(), options: religionOptions),
      ];

  @override
  Widget build(BuildContext context) {
    final repo = ref.read(profileRepositoryProvider);
    final steps = _steps;
    final current = steps[step];
    final isLast = step == steps.length - 1;
    final selected = _valueByKey(current.key);

    return Scaffold(
      appBar: AppBar(title: Text("onboarding.title".tr())),
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
                      label: Text(_optionLabel(current.key, opt)),
                      selected: selected == opt,
                      onSelected: (_) {
                        final next = selected == opt ? "" : opt;
                        setState(() => _setByKey(current.key, next));
                        if (current.key == "nationality") {
                          unawaited(LocaleFromNationality.apply(next, fromSavedProfile: false));
                        }
                      },
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
                              if (context.canPop()) {
                                context.pop();
                              } else {
                                context.go("/profile");
                              }
                            } else {
                              setState(() => step -= 1);
                            }
                          },
                    child: Text("onboarding.prev".tr()),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
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
                              message = "onboarding.saving".tr();
                            });
                            try {
                              final ids = await repo.resolveIds();
                              await repo.upsertTravelProfile(
                                appUserId: ids.$2,
                                form: form,
                              );
                              await OnboardingPrefs.clearSkipped();
                              if (!context.mounted) return;
                              context.go("/home");
                            } catch (e) {
                              setState(() {
                                loading = false;
                                message = "${"settings.error.save".tr()}: $e";
                              });
                            }
                          },
                    child: Text(isLast ? "common.done".tr() : "common.next".tr()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Center(
              child: TextButton(
                onPressed: loading
                    ? null
                    : () async {
                        await OnboardingPrefs.setSkipped(true);
                        if (!context.mounted) return;
                        context.go("/home");
                      },
                child: Text("onboarding.skip_later".tr()),
              ),
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

  String _optionLabel(String stepKey, String opt) {
    switch (stepKey) {
      case "nationality":
        return optionLabelNationality(opt);
      case "gender":
        return optionLabelGender(opt);
      case "age_band":
        return optionLabelAge(opt);
      case "dietary_pref":
        return optionLabelDiet(opt);
      case "religion":
        return optionLabelReligion(opt);
      default:
        return opt;
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
