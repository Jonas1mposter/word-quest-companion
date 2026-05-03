export const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case "common": return "text-gray-400";
    case "rare": return "text-blue-400";
    case "epic": return "text-purple-400";
    case "legendary": return "text-amber-400";
    case "mythology": return "text-red-500";
    case "hidden": return "text-violet-400";
    default: return "text-gray-400";
  }
};

export const getRarityBorderStyle = (rarity: string): React.CSSProperties => {
  switch (rarity) {
    case "mythology":
      return {
        borderColor: "#ef4444",
        background: "linear-gradient(135deg, #ef4444 0%, #be123c 50%, #b91c1c 100%)",
        boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
      };
    case "hidden":
      return {
        borderColor: "#8b5cf6",
        background: "linear-gradient(135deg, #f43f5e 0%, #f59e0b 25%, #10b981 50%, #06b6d4 75%, #8b5cf6 100%)",
        boxShadow: "0 0 15px rgba(139, 92, 246, 0.5)",
      };
    case "legendary":
      return {
        borderColor: "#f59e0b",
        background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
        boxShadow: "0 0 10px rgba(245, 158, 11, 0.4)",
      };
    case "epic":
      return {
        borderColor: "#a855f7",
        background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
        boxShadow: "0 0 8px rgba(168, 85, 247, 0.3)",
      };
    case "rare":
      return {
        borderColor: "#3b82f6",
        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
        boxShadow: "0 0 6px rgba(59, 130, 246, 0.3)",
      };
    default:
      return {
        borderColor: "#9ca3af",
        background: "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)",
      };
  }
};

export const getNameCardGradientStyle = (gradientClasses: string): string => {
  if (gradientClasses.startsWith("linear-gradient") || gradientClasses.startsWith("radial-gradient")) {
    return gradientClasses;
  }
  const colorMap: Record<string, string> = {
    "amber-500": "#f59e0b", "amber-600": "#d97706", "amber-400": "#fbbf24",
    "yellow-400": "#facc15", "yellow-500": "#eab308",
    "purple-600": "#9333ea", "purple-500": "#a855f7",
    "pink-500": "#ec4899", "pink-600": "#db2777",
    "cyan-500": "#06b6d4", "cyan-600": "#0891b2",
    "blue-500": "#3b82f6", "blue-600": "#2563eb",
    "indigo-600": "#4f46e5", "indigo-500": "#6366f1",
    "red-500": "#ef4444", "red-600": "#dc2626",
    "green-500": "#22c55e", "green-600": "#16a34a",
    "orange-500": "#f97316", "orange-600": "#ea580c",
  };
  const fromMatch = gradientClasses.match(/from-([a-z]+-\d+)/);
  const viaMatch = gradientClasses.match(/via-([a-z]+-\d+)/);
  const toMatch = gradientClasses.match(/to-([a-z]+-\d+)/);
  const fromColor = fromMatch ? colorMap[fromMatch[1]] || "#8b5cf6" : "#8b5cf6";
  const viaColor = viaMatch ? colorMap[viaMatch[1]] : null;
  const toColor = toMatch ? colorMap[toMatch[1]] || "#ec4899" : "#ec4899";
  if (viaColor) {
    return `linear-gradient(135deg, ${fromColor} 0%, ${viaColor} 50%, ${toColor} 100%)`;
  }
  return `linear-gradient(135deg, ${fromColor} 0%, ${toColor} 100%)`;
};
