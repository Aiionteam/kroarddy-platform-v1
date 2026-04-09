import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "src/lib/i18n/locales/ja.json");
const j = JSON.parse(fs.readFileSync(file, "utf8"));

j.planner ??= {};
j.planner.region ??= {};
j.planner.dest ??= {};

const regionMap = {
  "gyeonggi-north": { label: "キョンギ北部", subLabel: "コヤン・パジュ・ウィジョンブ・ナミャンジュなど" },
  "gyeonggi-south": { label: "キョンギ南部", subLabel: "スウォン・ヨンイン・ソンナム・ピョンテクなど" },
  gangwon: { label: "カンウォン道", subLabel: "カンウォン特別自治道" },
  chungbuk: { label: "チュンチョンブク道", subLabel: "チョンジュ・チュンジュ・チェチョン・タニャン" },
  chungnam: { label: "チュンチョンナム道", subLabel: "コンジュ・プヨ・ボリョン・テアンなど" },
  jeonbuk: { label: "チョンブク特別自治道", subLabel: "チョンブク特別自治道" },
  jeonnam: { label: "チョルラナム道", subLabel: "ヨス・スンチョン・モッポ・タミャンなど" },
  gyeongbuk: { label: "キョンサンブク道", subLabel: "キョンジュ・ポハン・アンドンなど" },
  gyeongnam: { label: "キョンサンナム道", subLabel: "トンヨン・コジェ・チンジュ・チャンウォンなど" },
  jeju: { label: "チェジュ特別自治道", subLabel: "チェジュ特別自治道" },
};

for (const [id, v] of Object.entries(regionMap)) {
  j.planner.region[id] ??= {};
  j.planner.region[id].label = v.label;
  j.planner.region[id].subLabel = v.subLabel;
}

const destMap = {
  goyang: "コヤン", paju: "パジュ", gimpo: "キンポ", uijeongbu: "ウィジョンブ", namyangju: "ナミャンジュ", guri: "クリ", gapyeong: "カピョン", yangpyeong: "ヤンピョン",
  pocheon: "ポチョン", yangju: "ヤンジュ", dongducheon: "トンドゥチョン", suwon: "スウォン", hwaseong: "ファソン", ansan: "アンサン", siheung: "シフン", anyang: "アニャン",
  gunpo: "クンポ", pyeongtaek: "ピョンテク", yongin: "ヨンイン", seongnam: "ソンナム", hanam: "ハナム", icheon: "イチョン", yeoju: "ヨジュ", anseong: "アンソン", osan: "オサン",
  uiwang: "ウィワン", gwacheon: "クァチョン", bucheon: "プチョン", gwangmyeong: "クァンミョン", chuncheon: "チュンチョン", wonju: "ウォンジュ", pyeongchang: "ピョンチャン", yeongwol: "ヨンウォル",
  hoengseong: "フェンソン", jeongseon: "チョンソン", inje: "インジェ", taebaek: "テベク", gangneung: "カンヌン", sokcho: "ソクチョ", yangyang: "ヤンヤン", donghae: "トンヘ", samcheok: "サムチョク", "goseong-gw": "コソン",
  cheongju: "チョンジュ", chungju: "チュンジュ", jecheon: "チェチョン", danyang: "タニャン", gongju: "コンジュ", buyeo: "プヨ", asan: "アサン", cheonan: "チョナン", nonsan: "ノンサン", boryeong: "ポリョン",
  taean: "テアン", seosan: "ソサン", dangjin: "タンジン", jeonju: "チョンジュ", gunsan: "クンサン", iksan: "イクサン", gochang: "コチャン", jeongeup: "チョンウプ", namwon: "ナムウォン", gimje: "キムジェ",
  yeosu: "ヨス", suncheon: "スンチョン", mokpo: "モクポ", wando: "ワンド", gangjin: "カンジン", yeonggwang: "ヨングァン", haenam: "ヘナム", goheung: "コフン", yeongam: "ヨンアム", damyang: "タミャン",
  gwangyang: "クァンヤン", boseong: "ポソン", naju: "ナジュ", gyeongju: "キョンジュ", andong: "アンドン", yeongju: "ヨンジュ", mungyeong: "ムンギョン", pohang: "ポハン", yeongdeok: "ヨンドク", uljin: "ウルジン",
  dokdo: "トクト・ウルルンド", gumi: "クミ", gimcheon: "キムチョン", yeongcheon: "ヨンチョン", sangju: "サンジュ", gyeongsan: "キョンサン", tongyeong: "トンヨン", geoje: "コジェ", namhae: "ナメ", "goseong-gn": "コソン",
  jinju: "チンジュ", changwon: "チャンウォン", hapcheon: "ハプチョン", miryang: "ミリャン", hamyang: "ハミャン", sancheong: "サンチョン", hadong: "ハドン", geochang: "コチャン", gimhae: "キメ", yangsan: "ヤンサン",
  changnyeong: "チャンニョン", uiryeong: "ウィリョン", jeju: "チェジュ", seogwipo: "ソギポ",
};

for (const [slug, name] of Object.entries(destMap)) {
  j.planner.dest[slug] ??= {};
  j.planner.dest[slug].name = name;
}

fs.writeFileSync(file, `${JSON.stringify(j, null, 2)}\n`, "utf8");
console.log("patched ja region/dest", Object.keys(regionMap).length, Object.keys(destMap).length);
