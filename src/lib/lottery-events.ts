import championsArtwork from "@/assets/lottery-champions.jpg";

// Each event has its own detail route; the hall never executes a draw.
export const lotteryEvents = [
  {
    id: "champions-2024",
    name: "冠军限定抽奖",
    subtitle: "2024 全球冠军赛",
    description: "5 张限定名片 · 冠军连杀音效 · 狄邦豆",
    image: championsArtwork,
    path: "/lottery/champions-2024",
    cost: "1 张抽奖券 / 次",
    featuredPrize: "2024 全球冠军赛音效",
  },
];