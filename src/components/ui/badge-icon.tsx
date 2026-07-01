import { cn } from "@/lib/utils";
import { Award, Banknote, BookOpen, BookOpenCheck, CalendarDays, Coins, Compass, Crown, Flame, Gem, GraduationCap, HandMetal, Heart, Infinity, Library, Medal, Megaphone, Sparkles, Sprout, Star, Sword, Swords, Target, TrendingUp, Trophy, User, Users, Zap, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = { Award, Banknote, BookOpen, BookOpenCheck, CalendarDays, Coins, Compass, Crown, Flame, Gem, GraduationCap, HandMetal, Heart, Infinity, Library, Medal, Megaphone, Sparkles, Sprout, Star, Sword, Swords, Target, TrendingUp, Trophy, User, Users, Zap };

interface BadgeIconProps { icon: string; className?: string; fallbackClassName?: string; }

export const BadgeIcon = ({ icon, className }: BadgeIconProps) => {
  if (!icon) return <Award className={cn("w-5 h-5", className)} />;
  const trimmedIcon = icon.trim();
  const IconComponent = iconMap[trimmedIcon];
  if (IconComponent) return <IconComponent className={cn("w-5 h-5", className)} />;
  const emojiRegex = /^(?:[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}])+$/u;
  const isEmoji = emojiRegex.test(trimmedIcon) || (trimmedIcon.length <= 2 && !/^[a-zA-Z]+$/.test(trimmedIcon));
  if (isEmoji) return <span className={cn("text-lg leading-none", className)}>{trimmedIcon}</span>;
  return <Award className={cn("w-5 h-5", className)} />;
};

export const getIconComponent = (iconName: string): LucideIcon | null => iconMap[iconName] || null;
export const hasIcon = (iconName: string): boolean => iconName in iconMap;
export default BadgeIcon;
