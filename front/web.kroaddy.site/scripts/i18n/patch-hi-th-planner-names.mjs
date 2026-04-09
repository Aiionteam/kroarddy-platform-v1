import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const localesDir = path.join(root, "src/lib/i18n/locales");

const hiMap = {
  goyang:"गोयांग", paju:"पाजू", gimpo:"गिम्पो", uijeongbu:"उइजोंगबू", namyangju:"नमयांगजू", guri:"गुरी", gapyeong:"गाप्योंग", yangpyeong:"यांगप्योंग", pocheon:"पोचॉन", yangju:"यांगजू", dongducheon:"डोंगदूचॉन",
  suwon:"सुवोन", hwaseong:"ह्वासोंग", ansan:"आनसान", siheung:"सिहुंग", anyang:"अनयांग", gunpo:"गुनपो", pyeongtaek:"प्योंगतैक", yongin:"योंगिन", seongnam:"सोंगनाम", hanam:"हनाम", icheon:"इचॉन", yeoju:"योजू", anseong:"आनसोंग", osan:"ओसान", uiwang:"उइवांग", gwacheon:"ग्वाचॉन", bucheon:"बुचॉन", gwangmyeong:"ग्वांगम्योंग",
  chuncheon:"चुनचॉन", wonju:"वोनजू", pyeongchang:"प्योंगचांग", yeongwol:"योंगवोल", hoengseong:"ह्वेंगसोंग", jeongseon:"जोंगसॉन", inje:"इंजे", taebaek:"तैबैक", gangneung:"गंगनुंग", sokcho:"सोकचो", yangyang:"यांगयांग", donghae:"डोंघे", samcheok:"सामचोक", "goseong-gw":"गोसोंग",
  cheongju:"चोंगजू", chungju:"चुंगजू", jecheon:"जेचॉन", danyang:"दानयांग", gongju:"गोंगजू", buyeo:"बुयॉ", asan:"आसन", cheonan:"चियोनान", nonsan:"नोनसान", boryeong:"बोर्योंग", taean:"तैआन", seosan:"सिओसान", dangjin:"डांगजिन",
  jeonju:"जोंजू", gunsan:"गुनसान", iksan:"इकसान", gochang:"गोचांग", jeongeup:"जोंग्युप", namwon:"नामवोन", gimje:"गिम्जे", yeosu:"योसू", suncheon:"सुनचॉन", mokpo:"मोक्पो", wando:"वांडो", gangjin:"गांगजिन", yeonggwang:"योंगग्वांग", haenam:"हैनाम", goheung:"गोह्यूंग", yeongam:"योंगाम", damyang:"दामयांग", gwangyang:"ग्वांगयांग", boseong:"बोसोंग", naju:"नाजू",
  gyeongju:"ग्योंगजू", andong:"आंदोंग", yeongju:"योंगजू", mungyeong:"मुंग्योंग", pohang:"पोहांग", yeongdeok:"योंगदोक", uljin:"उलजिन", dokdo:"दोक्दो / उल्लुंगदो", gumi:"गुमी", gimcheon:"गिमचोन", yeongcheon:"योंगचोन", sangju:"सांगजू", gyeongsan:"ग्योंगसान",
  tongyeong:"टोंगयॉन्ग", geoje:"गोजे", namhae:"नमहे", "goseong-gn":"गोसोंग", jinju:"जिनजू", changwon:"चांगवॉन", hapcheon:"हापचॉन", miryang:"मिरयांग", hamyang:"हमयांग", sancheong:"सांचोंग", hadong:"हाडोंग", geochang:"ग्योचांग", gimhae:"गिम्हे", yangsan:"यांगसान", changnyeong:"चांगन्योंग", uiryeong:"उइर्योंग",
  jeju:"जेजू", seogwipo:"सोग्वीपो"
};

