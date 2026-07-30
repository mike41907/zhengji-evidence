export const ADDRESS_DATA = {
  "臺北市": {
    districts: ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"],
    roads: ["中山北路", "中山南路", "忠孝東路", "忠孝西路", "仁愛路", "信義路", "和平東路", "和平西路", "南京東路", "南京西路", "民生東路", "民權東路", "民權西路", "羅斯福路", "重慶北路", "重慶南路", "復興北路", "復興南路", "敦化北路", "敦化南路", "基隆路", "松江路", "承德路", "館前路", "市民大道", "環河北路", "木柵路", "內湖路", "南港路", "北投路"]
  },
  "新北市": {
    districts: ["板橋區", "三重區", "中和區", "永和區", "新莊區", "新店區", "土城區", "蘆洲區", "樹林區", "汐止區", "鶯歌區", "三峽區", "淡水區", "瑞芳區", "五股區", "泰山區", "林口區", "深坑區", "石碇區", "坪林區", "三芝區", "石門區", "八里區", "平溪區", "雙溪區", "貢寮區", "金山區", "萬里區", "烏來區"],
    roads: ["中山路", "中正路", "文化路", "民生路", "民權路", "民族路", "中央路", "中華路", "新北大道", "縣民大道", "板新路", "四川路", "三民路", "重新路", "正義北路", "中興路", "景平路", "中和路", "永和路", "新泰路", "思源路", "北新路", "安康路", "金城路", "長安街", "復興路", "淡金路", "明志路", "成泰路", "文化北路"]
  }
};

export const CITIES = Object.keys(ADDRESS_DATA);

export function composeAddress(parts) {
  const road = parts.road === "其他道路" ? parts.customRoad : parts.road;
  return [
    parts.city, parts.district, road,
    parts.section ? `${parts.section}段` : "",
    parts.lane ? `${parts.lane}巷` : "",
    parts.alley ? `${parts.alley}弄` : "",
    parts.number ? `${parts.number}號` : "",
    parts.floor ? `${parts.floor}樓` : "",
    parts.room ? `${parts.room}室` : "",
    parts.locationNote
  ].filter(Boolean).join("");
}
