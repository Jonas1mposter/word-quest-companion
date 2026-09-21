// 分区（年级）相关的展示与判断工具

export const PRIMARY_GRADES = [1, 2, 3, 4, 5, 6] as const;
export const ALL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const CN_NUM: Record<number, string> = {
  1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八",
};

/** 该分区的词汇是否来自 hs_words（小学 1-6 与高中 9） */
export const usesZoneWordBank = (grade: number) => grade >= 9 || grade <= 6;

/** 是否小学分区 */
export const isPrimaryZone = (grade: number) => grade >= 1 && grade <= 6;

/** 分区名称，例如「三年级」「高中」 */
export const zoneName = (grade: number) => (grade >= 9 ? "高中" : `${CN_NUM[grade] ?? grade}年级`);

/** 分区徽章文案，例如「三年级专区」「高中专区」 */
export const zoneBadgeLabel = (grade: number) => `${zoneName(grade)}专区`;
