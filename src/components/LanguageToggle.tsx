import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { getLang, setLang } from "@/lib/i18n";

const LanguageToggle = () => {
  const lang = getLang();
  return (
    <Button
      variant="ghost"
      size="sm"
      data-no-translate
      onClick={() => setLang(lang === "en" ? "zh" : "en")}
      title={lang === "en" ? "切换到中文" : "Switch to English"}
      className="px-2"
    >
      <Languages className="w-4 h-4 mr-1" />
      {lang === "en" ? "中文" : "EN"}
    </Button>
  );
};

export default LanguageToggle;