const thMap = {
  goyang:"โกยาง", paju:"พาจู", gimpo:"กิมโป", uijeongbu:"อึยจ็องบู", namyangju:"นัมยางจู", guri:"กูรี", gapyeong:"คาพย็อง", yangpyeong:"ยังพย็อง", pocheon:"โพชอน", yangju:"ยังจู", dongducheon:"ทงดูช็อน",
  suwon:"ซูวอน", hwaseong:"ฮวาซอง", ansan:"อันซัน", siheung:"ชีฮึง", anyang:"อันยาง", gunpo:"กุนโพ", pyeongtaek:"พย็องแท็ก", yongin:"ยงอิน", seongnam:"ซ็องนัม", hanam:"ฮานัม", icheon:"อีช็อน", yeoju:"ยอจู", anseong:"อันซ็อง", osan:"โอซาน", uiwang:"อึยวัง", gwacheon:"ควาช็อน", bucheon:"พูช็อน", gwangmyeong:"กวังมย็อง",
  chuncheon:"ชุนช็อน", wonju:"ว็อนจู", pyeongchang:"พย็องชัง", yeongwol:"ย็องวอล", hoengseong:"ฮเว็งซ็อง", jeongseon:"จ็องซ็อน", inje:"อินเจ", taebaek:"แทแบ็ก", gangneung:"คังนึง", sokcho:"ซกโช", yangyang:"ยังยาง", donghae:"ทงแฮ", samcheok:"ซัมช็อก", "goseong-gw":"โกซอง",
  cheongju:"ช็องจู", chungju:"ชุงจู", jecheon:"เชช็อน", danyang:"ทันยาง", gongju:"กงจู", buyeo:"พูยอ", asan:"อาซัน", cheonan:"ชอนอัน", nonsan:"นนซาน", boryeong:"โบรย็อง", taean:"แทอัน", seosan:"ซอซาน", dangjin:"ดังจิน",
  jeonju:"ช็อนจู", gunsan:"กุนซาน", iksan:"อิกซาน", gochang:"โกชาง", jeongeup:"จองอึบ", namwon:"นัมวอน", gimje:"กิมเจ", yeosu:"ยอซู", suncheon:"ซุนช็อน", mokpo:"มกโพ", wando:"วานโด", gangjin:"คังจิน", yeonggwang:"ย็องกวัง", haenam:"แฮนัม", goheung:"โกฮึง", yeongam:"ย็องอัม", damyang:"ทัมยาง", gwangyang:"กวังยาง", boseong:"โบซอง", naju:"นาจู",
  gyeongju:"คย็องจู", andong:"อันดง", yeongju:"ย็องจู", mungyeong:"มุนกย็อง", pohang:"โพฮัง", yeongdeok:"ย็องด็อก", uljin:"อุลจิน", dokdo:"ดกโด / อุลลึงโด", gumi:"กูมี", gimcheon:"กิมชอน", yeongcheon:"ย็องชอน", sangju:"ซังจู", gyeongsan:"คย็องซาน",
  tongyeong:"ทงย็อง", geoje:"คอเจ", namhae:"นัมแฮ", "goseong-gn":"โกซอง", jinju:"ชินจู", changwon:"ชังว็อน", hapcheon:"ฮับชอน", miryang:"มีรยัง", hamyang:"ฮัมยัง", sancheong:"ซันช็อง", hadong:"ฮาดง", geochang:"กอชาง", gimhae:"กิมแฮ", yangsan:"ยังซาน", changnyeong:"ชังนย็อง", uiryeong:"อึยรย็อง",
  jeju:"เชจู", seogwipo:"ซอกวีโพ"
};

for (const [lang, map] of Object.entries({ hi: hiMap, th: thMap })) {
  const p = path.join(localesDir, `${lang}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.planner ??= {};
  j.planner.dest ??= {};
  for (const [slug, name] of Object.entries(map)) {
    j.planner.dest[slug] ??= {};
    j.planner.dest[slug].name = name;
  }
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, "utf8");
  console.log(`patched ${lang} ${Object.keys(map).length}`);
}
