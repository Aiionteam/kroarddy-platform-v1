import fs from "fs";
import path from "path";

const locDir = path.join(process.cwd(), "src/lib/i18n/locales");

const regionByLang = {
  fr: {
    "seoul-areas": { label: "Séoul", subLabel: "Principales zones par quartier" },
    "gyeonggi-north": { label: "Nord du Gyeonggi", subLabel: "Goyang, Paju, Uijeongbu, Namyangju, etc." },
    "gyeonggi-south": { label: "Sud du Gyeonggi", subLabel: "Suwon, Yongin, Seongnam, Pyeongtaek, etc." },
    gangwon: { label: "Gangwon", subLabel: "Province autonome spéciale de Gangwon" },
    chungbuk: { label: "Chungcheongbuk-do", subLabel: "Cheongju, Chungju, Jecheon, Danyang" },
    chungnam: { label: "Chungcheongnam-do", subLabel: "Gongju, Buyeo, Boryeong, Taean, etc." },
    jeonbuk: { label: "Jeonbuk", subLabel: "Province autonome spéciale de Jeonbuk" },
    jeonnam: { label: "Jeollanam-do", subLabel: "Yeosu, Suncheon, Mokpo, Damyang, etc." },
    busan: { label: "Busan", subLabel: "Ville métropolitaine de Busan" },
    daegu: { label: "Daegu", subLabel: "Ville métropolitaine de Daegu" },
    ulsan: { label: "Ulsan", subLabel: "Ville métropolitaine d’Ulsan" },
    gyeongbuk: { label: "Gyeongsangbuk-do", subLabel: "Gyeongju, Pohang, Andong, etc." },
    gyeongnam: { label: "Gyeongsangnam-do", subLabel: "Tongyeong, Geoje, Jinju, Changwon, etc." },
    jeju: { label: "Jeju-do", subLabel: "Province autonome spéciale de Jeju" },
  },
  de: {
    "seoul-areas": { label: "Seoul", subLabel: "Wichtige Gebiete nach Stadtteilen" },
    "gyeonggi-north": { label: "Nördliches Gyeonggi", subLabel: "Goyang, Paju, Uijeongbu, Namyangju usw." },
    "gyeonggi-south": { label: "Südliches Gyeonggi", subLabel: "Suwon, Yongin, Seongnam, Pyeongtaek usw." },
    gangwon: { label: "Gangwon", subLabel: "Sonderautonome Provinz Gangwon" },
    chungbuk: { label: "Chungcheongbuk-do", subLabel: "Cheongju, Chungju, Jecheon, Danyang" },
    chungnam: { label: "Chungcheongnam-do", subLabel: "Gongju, Buyeo, Boryeong, Taean usw." },
    jeonbuk: { label: "Jeonbuk", subLabel: "Sonderautonome Provinz Jeonbuk" },
    jeonnam: { label: "Jeollanam-do", subLabel: "Yeosu, Suncheon, Mokpo, Damyang usw." },
    busan: { label: "Busan", subLabel: "Metropolstadt Busan" },
    daegu: { label: "Daegu", subLabel: "Metropolstadt Daegu" },
    ulsan: { label: "Ulsan", subLabel: "Metropolstadt Ulsan" },
    gyeongbuk: { label: "Gyeongsangbuk-do", subLabel: "Gyeongju, Pohang, Andong usw." },
    gyeongnam: { label: "Gyeongsangnam-do", subLabel: "Tongyeong, Geoje, Jinju, Changwon usw." },
    jeju: { label: "Jeju-do", subLabel: "Sonderautonome Provinz Jeju" },
  },
  vi: {
    "seoul-areas": { label: "Seoul", subLabel: "Khu vực nổi bật theo quận" },
    "gyeonggi-north": { label: "Bắc Gyeonggi", subLabel: "Goyang, Paju, Uijeongbu, Namyangju, v.v." },
    "gyeonggi-south": { label: "Nam Gyeonggi", subLabel: "Suwon, Yongin, Seongnam, Pyeongtaek, v.v." },
    gangwon: { label: "Gangwon", subLabel: "Tỉnh tự trị đặc biệt Gangwon" },
    chungbuk: { label: "Chungcheongbuk-do", subLabel: "Cheongju, Chungju, Jecheon, Danyang" },
    chungnam: { label: "Chungcheongnam-do", subLabel: "Gongju, Buyeo, Boryeong, Taean, v.v." },
    jeonbuk: { label: "Jeonbuk", subLabel: "Tỉnh tự trị đặc biệt Jeonbuk" },
    jeonnam: { label: "Jeollanam-do", subLabel: "Yeosu, Suncheon, Mokpo, Damyang, v.v." },
    busan: { label: "Busan", subLabel: "Thành phố trực thuộc trung ương Busan" },
    daegu: { label: "Daegu", subLabel: "Thành phố trực thuộc trung ương Daegu" },
    ulsan: { label: "Ulsan", subLabel: "Thành phố trực thuộc trung ương Ulsan" },
    gyeongbuk: { label: "Gyeongsangbuk-do", subLabel: "Gyeongju, Pohang, Andong, v.v." },
    gyeongnam: { label: "Gyeongsangnam-do", subLabel: "Tongyeong, Geoje, Jinju, Changwon, v.v." },
    jeju: { label: "Jeju-do", subLabel: "Tỉnh tự trị đặc biệt Jeju" },
  },
  id: {
    "seoul-areas": { label: "Seoul", subLabel: "Area utama per distrik" },
    "gyeonggi-north": { label: "Gyeonggi Utara", subLabel: "Goyang, Paju, Uijeongbu, Namyangju, dll." },
    "gyeonggi-south": { label: "Gyeonggi Selatan", subLabel: "Suwon, Yongin, Seongnam, Pyeongtaek, dll." },
    gangwon: { label: "Gangwon", subLabel: "Provinsi otonom khusus Gangwon" },
    chungbuk: { label: "Chungcheongbuk-do", subLabel: "Cheongju, Chungju, Jecheon, Danyang" },
    chungnam: { label: "Chungcheongnam-do", subLabel: "Gongju, Buyeo, Boryeong, Taean, dll." },
    jeonbuk: { label: "Jeonbuk", subLabel: "Provinsi otonom khusus Jeonbuk" },
    jeonnam: { label: "Jeollanam-do", subLabel: "Yeosu, Suncheon, Mokpo, Damyang, dll." },
    busan: { label: "Busan", subLabel: "Kota metropolitan Busan" },
    daegu: { label: "Daegu", subLabel: "Kota metropolitan Daegu" },
    ulsan: { label: "Ulsan", subLabel: "Kota metropolitan Ulsan" },
    gyeongbuk: { label: "Gyeongsangbuk-do", subLabel: "Gyeongju, Pohang, Andong, dll." },
    gyeongnam: { label: "Gyeongsangnam-do", subLabel: "Tongyeong, Geoje, Jinju, Changwon, dll." },
    jeju: { label: "Jeju-do", subLabel: "Provinsi otonom khusus Jeju" },
  },
};

