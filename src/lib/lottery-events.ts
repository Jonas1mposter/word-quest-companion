import championsArtwork from "@/assets/lottery-champions.jpg";
import gloryArtwork from "@/assets/lottery-glory-crown.jpg";

// Each event has its own detail route; the hall never executes a draw.
export const lotteryEvents = [
  {
    id: "glory-crown",
    name: "荣光铸冠",
    subtitle: "常驻奖池",
    description: "5 套连杀音效 · 10 张传说/神话名片 · 四重保底",
    image: gloryArtwork,
    path: "/lottery/glory-crown",
    cost: "150 豆优惠兑券 / 200 豆不限兑券",
    featuredPrize: "2021 全球冠军赛 · 侦查力量",
  },
  {
    id: "champions-2024",
    name: "冠军限定抽奖",
    subtitle: "2024 全球冠军赛",
    description: "5 张限定名片 · 冠军连杀音效 · 狄邦豆",
    image: championsArtwork,
    path: "/lottery/champions-2024",
    cost: "150 豆优惠兑券 / 200 豆不限兑券",
    featuredPrize: "2024 全球冠军赛音效",
  },
];