const metroByLang = {
  fr: {
    seoul: "Séoul",
    jongno: "Jongno · Gwanghwamun",
    myeongdong: "Myeongdong · Euljiro",
    yongsan: "Yongsan · Itaewon",
    gangnam: "Gangnam · Seocho",
    jamsil: "Jamsil · Songpa",
    seongsu: "Seongsu · Hannam",
    hongdae: "Hongdae · Mapo",
    bukchon: "Bukchon · Samcheong",
    nowon: "Nowon · Dobong",
  },
  de: {
    jongno: "Jongno · Gwanghwamun",
    myeongdong: "Myeongdong · Euljiro",
    yongsan: "Yongsan · Itaewon",
    gangnam: "Gangnam · Seocho",
    jamsil: "Jamsil · Songpa",
    seongsu: "Seongsu · Hannam",
    hongdae: "Hongdae · Mapo",
    bukchon: "Bukchon · Samcheong",
    nowon: "Nowon · Dobong",
  },
  vi: {
    jongno: "Jongno · Gwanghwamun",
    myeongdong: "Myeongdong · Euljiro",
    yongsan: "Yongsan · Itaewon",
    gangnam: "Gangnam · Seocho",
    jamsil: "Jamsil · Songpa",
    seongsu: "Seongsu · Hannam",
    hongdae: "Hongdae · Mapo",
    bukchon: "Bukchon · Samcheong",
    nowon: "Nowon · Dobong",
  },
  id: {
    jongno: "Jongno · Gwanghwamun",
    myeongdong: "Myeongdong · Euljiro",
    yongsan: "Yongsan · Itaewon",
    gangnam: "Gangnam · Seocho",
    jamsil: "Jamsil · Songpa",
    seongsu: "Seongsu · Hannam",
    hongdae: "Hongdae · Mapo",
    bukchon: "Bukchon · Samcheong",
    nowon: "Nowon · Dobong",
  },
};

for (const lang of ["fr","de","vi","id"]) {
  const p = path.join(locDir, `${lang}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.planner ??= {};
  j.planner.region ??= {};
  j.planner.dest ??= {};

  for (const [k, v] of Object.entries(regionByLang[lang])) {
    j.planner.region[k] ??= {};
    j.planner.region[k].label = v.label;
    j.planner.region[k].subLabel = v.subLabel;
  }

  for (const [k, v] of Object.entries(metroByLang[lang])) {
    j.planner.dest[k] ??= {};
    j.planner.dest[k].name = v;
  }

  for (const [slug, obj] of Object.entries(j.planner.dest)) {
    if (!obj || typeof obj !== "object") continue;
    if (typeof obj.name === "string") {
      obj.name = obj.name.replace(/\s*\/\s*/g, " · ").replace(/\s*&\s*/g, " · ");
    }
  }

  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, "utf8");
  console.log(`patched ${lang}`);
}
